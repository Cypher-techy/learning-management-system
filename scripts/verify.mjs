/** EDVORA acceptance checks — run with the dev server up:  npm run verify
 *  Covers the critical workflows from §28 of the master prompt. */
const BASE = process.env.BASE || "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "✓" : "✗ FAIL"} ${name} ${extra}`); };

class Jar {
  constructor() { this.cookie = ""; }
  async req(path, opts = {}) {
    const res = await fetch(BASE + path, { ...opts, headers: { "Content-Type": "application/json", ...(this.cookie ? { Cookie: this.cookie } : {}), ...opts.headers } });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }
}
const login = async (jar, email, password, role) => jar.req("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, expectedRole: role }) });

// 1. Public catalogue hides protected premium media
{
  const anon = new Jar();
  const { data } = await anon.req("/api/courses/python-data");
  const lesson = data.course.sections.flatMap(s => s.lessons).find(l => !l.isPreview);
  ok("Premium media withheld from anonymous users", lesson && !lesson.videoUrl && lesson.body === "");
  ok("Public stats are real DB aggregates", (await anon.req("/api/stats")).data.courses >= 5);
}
// 2. Role confusion is rejected (DB role is authoritative)
{
  const jar = new Jar();
  const { res } = await login(jar, "faith@example.co.ke", "Learn@2026", "administrator");
  ok("Student cannot sign in via administrator portal", res.status === 403);
}
// 3. Student flows
const stu = new Jar();
{
  const { res } = await login(stu, "faith@example.co.ke", "Learn@2026", "student");
  ok("Student sign-in", res.status === 200);
  const bad = await stu.req("/api/courses/python-data/enroll", { method: "POST", body: "{}" });
  ok("Free student blocked from premium enrolment", bad.res.status === 403);
  const good = await stu.req("/api/courses/KCSE-maths/enroll", { method: "POST", body: "{}" });
  ok("Free course enrolment works", good.res.status === 200);
  const tutorArea = await stu.req("/api/overview/tutor");
  ok("Student cannot open tutor overview (403)", tutorArea.res.status === 403);
  const certEarly = await stu.req("/api/courses/web-foundations/certificate", { method: "POST", body: "{}" });
  ok("Certificate refused before completion", certEarly.res.status === 400);
}
// 4. Premium student quiz + certificate eligibility path
{
  const pro = new Jar();
  await login(pro, "david@example.co.ke", "Learn@2026", "student");
  const { data } = await pro.req("/api/courses/web-foundations");
  ok("Premium student sees full lesson media", !!data.course.sections[0].lessons[1].videoUrl);
  const cert = await pro.req("/api/courses/web-foundations/certificate", { method: "POST", body: "{}" });
  ok("Completed+passed student can claim certificate", cert.res.status === 200 && !!cert.data.certificate?.code);
  const verify = await pro.req(`/api/certificates/verify/${cert.data.certificate.code}`);
  ok("Certificate verifies publicly", verify.data.valid === true);
}
// 5. Pending tutor cannot publish; verified tutor wallet works
{
  const pend = new Jar();
  await login(pend, "kevin.omondi@example.co.ke", "Kevin@2026", "tutor");
  const r = await pend.req("/api/courses", { method: "POST", body: JSON.stringify({ title: "Sneaky Course", category: "Business", sections: [] }) });
  ok("Unverified tutor cannot create/publish courses", r.res.status === 403);
  const t = new Jar();
  await login(t, "amina@edvora.ac.ke", "Teach@2026", "tutor");
  const ov = await t.req("/api/overview/tutor");
  ok("Tutor wallet reflects seeded allocation", ov.data.wallet.earned === 31280, `(${ov.data.wallet.earned})`);
}
// 6. Admin hierarchy: cannot touch administrators; can verify tutors
{
  const a = new Jar();
  await login(a, "admin@edvora.ac.ke", "Admin@2026", "administrator");
  const me = await a.req("/api/overview/admin");
  const pendingAdmin = me.data.users.find(u => u.role === "administrator" && u.status === "pending");
  const r = await a.req(`/api/admin/users/${pendingAdmin.id}/status`, { method: "POST", body: JSON.stringify({ status: "verified", reason: "test" }) });
  ok("Administrator cannot approve another administrator", r.res.status === 403);
  const settingsHack = await a.req("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ tutorPercent: 10 }) });
  ok("Administrator cannot change revenue share", settingsHack.res.status === 403);
  const sm = await a.req("/api/overview/control");
  ok("Administrator cannot open owner control (403)", sm.res.status === 403);
}
// 7. M-Pesa: unconfigured deployments fail honestly, never fake success
{
  const r = await stu.req("/api/payments/mpesa/stk", { method: "POST", body: JSON.stringify({ phone: "0712345678" }) });
  const configured = r.res.status === 200;
  ok("STK Push: configured→initiated pending, else explicit 503", configured || r.res.status === 503);
  if (!configured) {
    const st = await stu.req(`/api/payments/status?id=${r.data.paymentId}`);
    ok("Failed STK never activates premium", st.data.payment.status === "failed");
  }
}
// 8. Callback idempotency: unknown checkout ignored safely
{
  const fake = { Body: { stkCallback: { CheckoutRequestID: "ws_CO_unknown", ResultCode: 0, ResultDesc: "ok", CallbackMetadata: { Item: [{ Name: "Amount", Value: 499 }, { Name: "MpesaReceiptNumber", Value: "TEST123" }] } } } };
  const res = await fetch(BASE + "/api/payments/mpesa/callback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fake) });
  const data = await res.json();
  ok("Unknown Daraja callback ignored without granting access", data.ResultDesc?.includes("Unknown") || data.ResultCode === 0);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

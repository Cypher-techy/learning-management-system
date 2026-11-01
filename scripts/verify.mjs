/** Elimu Bora acceptance checks — run with the dev server up:  npm run verify
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
const closeTo = (actual, expected, tolerance = 0.001) => Math.abs(Number(actual) - Number(expected)) <= tolerance;
const callbackSimulationRequested = process.env.VERIFY_SIMULATE_CALLBACK === "1";
const isLocalBase = /(^https?:\/\/)?(localhost|127\.0\.0\.1)([:/]|$)/.test(BASE);
// Forging a provider callback is a sandbox-only acceptance technique. It is
// deliberately refused for remote deployments; normal runs only verify that
// unconfirmed/failed payments grant nothing.
const callbackSimulation = callbackSimulationRequested && isLocalBase;
if (callbackSimulationRequested && !isLocalBase) console.log("↷ Callback simulation skipped: VERIFY_SIMULATE_CALLBACK is localhost-only.");

// 1. Public catalogue hides protected premium media
{
  const anon = new Jar();
  const { data } = await anon.req("/api/courses/python-data");
  const lesson = data.course.sections.flatMap(s => s.lessons).find(l => !l.isPreview);
  ok("Premium media withheld from anonymous users", lesson && !lesson.videoUrl && lesson.body === "");
  ok("Public stats are real DB aggregates", (await anon.req("/api/stats")).data.courses >= 5);
  ok("Premium course exposes its individual KES price for USD display",
    data.course.access === "premium" && data.course.priceKES === 499 && data.course.priceConfigured === true &&
    data.course.displayCurrency === "USD" && data.course.transactionCurrency === "KES" &&
    data.course.purchased === false && data.course.accessSource === null);
  const premiumCatalogue = await anon.req("/api/courses?access=premium");
  const premiumById = Object.fromEntries((premiumCatalogue.data.courses || []).map(c => [c.id, c]));
  ok("Current published premium courses are individually priced at KSh 350-500",
    premiumById["python-data"]?.priceKES === 499 && premiumById["business-finance"]?.priceKES === 450 &&
    premiumById["ml-intro"]?.priceKES === 500 &&
    premiumCatalogue.data.courses.every(c => c.priceConfigured === true && c.priceKES >= 350 && c.priceKES <= 500));
  const pricing = await anon.req("/api/pricing/fx");
  const range = pricing.data.publishedPremiumPriceRangeKES;
  const usdRange = pricing.data.publishedPremiumPriceRangeUSD;
  ok("Public FX feed derives USD course prices from canonical KES prices",
    pricing.res.status === 503 || (pricing.res.status === 200 && pricing.data.displayCurrency === "USD" &&
      pricing.data.transactionCurrency === "KES" && pricing.data.coursePriceBandKES?.min === 350 &&
      pricing.data.coursePriceBandKES?.max === 500 && range?.min >= 350 && range?.max <= 500 &&
      closeTo(usdRange?.min, range.min / pricing.data.fx.rate, 0.0002) &&
      closeTo(usdRange?.max, range.max / pricing.data.fx.rate, 0.0002)),
    `(${pricing.res.status})`);
  const retiredPricing = await anon.req("/api/pricing/subscriptions");
  ok("Retired all-access subscription pricing endpoint is gone", retiredPricing.res.status === 404, `(${retiredPricing.res.status})`);
  const legacyPlans = await fetch(BASE + "/plans", { redirect: "manual" });
  ok("Legacy plans URL redirects to canonical course pricing",
    [307, 308].includes(legacyPlans.status) && (legacyPlans.headers.get("location") || "").includes("/pricing"),
    `(${legacyPlans.status})`);
  const legacyPurchases = await fetch(BASE + "/dashboard/student/subscription?course=python-data", { redirect: "manual" });
  ok("Legacy subscription URL redirects to Purchases & Payments with the course preserved",
    [307, 308].includes(legacyPurchases.status) && (legacyPurchases.headers.get("location") || "").includes("/dashboard/student/purchases?course=python-data"),
    `(${legacyPurchases.status})`);
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
  const lockedCourse = await stu.req("/api/courses/python-data");
  ok("Free student has neither a course purchase nor legacy access",
    lockedCourse.data.course.purchased === false && lockedCourse.data.course.accessSource === null && lockedCourse.data.course.unlocked === false);
  const bad = await stu.req("/api/courses/python-data/enroll", { method: "POST", body: "{}" });
  ok("Free student blocked from premium enrolment", bad.res.status === 403);
  const good = await stu.req("/api/courses/KCSE-maths/enroll", { method: "POST", body: "{}" });
  ok("Free course enrolment works", good.res.status === 200);
  const tutorArea = await stu.req("/api/overview/tutor");
  ok("Student cannot open tutor overview (403)", tutorArea.res.status === 403);
  const certEarly = await stu.req("/api/courses/web-foundations/certificate", { method: "POST", body: "{}" });
  ok("Certificate refused before completion", certEarly.res.status === 400);
}
// 4. Legacy subscriber access + certificate eligibility path
{
  const pro = new Jar();
  await login(pro, "david@example.co.ke", "Learn@2026", "student");
  const premium = await pro.req("/api/courses/python-data");
  const protectedLesson = premium.data.course.sections.flatMap(s => s.lessons).find(l => !l.isPreview);
  ok("Existing legacy subscription remains honoured without pretending the course was purchased",
    premium.data.course.unlocked === true && premium.data.course.accessSource === "legacy_subscription" &&
    premium.data.course.purchased === false && !!protectedLesson?.videoUrl);
  const overview = await pro.req("/api/overview/student");
  ok("Student overview retains the legacy term and exposes lifetime purchases separately without sales gross",
    overview.data.user.premiumActive === true && !!overview.data.legacySubscription?.expiresAt &&
    new Date(overview.data.legacySubscription.expiresAt).getTime() > Date.now() &&
    overview.data.premiumCourses?.every((c) => !("salesGrossKES" in c) && !("salesCount" in c)) &&
    Array.isArray(overview.data.coursePurchases) && !("subscriptionPlans" in overview.data));
  const legacyQuote = await pro.req("/api/payments/quote?courseId=python-data");
  ok("Legacy-covered course cannot be quoted for a duplicate charge",
    legacyQuote.res.status === 409 && legacyQuote.data.alreadyAccessible === true, `(${legacyQuote.res.status})`);
  const legacyStk = await pro.req("/api/payments/mpesa/stk", {
    method: "POST",
    body: JSON.stringify({ phone: "0700000031", courseId: "python-data" }),
  });
  ok("Legacy-covered course cannot start a duplicate STK Push",
    legacyStk.res.status === 409 && legacyStk.data.alreadyAccessible === true, `(${legacyStk.res.status})`);
  const { data } = await pro.req("/api/courses/web-foundations");
  ok("Student sees full free-course lesson media", !!data.course.sections[0].lessons[1].videoUrl);
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
  await login(t, "amina@elimubora.ac.ke", "Teach@2026", "tutor");
  const ov = await t.req("/api/overview/tutor");
  ok("Tutor wallet reflects seeded allocation", ov.data.wallet.earned === 31280, `(${ov.data.wallet.earned})`);
  const peterJar = new Jar();
  await login(peterJar, "peter@elimubora.ac.ke", "Teach@2026", "tutor");
  const peterOv = await peterJar.req("/api/overview/tutor");
  const peterCourses = Object.fromEntries(peterOv.data.courses.map(c => [c.id, c]));
  ok("Tutor overview carries individual course prices and sales totals",
    peterCourses["python-data"]?.priceKES === 499 && peterCourses["ml-intro"]?.priceKES === 500 &&
    Number.isFinite(peterOv.data.stats.courseSales) && Number.isFinite(peterOv.data.stats.courseSalesGrossKES));
}
// 6. Admin hierarchy: cannot touch administrators; can verify tutors
{
  const a = new Jar();
  await login(a, "admin@elimubora.ac.ke", "Admin@2026", "administrator");
  const me = await a.req("/api/overview/admin");
  const pendingAdmin = me.data.users.find(u => u.role === "administrator" && u.status === "pending");
  const r = await a.req(`/api/admin/users/${pendingAdmin.id}/status`, { method: "POST", body: JSON.stringify({ status: "verified", reason: "test" }) });
  ok("Administrator cannot approve another administrator", r.res.status === 403);
  const settingsHack = await a.req("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ tutorPercent: 10 }) });
  ok("Administrator cannot change revenue share", settingsHack.res.status === 403);
  const planPriceHack = await a.req("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ premiumMonthlyPriceUSD: 35 }) });
  ok("Global all-access prices can no longer be configured", planPriceHack.res.status === 400, `(${planPriceHack.res.status})`);
  ok("Admin finance separates course purchases from legacy subscriptions",
    Number.isFinite(me.data.stats.coursePurchases) && Number.isFinite(me.data.stats.courseSalesKES) &&
    Array.isArray(me.data.coursePurchases) && Array.isArray(me.data.subscriptions));
  const sm = await a.req("/api/overview/control");
  ok("Administrator cannot open owner control (403)", sm.res.status === 403);
}
// 7. Pricing authority: owning tutor/super admin only, before publication,
// and only inside the current KSh 350-500 band.
{
  const admin = new Jar();
  await login(admin, "admin@elimubora.ac.ke", "Admin@2026", "administrator");
  const owningTutor = new Jar();
  await login(owningTutor, "amina@elimubora.ac.ke", "Teach@2026", "tutor");
  const otherTutor = new Jar();
  await login(otherTutor, "peter@elimubora.ac.ke", "Teach@2026", "tutor");

  const created = await owningTutor.req("/api/courses", {
    method: "POST",
    body: JSON.stringify({
      title: `Pricing Acceptance Course ${Date.now()}`,
      category: "Technology",
      level: "Beginner",
      access: "premium",
      submit: false,
      sections: [{ title: "Acceptance section", lessons: [{ title: "Acceptance lesson", kind: "reading", durationMin: 5, body: "Acceptance content" }] }],
    }),
  });
  const draftId = created.data.course?.id;
  ok("Tutor may save an unpriced premium draft, explicitly flagged as not configured",
    created.res.status === 200 && created.data.course?.status === "draft" && created.data.course?.priceConfigured === false,
    `(${created.res.status})`);

  const submitEarly = await owningTutor.req(`/api/courses/${draftId}`, { method: "PATCH", body: JSON.stringify({ action: "submit" }) });
  ok("Unpriced premium course cannot be submitted for review", submitEarly.res.status === 400, `(${submitEarly.res.status})`);
  const approveEarly = await admin.req(`/api/courses/${draftId}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) });
  ok("Unpriced premium course cannot be approved/published", approveEarly.res.status === 400, `(${approveEarly.res.status})`);

  const adminPrice = await admin.req(`/api/courses/${draftId}/pricing`, { method: "PATCH", body: JSON.stringify({ access: "premium", priceKES: 475 }) });
  ok("Regular administrator cannot set course pricing", adminPrice.res.status === 403, `(${adminPrice.res.status})`);
  const otherTutorPrice = await otherTutor.req(`/api/courses/${draftId}/pricing`, { method: "PATCH", body: JSON.stringify({ access: "premium", priceKES: 475 }) });
  ok("A different tutor cannot set another tutor's course price", otherTutorPrice.res.status === 403, `(${otherTutorPrice.res.status})`);

  const tooLow = await owningTutor.req(`/api/courses/${draftId}/pricing`, { method: "PATCH", body: JSON.stringify({ access: "premium", priceKES: 349 }) });
  const tooHigh = await owningTutor.req(`/api/courses/${draftId}/pricing`, { method: "PATCH", body: JSON.stringify({ access: "premium", priceKES: 501 }) });
  ok("Course prices outside KSh 350-500 are rejected", tooLow.res.status === 400 && tooHigh.res.status === 400,
    `(${tooLow.res.status}/${tooHigh.res.status})`);

  const setPrice = await owningTutor.req(`/api/courses/${draftId}/pricing`, { method: "PATCH", body: JSON.stringify({ access: "premium", priceKES: 425 }) });
  ok("Owning tutor sets the pre-publication course price",
    setPrice.res.status === 200 && setPrice.data.course?.priceKES === 425 && setPrice.data.course?.priceConfigured === true,
    `(${setPrice.res.status})`);

  if (process.env.VERIFY_OWNER_EMAIL && process.env.VERIFY_OWNER_PASSWORD) {
    const owner = new Jar();
    const ownerLogin = await login(owner, process.env.VERIFY_OWNER_EMAIL, process.env.VERIFY_OWNER_PASSWORD, "owner");
    const ownerPrice = await owner.req(`/api/courses/${draftId}/pricing`, { method: "PATCH", body: JSON.stringify({ access: "premium", priceKES: 450 }) });
    ok("Super admin can also set the pre-publication course price",
      ownerLogin.res.status === 200 && ownerPrice.res.status === 200 && ownerPrice.data.course?.priceKES === 450,
      `(${ownerLogin.res.status}/${ownerPrice.res.status})`);
    const restorePrice = await owningTutor.req(`/api/courses/${draftId}/pricing`, { method: "PATCH", body: JSON.stringify({ access: "premium", priceKES: 425 }) });
    ok("Owning tutor can revise pricing before publication", restorePrice.res.status === 200 && restorePrice.data.course?.priceKES === 425);
  } else {
    console.log("↷ Super-admin pricing check skipped: set VERIFY_OWNER_EMAIL and VERIFY_OWNER_PASSWORD to include it.");
  }

  const submitted = await owningTutor.req(`/api/courses/${draftId}`, { method: "PATCH", body: JSON.stringify({ action: "submit" }) });
  ok("Validly priced premium course can enter review", submitted.res.status === 200 && submitted.data.course?.status === "in_review", `(${submitted.res.status})`);
  const adminGenericPrice = await admin.req(`/api/courses/${draftId}`, { method: "PATCH", body: JSON.stringify({ priceKES: 475 }) });
  ok("Regular administrator cannot bypass pricing authority through course moderation", adminGenericPrice.res.status === 403, `(${adminGenericPrice.res.status})`);
  const rejected = await admin.req(`/api/courses/${draftId}`, { method: "PATCH", body: JSON.stringify({ action: "reject", note: "Acceptance-test course" }) });
  ok("Pricing acceptance course is rejected out of the public catalogue", rejected.res.status === 200 && rejected.data.course?.status === "rejected", `(${rejected.res.status})`);

  const publishedLock = await otherTutor.req("/api/courses/python-data/pricing", { method: "PATCH", body: JSON.stringify({ access: "premium", priceKES: 475 }) });
  ok("Published course pricing is locked", publishedLock.res.status === 400, `(${publishedLock.res.status})`);
}

// 8. USD display pricing converts from an auditable, server-stored KES course price.
// Unconfigured deployments still fail honestly and never fake success.
{
  const noCourseStk = await stu.req("/api/payments/mpesa/stk", {
    method: "POST",
    body: JSON.stringify({ phone: "0700000030", interval: "annual", amount: 1 }),
  });
  ok("STK Push without one selected course is rejected server-side", noCourseStk.res.status === 400, `(${noCourseStk.res.status})`);

  const missingQuote = await stu.req("/api/payments/quote?interval=annual");
  ok("Quote without one selected course is rejected server-side", missingQuote.res.status === 400, `(${missingQuote.res.status})`);
  const freeQuote = await stu.req("/api/payments/quote?courseId=web-foundations");
  ok("Free courses cannot be quoted for payment", freeQuote.res.status === 400, `(${freeQuote.res.status})`);

  const quoteResponse = await stu.req("/api/payments/quote?courseId=python-data");
  const q = quoteResponse.data.quote;
  const quoteValid = !!q && q.kind === "course_purchase" && q.courseId === "python-data" &&
    q.amountKES === 499 && q.coursePriceKES === 499 && q.displayCurrency === "USD" &&
    q.transactionCurrency === "KES" && closeTo(q.displayAmountUSD * q.exchangeRateUSDKES, 499, 0.01) &&
    !!q.exchangeRateDate && !!q.exchangeRateSource && !q.billingInterval && !q.intervalDays;
  ok("Course quote displays USD from the latest rate but charges the exact stored KES price",
    callbackSimulation
      ? quoteResponse.res.status === 200 && quoteValid
      : quoteResponse.res.status === 503 || (quoteResponse.res.status === 200 && quoteValid),
    `(${quoteResponse.res.status})`);

  const registerBuyer = async (label) => {
    const jar = new Jar();
    const email = `course-${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
    const registered = await jar.req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Course Purchase Verify",
        email,
        phone: "0700000099",
        password: "Learn@2026",
        confirmPassword: "Learn@2026",
        role: "student",
      }),
    });
    return { jar, email, registered };
  };
  const postCallback = async (checkoutRequestId, amount, receipt) => {
    const payload = {
      Body: {
        stkCallback: {
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: amount },
              { Name: "MpesaReceiptNumber", Value: receipt },
            ],
          },
        },
      },
    };
    const res = await fetch(BASE + "/api/payments/mpesa/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { res, data: await res.json().catch(() => ({})) };
  };

  if (!callbackSimulation) {
    const before = await stu.req("/api/overview/student");
    const beforePaymentIds = new Set((before.data.payments || []).map(p => p.id));
    const r = await stu.req("/api/payments/mpesa/stk", {
      method: "POST",
      // Browser-supplied amount/interval must be ignored by the server.
      body: JSON.stringify({ phone: "0700000030", courseId: "python-data", interval: "annual", amount: 1 }),
    });
    ok("Course STK Push: configured→pending, rejected→502, unconfigured/unavailable→503",
      [200, 502, 503].includes(r.res.status), `(${r.res.status})`);

    const after = await stu.req("/api/overview/student");
    const recorded = r.data.paymentId
      ? after.data.payments.find(p => p.id === r.data.paymentId)
      : after.data.payments.find(p => !beforePaymentIds.has(p.id) && p.courseId === "python-data");
    const courseAfter = await stu.req("/api/courses/python-data");
    const notPurchased = !(after.data.coursePurchases || []).some(p => p.courseId === "python-data") &&
      courseAfter.data.course.purchased === false && courseAfter.data.course.unlocked === false &&
      after.data.user.premiumActive === false;

    if (r.res.status === 200) {
      const st = await stu.req(`/api/payments/status?id=${encodeURIComponent(r.data.paymentId || "")}`);
      const p = st.data.payment || {};
      ok("Pending course STK records exact course, Daraja routing and USD/KES audit fields — and grants nothing yet",
        p.status === "pending" && p.kind === "course_purchase" && p.courseId === "python-data" &&
        p.amount === 499 && p.coursePriceKES === 499 && !!p.businessShortCode && !!p.partyB &&
        !!p.checkoutRequestId && p.displayCurrency === "USD" && Number(p.displayAmountUSD) > 0 &&
        closeTo(p.displayAmountUSD * p.exchangeRateUSDKES, 499, 0.01) && !p.billingInterval && notPurchased);
    } else if (recorded) {
      ok("Failed course STK retains the exact server quote and grants no access",
        recorded.status === "failed" && recorded.kind === "course_purchase" && recorded.courseId === "python-data" &&
        recorded.amount === 499 && recorded.coursePriceKES === 499 &&
        closeTo(recorded.displayAmountUSD * recorded.exchangeRateUSDKES, 499, 0.01) && notPurchased);
    } else {
      ok("Unavailable live rate before STK grants no course access", r.res.status === 503 && notPurchased, `(${r.res.status})`);
    }
  } else {
    // Sandbox-only completion path. A fresh buyer is used so the seeded
    // free student remains free on repeated verification runs.
    const tutor = new Jar();
    await login(tutor, "peter@elimubora.ac.ke", "Teach@2026", "tutor");
    const tutorBefore = await tutor.req("/api/overview/tutor");
    const expectedEarning = Math.round(499 * (Number(tutorBefore.data.settings.tutorPercent) / 100));

    const buyer = await registerBuyer("buyer");
    ok("Sandbox course buyer starts as a fresh verified student", buyer.registered.res.status === 200, `(${buyer.registered.res.status})`);
    const stk = await buyer.jar.req("/api/payments/mpesa/stk", {
      method: "POST",
      body: JSON.stringify({ phone: "0700000099", courseId: "python-data", amount: 1, interval: "annual" }),
    });
    ok("Sandbox STK initiates one exact course payment",
      stk.res.status === 200 && !!stk.data.paymentId && stk.data.kind === "course_purchase" &&
      stk.data.courseId === "python-data" && stk.data.amountKES === 499,
      `(${stk.res.status})`);

    const statusBefore = stk.data.paymentId
      ? await buyer.jar.req(`/api/payments/status?id=${encodeURIComponent(stk.data.paymentId)}`)
      : { data: {} };
    const pending = statusBefore.data.payment;
    const lockedBefore = await buyer.jar.req("/api/courses/python-data");
    ok("Pending sandbox payment is auditable and grants nothing before callback",
      pending?.status === "pending" && pending?.kind === "course_purchase" && pending?.courseId === "python-data" &&
      pending?.amount === 499 && !!pending?.checkoutRequestId && lockedBefore.data.course.unlocked === false &&
      lockedBefore.data.course.purchased === false);
    const concurrentStk = await buyer.jar.req("/api/payments/mpesa/stk", {
      method: "POST",
      body: JSON.stringify({ phone: "0700000098", courseId: "python-data" }),
    });
    ok("Concurrent checkout for the same course resumes the original payment instead of creating a second prompt",
      concurrentStk.res.status === 200 && concurrentStk.data.resumed === true && concurrentStk.data.paymentId === stk.data.paymentId,
      `(${concurrentStk.res.status})`);

    if (pending?.checkoutRequestId) {
      const receipt = `SIM${String(Date.now()).slice(-7)}`;
      const callback = await postCallback(pending.checkoutRequestId, 499, receipt);
      ok("Exact-amount callback is accepted", callback.res.status === 200 && callback.data.ResultDesc === "Accepted", `(${callback.res.status})`);

      const statusAfter = await buyer.jar.req(`/api/payments/status?id=${encodeURIComponent(stk.data.paymentId)}`);
      const completed = statusAfter.data.payment || {};
      ok("Verified callback completes the course payment with its receipt",
        completed.status === "completed" && completed.mpesaReceipt === receipt &&
        completed.confirmationSource === "callback" && completed.amount === 499);

      const purchasedCourse = await buyer.jar.req("/api/courses/python-data");
      const purchasedLesson = purchasedCourse.data.course.sections.flatMap(s => s.lessons).find(l => !l.isPreview);
      ok("Verified payment grants lifetime access only to the purchased course",
        purchasedCourse.data.course.purchased === true && purchasedCourse.data.course.accessSource === "course_purchase" &&
        purchasedCourse.data.course.unlocked === true && !!purchasedLesson?.videoUrl);
      const otherCourse = await buyer.jar.req("/api/courses/business-finance");
      ok("Buying one course does not unlock another premium course",
        otherCourse.data.course.purchased === false && otherCourse.data.course.accessSource === null &&
        otherCourse.data.course.unlocked === false);

      const enrolled = await buyer.jar.req("/api/courses/python-data/enroll", { method: "POST", body: "{}" });
      const buyerOverview = await buyer.jar.req("/api/overview/student");
      const purchase = (buyerOverview.data.coursePurchases || []).find(p => p.paymentId === stk.data.paymentId);
      ok("Purchase is recorded once as lifetime access with enrolment",
        enrolled.res.status === 200 && buyerOverview.data.stats.purchasedCourses === 1 &&
        purchase?.courseId === "python-data" && purchase?.priceKES === 499 && purchase?.access === "lifetime");

      const secondQuote = await buyer.jar.req("/api/payments/quote?courseId=python-data");
      const secondStk = await buyer.jar.req("/api/payments/mpesa/stk", {
        method: "POST",
        body: JSON.stringify({ phone: "0700000099", courseId: "python-data" }),
      });
      ok("Already-owned course cannot be charged again",
        secondQuote.res.status === 409 && secondStk.res.status === 409,
        `(${secondQuote.res.status}/${secondStk.res.status})`);

      const tutorAfter = await tutor.req("/api/overview/tutor");
      const saleTxs = (tutorAfter.data.walletTxs || []).filter(tx => tx.paymentId === stk.data.paymentId && tx.type === "earning");
      ok("Course tutor is credited exactly once at verified payment",
        saleTxs.length === 1 && saleTxs[0].amount === expectedEarning && saleTxs[0].courseId === "python-data" &&
        tutorAfter.data.stats.courseSales === tutorBefore.data.stats.courseSales + 1 &&
        tutorAfter.data.stats.courseSalesGrossKES === tutorBefore.data.stats.courseSalesGrossKES + 499);

      const duplicate = await postCallback(pending.checkoutRequestId, 499, receipt);
      const tutorDuplicate = await tutor.req("/api/overview/tutor");
      const buyerDuplicate = await buyer.jar.req("/api/overview/student");
      ok("Duplicate callback creates neither a second purchase nor a second tutor credit",
        duplicate.data.ResultDesc === "Already processed" &&
        (tutorDuplicate.data.walletTxs || []).filter(tx => tx.paymentId === stk.data.paymentId && tx.type === "earning").length === 1 &&
        (buyerDuplicate.data.coursePurchases || []).filter(p => p.courseId === "python-data").length === 1);
    } else {
      ok("Sandbox STK returned a CheckoutRequestID for callback simulation", false);
    }

    const mismatchBuyer = await registerBuyer("mismatch");
    const mismatchStk = await mismatchBuyer.jar.req("/api/payments/mpesa/stk", {
      method: "POST",
      body: JSON.stringify({ phone: "0700000099", courseId: "business-finance" }),
    });
    const mismatchStatus = mismatchStk.data.paymentId
      ? await mismatchBuyer.jar.req(`/api/payments/status?id=${encodeURIComponent(mismatchStk.data.paymentId)}`)
      : { data: {} };
    const mismatchPending = mismatchStatus.data.payment;
    if (mismatchPending?.checkoutRequestId) {
      await postCallback(mismatchPending.checkoutRequestId, 1, `BAD${String(Date.now()).slice(-7)}`);
      const failedStatus = await mismatchBuyer.jar.req(`/api/payments/status?id=${encodeURIComponent(mismatchStk.data.paymentId)}`);
      const failedCourse = await mismatchBuyer.jar.req("/api/courses/business-finance");
      const failedOverview = await mismatchBuyer.jar.req("/api/overview/student");
      ok("Amount-mismatched callback fails closed and grants no course",
        failedStatus.data.payment?.status === "failed" && failedCourse.data.course.unlocked === false &&
        failedCourse.data.course.purchased === false && (failedOverview.data.coursePurchases || []).length === 0);
    } else {
      ok("Sandbox mismatch STK returned a CheckoutRequestID", false, `(${mismatchStk.res.status})`);
    }
  }
}
// 9. Callback safety: unknown checkout ignored safely
{
  const fake = { Body: { stkCallback: { CheckoutRequestID: "ws_CO_unknown", ResultCode: 0, ResultDesc: "ok", CallbackMetadata: { Item: [{ Name: "Amount", Value: 499 }, { Name: "MpesaReceiptNumber", Value: "TEST123" }] } } } };
  const res = await fetch(BASE + "/api/payments/mpesa/callback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fake) });
  const data = await res.json();
  ok("Unknown Daraja callback ignored without granting access", data.ResultDesc?.includes("Unknown") || data.ResultCode === 0);
  const stuOverview = await stu.req("/api/overview/student");
  ok("Unknown callback creates no purchase for the free student",
    !(stuOverview.data.coursePurchases || []).some(p => p.courseId === "python-data"));
  const missing = await stu.req("/api/payments/status?id=pay_missing");
  ok("Unknown payment status returns 404 instead of hanging", missing.res.status === 404);
}

// 10. Free W3Schools-style tutorial track
{
  const anon = new Jar();
  const { data } = await anon.req("/api/courses?access=free");
  const ids = data.courses.map(c => c.id);
  ok("Free tutorials: Windows, Word, Excel, PowerPoint, HTML all published",
    ["windows-basics", "ms-word", "ms-excel", "ms-powerpoint", "html-web-foundations"].every(id => ids.includes(id)));
  const html = await anon.req("/api/courses/html-web-foundations");
  const firstLesson = html.data.course.sections[0].lessons[0];
  ok("Tutorial lessons carry structured note blocks (free to read)",
    Array.isArray(firstLesson.blocks) && firstLesson.blocks.length > 3);
  const allBlocks = html.data.course.sections.flatMap(s2 => s2.lessons).flatMap(l => l.blocks || []);
  ok("HTML tutorial has runnable Try-It examples + exercises",
    allBlocks.some(b => b.type === "example" && b.tryit) && allBlocks.some(b => b.type === "exercise"));
  ok("Catalogue flags tutorial-format courses", data.courses.find(c => c.id === "ms-excel")?.tutorial === true);
  const win = await anon.req("/api/courses/windows-basics");
  const winBlocks = win.data.course.sections.flatMap(s2 => s2.lessons).flatMap(l => l.blocks || []);
  ok("Office/Windows tutorials include steps + shortcut tables",
    winBlocks.some(b => b.type === "steps") && winBlocks.some(b => b.type === "table"));
}
// 11. Fresh student registration: one-step auto-verification, no email code
{
  const fresh = new Jar();
  const email = `verify-${Date.now()}@example.com`;
  const registered = await fresh.req("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ fullName: "Verify Student", email, phone: "0110966455", password: "Learn@2026", confirmPassword: "Learn@2026", role: "student" }),
  });
  ok("New student is auto-verified in one step (no email code)",
    registered.res.status === 200 && registered.data.ok === true && registered.data.role === "student" &&
    registered.data.status === "verified" && registered.data.autoVerified === true && !registered.data.needsVerification,
    `(${registered.res.status})`);
  const me = await fresh.req("/api/auth/me");
  ok("New student session resolves to the created account", me.data.user?.email === email && me.data.user?.status === "verified");
  ok("New student contact is marked verified", me.data.user?.contactVerified === true);
  const relogin = new Jar();
  const again = await login(relogin, email, "Learn@2026", "student");
  ok("New student can sign in again after registration", again.res.status === 200);
}
// 12. Administrator accounts are internal-only and cannot self-register
{
  const email = `blocked-admin-${Date.now()}@example.com`;
  const attempt = await new Jar().req("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Blocked Admin",
      email,
      phone: "0110966455",
      password: "Admin@2026",
      confirmPassword: "Admin@2026",
      role: "administrator",
    }),
  });
  ok("Public administrator registration is disabled", attempt.res.status === 400 && !attempt.data.ok, `(${attempt.res.status})`);

  const signIn = await login(new Jar(), email, "Admin@2026", "administrator");
  ok("Rejected administrator registration creates no sign-in account", signIn.res.status === 401, `(${signIn.res.status})`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

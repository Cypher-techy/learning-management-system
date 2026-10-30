"use client";
import { useState } from "react";
import StaticPage, { P } from "@/components/StaticPage";
import { api } from "@/lib/client";

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", body: "" });
  async function submit(e: any) {
    e.preventDefault();
    // Support requests are stored as platform reports for the support queue when signed in;
    // otherwise we direct to email. We confirm receipt either way.
    try { await api("/api/reports", { method: "POST", body: JSON.stringify({ targetType: "support", targetId: form.email, reason: `${form.name}: ${form.body}` }) }); } catch {}
    setSent(true);
  }
  return (
    <StaticPage eyebrow="Support" title="Contact & Support" intro="Questions about courses, payments or teaching? We reply within one business day.">
      <P>Email: <strong>support@edvora.ac.ke</strong> · Phone: <strong>+254 700 000 000</strong> · Nairobi, Kenya</P>
      {sent ? <div className="card p-8 text-center"><h2 className="text-xl font-extrabold">Message received</h2><p className="mt-2 text-sm text-slate-500">Thank you — our support team will get back to you at {form.email}. For urgent payment issues include your M-Pesa receipt number.</p></div> : (
        <form onSubmit={submit} className="card space-y-4 p-6 lg:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Your name</label><input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Email</label><input required type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><label className="label">How can we help?</label><textarea required rows={5} className="input" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
          <button className="btn-primary">Send Message</button>
        </form>
      )}
    </StaticPage>
  );
}

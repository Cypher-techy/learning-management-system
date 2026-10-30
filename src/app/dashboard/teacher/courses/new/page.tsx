"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { PageTitle } from "@/components/ui";

interface L { title: string; kind: string; durationMin: number; isPreview: boolean; videoUrl: string; body: string; resourceUrl: string; resourceName: string }
interface S { title: string; lessons: L[] }
const newLesson = (): L => ({ title: "", kind: "video", durationMin: 10, isPreview: false, videoUrl: "", body: "", resourceUrl: "", resourceName: "" });

export default function NewCourse() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ title: "", subtitle: "", description: "", category: "Technology", level: "Beginner", access: "free", image: "", objectives: "", requirements: "" });
  const [sections, setSections] = useState<S[]>([{ title: "Getting Started", lessons: [{ ...newLesson(), isPreview: true }] }]);
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function save(submit: boolean) {
    setBusy(true); setErr("");
    try {
      await api("/api/courses", { method: "POST", body: JSON.stringify({ ...form, sections, submit }) });
      router.push("/dashboard/teacher/courses");
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save course"); setBusy(false); }
  }
  return (
    <div>
      <PageTitle title="Create Course" sub="Build your curriculum, then save as a draft or submit for administrator review. Choose Free or Premium — premium courses earn from the subscription pool." />
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
      <div className="card space-y-5 p-6 lg:p-8">
        <div className="grid gap-5 lg:grid-cols-2">
          <div><label className="label">Course title *</label><input className="input" value={form.title} onChange={set("title")} placeholder="e.g. Excel for Kenyan Businesses" /></div>
          <div><label className="label">Subtitle</label><input className="input" value={form.subtitle} onChange={set("subtitle")} placeholder="A one-line promise to learners" /></div>
        </div>
        <div><label className="label">Description</label><textarea rows={4} className="input" value={form.description} onChange={set("description")} placeholder="What is this course about, who is it for, and what will they be able to do?" /></div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div><label className="label">Category</label><select className="input" value={form.category} onChange={set("category")}>{["Technology", "Data Science", "Business", "Design", "Academic", "Languages", "Health", "Creative Arts"].map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Difficulty</label><select className="input" value={form.level} onChange={set("level")}>{["Beginner", "Intermediate", "Advanced", "All levels"].map(l => <option key={l}>{l}</option>)}</select></div>
          <div><label className="label">Access (monetisation)</label><select className="input" value={form.access} onChange={set("access")}><option value="free">Free course</option><option value="premium">Premium (subscription)</option></select></div>
        </div>
        <div><label className="label">Thumbnail image URL (optional)</label><input className="input" value={form.image} onChange={set("image")} placeholder="https://… (leave blank for a default cover)" /></div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div><label className="label">Learning objectives (one per line)</label><textarea rows={4} className="input" value={form.objectives} onChange={set("objectives")} placeholder={"Build a budget spreadsheet\nCreate pivot tables"} /></div>
          <div><label className="label">Requirements (one per line)</label><textarea rows={4} className="input" value={form.requirements} onChange={set("requirements")} placeholder={"A computer with Excel or Google Sheets"} /></div>
        </div>
      </div>

      <h2 className="mb-4 mt-10 text-xl font-extrabold">Curriculum</h2>
      <div className="space-y-5">
        {sections.map((s, si) => (
          <div key={si} className="card p-6">
            <div className="flex items-center gap-3">
              <input className="input font-bold" value={s.title} onChange={e => { const c = [...sections]; c[si].title = e.target.value; setSections(c); }} placeholder={`Section ${si + 1} title`} />
              <button className="shrink-0 rounded-lg p-2 text-rose-500 hover:bg-rose-50" onClick={() => setSections(sections.filter((_, i) => i !== si))} aria-label="Delete section"><Trash2 size={17} /></button>
            </div>
            <div className="mt-4 space-y-4">
              {s.lessons.map((l, li) => (
                <div key={li} className="rounded-2xl bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-12">
                    <input className="input sm:col-span-5" placeholder="Lesson title" value={l.title} onChange={e => { const c = [...sections]; c[si].lessons[li].title = e.target.value; setSections(c); }} />
                    <select className="input sm:col-span-2" value={l.kind} onChange={e => { const c = [...sections]; c[si].lessons[li].kind = e.target.value; setSections(c); }}><option value="video">Video</option><option value="reading">Reading</option><option value="audio">Audio</option><option value="document">Document</option></select>
                    <input type="number" className="input sm:col-span-2" placeholder="Minutes" value={l.durationMin} onChange={e => { const c = [...sections]; c[si].lessons[li].durationMin = Number(e.target.value); setSections(c); }} />
                    <label className="flex items-center gap-2 text-xs font-semibold sm:col-span-2"><input type="checkbox" checked={l.isPreview} onChange={e => { const c = [...sections]; c[si].lessons[li].isPreview = e.target.checked; setSections(c); }} /> Free preview</label>
                    <button className="p-2 text-rose-500 sm:col-span-1" onClick={() => { const c = [...sections]; c[si].lessons.splice(li, 1); setSections(c); }} aria-label="Delete lesson"><Trash2 size={16} /></button>
                  </div>
                  <input className="input mt-3" placeholder="Video embed URL (YouTube/Vimeo) or hosted video URL" value={l.videoUrl} onChange={e => { const c = [...sections]; c[si].lessons[li].videoUrl = e.target.value; setSections(c); }} />
                  <textarea rows={2} className="input mt-3" placeholder="Lesson notes / reading content…" value={l.body} onChange={e => { const c = [...sections]; c[si].lessons[li].body = e.target.value; setSections(c); }} />
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input className="input" placeholder="Resource URL (PDF, slides…) — protected for premium" value={l.resourceUrl} onChange={e => { const c = [...sections]; c[si].lessons[li].resourceUrl = e.target.value; setSections(c); }} />
                    <input className="input" placeholder="Resource name" value={l.resourceName} onChange={e => { const c = [...sections]; c[si].lessons[li].resourceName = e.target.value; setSections(c); }} />
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-light mt-4 !py-2 !text-xs" onClick={() => { const c = [...sections]; c[si].lessons.push(newLesson()); setSections(c); }}><Plus size={14} /> Add Lesson</button>
          </div>
        ))}
      </div>
      <button className="btn-light mt-5" onClick={() => setSections([...sections, { title: "", lessons: [newLesson()] }])}><Plus size={15} /> Add Section</button>
      <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
        <button disabled={busy} onClick={() => save(false)} className="btn-dark">Save as Draft</button>
        <button disabled={busy} onClick={() => save(true)} className="btn-primary">Submit for Review</button>
        <p className="w-full text-xs text-slate-400">Quizzes and assignments can be attached after your first save via course review feedback; files are hosted in secure storage buckets in the production (Supabase) deployment — paste hosted URLs here.</p>
      </div>
    </div>
  );
}

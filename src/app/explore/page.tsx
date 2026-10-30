"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CourseCard from "@/components/CourseCard";
import { api } from "@/lib/client";
import { Loading, Empty } from "@/components/ui";

function ExploreInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [category, setCategory] = useState(params.get("category") || "");
  const [level, setLevel] = useState(""); const [access, setAccess] = useState("");
  const [sort, setSort] = useState("recent");
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    const qs = new URLSearchParams({ q, category, level, access, sort });
    api(`/api/courses?${qs}`).then(setData).catch(() => setData({ courses: [], categories: [] }));
  }, [q, category, level, access, sort]);
  return (
    <>
      <Navbar />
      <section className="bg-navy-950 pb-14 pt-32 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h1 className="text-4xl font-extrabold lg:text-5xl">Explore <span className="grad-text">Courses</span></h1>
          <p className="mt-3 max-w-xl text-slate-300">Free and premium courses from verified tutors. One Premium subscription unlocks them all.</p>
          <div className="mt-8 flex max-w-2xl items-center gap-2 rounded-full bg-white p-1.5 shadow-card">
            <Search size={18} className="ml-3 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search courses, skills, topics…" className="w-full bg-transparent py-2 text-sm text-slate-800 outline-none" aria-label="Search courses" />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="card mb-8 flex flex-wrap items-center gap-3 p-4">
          <span className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal size={16} /> Filters</span>
          <select className="input !w-auto" value={category} onChange={e => setCategory(e.target.value)} aria-label="Category"><option value="">All categories</option>{(data?.categories || []).map((c: string) => <option key={c}>{c}</option>)}</select>
          <select className="input !w-auto" value={level} onChange={e => setLevel(e.target.value)} aria-label="Level"><option value="">All levels</option>{["Beginner", "Intermediate", "Advanced", "All levels"].map(l => <option key={l}>{l}</option>)}</select>
          <select className="input !w-auto" value={access} onChange={e => setAccess(e.target.value)} aria-label="Access"><option value="">Free & Premium</option><option value="free">Free only</option><option value="premium">Premium only</option></select>
          <select className="input !w-auto ml-auto" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="recent">Most recent</option><option value="popular">Most popular</option><option value="rating">Highest rated</option></select>
        </div>
        {!data ? <Loading text="Loading courses…" /> : data.courses.length === 0 ? <Empty title="No courses match your filters" body="Try a different search or clear the filters." action={<button className="btn-dark" onClick={() => { setQ(""); setCategory(""); setLevel(""); setAccess(""); }}>Clear filters</button>} /> : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{data.courses.map((c: any) => <CourseCard key={c.id} course={c} />)}</div>
        )}
      </section>
      <Footer />
    </>
  );
}
export default function Explore() { return <Suspense fallback={<Loading />}><ExploreInner /></Suspense>; }

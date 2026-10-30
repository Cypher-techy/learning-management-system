import Navbar from "./Navbar";
import Footer from "./Footer";
import { Reveal } from "./Reveal";

export default function StaticPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <section className="noise relative overflow-hidden bg-navy-950 pb-16 pt-36 text-white">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-brand-600/25 blur-[110px]" />
        <div className="relative mx-auto max-w-4xl px-5">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-300">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-extrabold lg:text-5xl">{title}</h1>
          {intro && <p className="mt-4 max-w-2xl text-lg text-slate-300">{intro}</p>}
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-5 py-14"><Reveal>{children}</Reveal></section>
      <Footer />
    </>
  );
}
export function H({ children }: { children: React.ReactNode }) { return <h2 className="mb-3 mt-9 text-xl font-extrabold first:mt-0">{children}</h2>; }
export function P({ children }: { children: React.ReactNode }) { return <p className="mb-4 leading-relaxed text-slate-600">{children}</p>; }
export function UL({ items }: { items: string[] }) { return <ul className="mb-4 list-disc space-y-1.5 pl-5 text-slate-600">{items.map(i => <li key={i}>{i}</li>)}</ul>; }

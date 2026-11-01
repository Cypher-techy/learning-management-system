import Navbar from "./Navbar";
import Footer from "./Footer";
import { Reveal } from "./Reveal";
import { Eyebrow, H1, Lead } from "./Typography";

export default function StaticPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <section className="noise relative overflow-hidden bg-navy-950 pb-16 pt-36 text-white">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-brand-600/25 blur-[110px]" />
        <div className="relative mx-auto max-w-4xl px-5">
          <Eyebrow className="text-brand-300">{eyebrow}</Eyebrow>
          <H1 className="mt-3">{title}</H1>
          {intro && <Lead className="mt-4 max-w-2xl text-slate-300">{intro}</Lead>}
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-5 py-14"><Reveal>{children}</Reveal></section>
      <Footer />
    </>
  );
}
export function H({ children }: { children: React.ReactNode }) { return <h2 className="type-h4 mb-3 mt-9 first:mt-0">{children}</h2>; }
export function P({ children }: { children: React.ReactNode }) { return <p className="reading-prose mb-4 text-slate-700">{children}</p>; }
export function UL({ items }: { items: string[] }) { return <ul className="reading-prose mb-4 list-disc space-y-1.5 pl-5 text-slate-700">{items.map(i => <li key={i}>{i}</li>)}</ul>; }

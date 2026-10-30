"use client";
import { useState } from "react";
import { AlertTriangle, Check, Copy, Lightbulb, NotebookPen, Play, ChevronDown } from "lucide-react";
import type { LessonBlock } from "@/lib/db";

/** Renders **bold**, *italic* and `inline code` inside tutorial text. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-brand-500/10 px-1.5 py-0.5 font-mono text-[0.85em] font-semibold text-brand-700">{part}</code>
        ) : (
          <span key={i}>{renderEmphasis(part)}</span>
        )
      )}
    </>
  );
}
function renderEmphasis(text: string) {
  const boldParts = text.split(/\*\*([^*]+)\*\*/g);
  return boldParts.map((part, i) => {
    if (i % 2 === 1) return <strong key={i}>{part}</strong>;
    const italics = part.split(/\*([^*]+)\*/g);
    return italics.map((p, j) => (j % 2 === 1 ? <em key={`${i}-${j}`}>{p}</em> : <span key={`${i}-${j}`}>{p}</span>));
  });
}

function CodeView({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  }
  return (
    <div className="group relative overflow-hidden rounded-xl bg-navy-950">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{language || "code"}</span>
        <button onClick={copy} className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-white/20">
          {copied ? <><Check size={12} className="text-emerald-400" /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-slate-100">{code}</pre>
    </div>
  );
}

/** W3Schools-style "Try it yourself": edit the code, run it, see the result. */
function TryIt({ initial }: { initial: string }) {
  const [codeText, setCodeText] = useState(initial);
  const [srcDoc, setSrcDoc] = useState(initial);
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(codeText); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {} }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <span className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Example — try it yourself</span>
        <span className="ml-auto flex gap-2">
          <button onClick={copy} className="btn-light !px-3 !py-1.5 !text-[11px]">{copied ? "Copied ✓" : "Copy code"}</button>
          <button onClick={() => setSrcDoc(codeText)} className="btn-primary !px-4 !py-1.5 !text-[11px]"><Play size={12} /> Run ▸</button>
        </span>
      </div>
      <div className="grid lg:grid-cols-2">
        <textarea
          value={codeText}
          onChange={(e) => setCodeText(e.target.value)}
          spellCheck={false}
          aria-label="Editable example code"
          className="min-h-[240px] w-full resize-y border-b border-slate-200 bg-navy-950 p-4 font-mono text-[13px] leading-relaxed text-slate-100 outline-none lg:border-b-0 lg:border-r"
        />
        <div className="bg-white">
          <p className="border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Result</p>
          <iframe title="Example result" sandbox="allow-scripts" srcDoc={srcDoc} className="h-[248px] w-full bg-white" />
        </div>
      </div>
      <p className="bg-white px-4 py-2 text-[11px] text-slate-400">Change the code on the left, press <strong>Run</strong>, and watch the result change. Nothing can break — refresh resets nothing, your edits stay yours.</p>
    </div>
  );
}

function Exercise({ block }: { block: LessonBlock }) {
  const [show, setShow] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-dashed border-brand-500/40 bg-brand-500/5">
      <p className="flex items-center gap-2 bg-brand-500/10 px-5 py-3 text-xs font-extrabold uppercase tracking-widest text-brand-700">
        <NotebookPen size={15} /> Exercise — try it before peeking
      </p>
      <div className="px-5 py-4">
        <p className="font-medium leading-relaxed text-slate-800"><Inline text={block.content || ""} /></p>
        <button onClick={() => setShow(!show)} className="btn-dark mt-4 !py-2 !text-xs" aria-expanded={show}>
          {show ? "Hide answer" : "Show answer"} <ChevronDown size={14} className={`transition ${show ? "rotate-180" : ""}`} />
        </button>
        {show && block.answer && (
          <div className="mt-4 rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-soft">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-emerald-600">Answer</p>
            <Inline text={block.answer} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TutorialArticle({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <article className="space-y-5" aria-label="Tutorial notes">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return <h3 key={i} className="pt-3 text-lg font-extrabold tracking-tight text-slate-900"><Inline text={b.content || ""} /></h3>;
          case "text":
            return <p key={i} className="leading-[1.85] text-slate-700"><Inline text={b.content || ""} /></p>;
          case "code":
            return <CodeView key={i} code={b.code || ""} language={b.language} />;
          case "example":
            return b.tryit ? <TryIt key={i} initial={b.code || ""} /> : <CodeView key={i} code={b.code || ""} language={b.language} />;
          case "tip":
            return (
              <div key={i} className="flex gap-3 rounded-r-2xl border-l-4 border-emerald-500 bg-emerald-50 px-5 py-4">
                <Lightbulb size={19} className="mt-0.5 shrink-0 text-emerald-600" />
                <p className="text-sm leading-relaxed text-emerald-900"><strong>Tip: </strong><Inline text={b.content || ""} /></p>
              </div>
            );
          case "note":
            return (
              <div key={i} className="rounded-r-2xl border-l-4 border-amber-400 bg-[#fffbe6] px-5 py-4">
                <p className="text-sm leading-relaxed text-amber-900"><strong>Note: </strong><Inline text={b.content || ""} /></p>
              </div>
            );
          case "warning":
            return (
              <div key={i} className="flex gap-3 rounded-r-2xl border-l-4 border-rose-500 bg-rose-50 px-5 py-4">
                <AlertTriangle size={19} className="mt-0.5 shrink-0 text-rose-500" />
                <p className="text-sm leading-relaxed text-rose-900"><strong>Warning: </strong><Inline text={b.content || ""} /></p>
              </div>
            );
          case "list":
            return (
              <ul key={i} className="list-disc space-y-2 pl-6 leading-relaxed text-slate-700 marker:text-brand-500">
                {(b.items || []).map((item, j) => <li key={j}><Inline text={item} /></li>)}
              </ul>
            );
          case "steps":
            return (
              <ol key={i} className="space-y-3">
                {(b.items || []).map((item, j) => (
                  <li key={j} className="flex gap-3.5">
                    <span className="grad-bg flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white shadow-glow">{j + 1}</span>
                    <p className="pt-0.5 leading-relaxed text-slate-700"><Inline text={item} /></p>
                  </li>
                ))}
              </ol>
            );
          case "table":
            return (
              <div key={i} className="table-wrap overflow-hidden rounded-2xl border border-slate-200">
                <table className="edv !min-w-0">
                  <thead><tr className="bg-navy-900">{(b.headers || []).map((hd, j) => <th key={j} className="!border-navy-900 !text-white">{hd}</th>)}</tr></thead>
                  <tbody>
                    {(b.rows || []).map((row, r) => (
                      <tr key={r} className={r % 2 ? "bg-slate-50" : "bg-white"}>
                        {row.map((cell, c) => <td key={c} className={c === 0 ? "font-semibold text-slate-800" : "text-slate-600"}><Inline text={cell} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "exercise":
            return <Exercise key={i} block={b} />;
          default:
            return null;
        }
      })}
    </article>
  );
}

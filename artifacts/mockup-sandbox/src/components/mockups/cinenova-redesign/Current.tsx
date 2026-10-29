import { useState } from 'react';
import { ArrowLeft, ArrowRight, Clapperboard, Download, Film, MessageCircle, ShieldCheck, X } from 'lucide-react';
import './_group.css';

type DownloadOption = { label: string; quality: string; size: string };

const options: DownloadOption[] = [
  { label: 'PixelDrain', quality: '1080p WEB-DL', size: '1.8 GB' },
  { label: 'Direct DL', quality: '720p WEB-DL', size: '960 MB' },
];

function Header() {
  return (
    <header className="relative z-20 border-b border-white/[.07] bg-[#0b0c16]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between px-5 md:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/[.08] text-cyan-200">
            <Clapperboard size={20} />
          </span>
          <span>
            <span className="block text-[17px] font-bold tracking-[.14em] text-white">CINENOVA</span>
            <span className="block font-mono text-[9px] tracking-[.19em] text-cyan-200/60">THE FILM INDEX</span>
          </span>
        </div>
        <span className="hidden text-xs text-slate-400 sm:block">FILM / DETAILS</span>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-white/[.07]">
      <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-3 px-5 py-7 text-[11px] text-slate-500 sm:flex-row md:px-10">
        <span className="font-mono tracking-[.12em]">CINENOVA <span className="text-cyan-300/70">/</span> MOVIE DISCOVERY</span>
        <span>Developed by IMALSHA NETHSARA</span>
        <span>Choose clean. Request safely.</span>
      </div>
    </footer>
  );
}

function DownloadModal({ option, close }: { option: DownloadOption; close: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060b]/80 p-4 backdrop-blur-md" onClick={close}>
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[470px] rounded-2xl border border-cyan-100/15 bg-[#141624] p-6 shadow-[0_28px_100px_rgba(0,0,0,.6)] md:p-8" onClick={(event) => event.stopPropagation()}>
        <button onClick={close} aria-label="Close dialog" className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-white/[.06] hover:text-white"><X size={17} /></button>
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-200/[.08] text-cyan-100"><MessageCircle size={20} /></div>
        <p className="font-mono text-[9px] tracking-[.22em] text-cyan-200/70">REQUEST A CLEAN COPY</p>
        <h2 className="mt-2 pr-8 text-xl font-semibold leading-snug text-white">The Last Signal (2025)</h2>
        <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-white/[.07] bg-white/[.025] p-3">
          <div><span className="block font-mono text-[8px] tracking-wider text-slate-500">SOURCE</span><span className="mt-1 block text-xs text-slate-200">{option.label}</span></div>
          <div><span className="block font-mono text-[8px] tracking-wider text-slate-500">QUALITY</span><span className="mt-1 block text-xs text-slate-200">{option.quality}</span></div>
          <div><span className="block font-mono text-[8px] tracking-wider text-slate-500">FILE SIZE</span><span className="mt-1 block text-xs text-slate-200">{option.size}</span></div>
        </div>
        <label className="mb-2 mt-6 block text-xs font-medium text-slate-300">Your WhatsApp phone number</label>
        <input type="tel" placeholder="+94 77 123 4567" className="w-full rounded-lg border border-white/10 bg-[#0d0f19] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/50" />
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-bold text-[#091014] transition hover:bg-cyan-200"><MessageCircle size={17} /> Share to WhatsApp</button>
        <p className="mt-4 flex items-center gap-2 text-[10px] leading-4 text-slate-500"><ShieldCheck size={13} className="shrink-0 text-cyan-200/60" /> Your phone number and selected movie details go to the bot endpoint configured by the administrator.</p>
      </div>
    </div>
  );
}

export function Current() {
  const [selected, setSelected] = useState<DownloadOption | null>(null);

  return (
    <div className="cinema-bg min-h-[100dvh] text-slate-100">
      <Header />
      <main className="mx-auto max-w-[1100px] px-5 py-9 md:px-10">
        <button className="mb-8 inline-flex items-center gap-2 text-xs text-slate-400 transition hover:text-cyan-100"><ArrowLeft size={15} /> Back to discovery</button>
        <div className="grid gap-8 md:grid-cols-[270px_1fr] md:gap-12">
          <div className="relative mx-auto w-full max-w-[270px] overflow-hidden rounded-2xl border border-white/10 bg-[#171927] shadow-[0_20px_60px_rgba(0,0,0,.4)]">
            <div className="flex aspect-[2/3] items-center justify-center bg-gradient-to-br from-[#172a36] to-[#201c35]"><Film size={60} className="text-cyan-100/25" /></div>
          </div>
          <div className="pt-2 md:pt-8">
            <p className="font-mono text-[10px] tracking-[.22em] text-cyan-200/75">FILM / DETAILS</p>
            <h1 className="mt-4 max-w-[720px] text-3xl font-bold leading-tight tracking-[-.045em] text-white md:text-5xl">The Last Signal (2025)</h1>
            <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-cyan-200/20 bg-cyan-200/[.06] px-3 py-1.5 font-mono text-[10px] text-cyan-100">1080p WEB-DL</span><span className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] text-slate-300">RATING 8.2</span></div>
            <p className="mt-7 max-w-[600px] text-sm leading-6 text-slate-400">An isolated signal draws a small crew into a mystery that changes everything they know about the last transmission from Earth.</p>
            <div className="mt-10 border-t border-white/[.08] pt-6">
              <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] tracking-[.2em] text-purple-200/70">AVAILABLE SOURCES</p><h2 className="mt-2 text-lg font-semibold text-white">Choose a clean link</h2></div><span className="font-mono text-[10px] text-slate-500">2 OPTIONS</span></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {options.map((option) => <button key={option.label} onClick={() => setSelected(option)} className="group flex items-center justify-between rounded-xl border border-white/[.09] bg-white/[.025] p-4 text-left transition hover:border-cyan-200/40 hover:bg-cyan-200/[.04]"><span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-200/15 bg-purple-300/[.07] text-purple-100"><Download size={17} /></span><span><span className="block text-sm font-semibold text-slate-100">{option.label}</span><span className="mt-1 block text-[10px] text-slate-500">{option.quality} · {option.size}</span></span></span><ArrowRight size={16} className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-100" /></button>)}
              </div>
              <p className="mt-5 flex items-center gap-2 text-[10px] text-slate-600"><ShieldCheck size={13} /> Only Direct DL and PixelDrain sources are shown.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      {selected && <DownloadModal option={selected} close={() => setSelected(null)} />}
    </div>
  );
}

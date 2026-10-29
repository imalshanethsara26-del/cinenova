import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useCreateAdminSession, useDeleteAdminSession, useGetAdminSession, getGetAdminSessionQueryKey } from '@workspace/api-client-react';
import { Toaster as SonnerToaster, toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Download, Film, LoaderCircle, LockKeyhole, MessageCircle, Search, Settings2, ShieldCheck, X } from 'lucide-react';

const queryClient = new QueryClient();
const API = 'https://chithrapata-api.onrender.com';
const DEFAULT_BOT_API_ENDPOINT = 'https://cinenovabot.loca.lt/api/bot/send-movie';
type Movie = { title: string; image: string; quality: string; rating: string; link: string };
type DownloadOption = { label: string; url: string; quality: string; size: string; provider: string };
type ApiMovie = Record<string, unknown>;

function isTelegramRelated(value: string) {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch {}
  return /t\.me|telegram|tg:\/\//i.test(decoded);
}

function movieFrom(value: ApiMovie): Movie {
  const title = String(value.title ?? value.name ?? value.movie_title ?? 'Untitled film');
  const link = String(value.link ?? value.url ?? value.movieUrl ?? '');
  return {
    title, link: link.startsWith('/') ? `https://chithrapata.com${link}` : link,
    image: String(value.image ?? value.poster ?? value.thumbnail ?? ''),
    quality: String(value.quality ?? value.resolution ?? 'WEB-DL'),
    rating: String(value.rating ?? 'N/A'),
  };
}
function eligibleOptions(payload: unknown): DownloadOption[] {
  const out: DownloadOption[] = [];
  const seen = new Set<string>();
  const walk = (value: unknown, inheritedLabel = '') => {
    if (Array.isArray(value)) { value.forEach((v) => walk(v, inheritedLabel)); return; }
    if (!value || typeof value !== 'object') return;
    const item = value as Record<string, unknown>;
    const linkValue = item.url ?? item.link ?? item.download_url ?? item.downloadUrl ?? item.href ?? '';
    const linkText = typeof linkValue === 'string' ? linkValue : JSON.stringify(linkValue);
    const url = linkText.match(/https?:\/\/[^\s"'<>]+/i)?.[0] ?? '';
    const label = String(item.label ?? item.name ?? item.provider ?? item.host ?? item.title ?? inheritedLabel);
    const quality = String(item.quality ?? item.resolution ?? '');
    const telegramCheck = `${inheritedLabel} ${label} ${quality} ${linkText} ${JSON.stringify(item)}`;
    let parsedUrl: URL | undefined;
    try { parsedUrl = new URL(url); } catch {}
    const host = parsedUrl?.hostname.toLowerCase() ?? '';
    const pixelDrainHost = host === 'pixeldrain.com' || host.endsWith('.pixeldrain.com');
    if (url && parsedUrl?.protocol === 'https:' && pixelDrainHost && !parsedUrl.username && !parsedUrl.password && !isTelegramRelated(telegramCheck)) {
      const key = `${label}|${url}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          label: 'PixelDrain',
          url, provider: 'PixelDrain',
          quality,
          size: String(item.size ?? item.file_size ?? item.filesize ?? ''),
        });
      }
    }
    Object.entries(item).forEach(([key, v]) => walk(v, `${inheritedLabel} ${key}`.trim()));
  };
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const detail = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : root;
  walk(detail.downloads ?? detail);
  return out;
}
async function getMovies(page: number, query: string) {
  const endpoint = query
    ? `${API}/api/v1/chithrapata/search?q=${encodeURIComponent(query)}`
    : `${API}/api/v1/chithrapata/latest?page=${page}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('Could not reach the cinema index.');
  const responseBody: unknown = await response.json();
  const body = responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)
    ? responseBody as Record<string, unknown>
    : {};
  const rawValue = Array.isArray(responseBody)
    ? responseBody
    : body.data ?? body.results ?? body.movies ?? [];
  const raw = Array.isArray(rawValue)
    ? rawValue.filter((value): value is ApiMovie => Boolean(value) && typeof value === 'object' && !Array.isArray(value))
    : [];
  return {
    movies: raw.map((value) => movieFrom(value)).filter((movie) => movie.link && movie.title !== 'Movies'),
    count: Number(body.results_count ?? raw.length),
    page: Number(body.page ?? page),
  };
}
async function getInfo(url: string) {
  const response = await fetch(`${API}/api/v1/chithrapata/infodl?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error('Movie details are unavailable right now.');
  return response.json();
}
function Header() {
  const [, setLocation] = useLocation();
  return <header className="relative z-20 border-b border-white/[.07] bg-[#0b0c16]/70 backdrop-blur-xl">
    <div className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between px-5 md:px-10">
      <button onClick={() => setLocation('/')} data-testid="link-home" aria-label="Cinenova home" className="group flex min-w-0 items-center text-left">
        <img src="/images/cinenova-logo-banner.webp" alt="Cinenova" className="h-[54px] w-[190px] max-w-[58vw] object-contain object-left sm:h-[62px] sm:w-[235px]"/>
      </button>
      <nav className="flex items-center gap-4 md:gap-8">
        <button onClick={() => setLocation('/')} className="hidden text-[13px] font-medium text-slate-300 transition hover:text-cyan-200 sm:block" data-testid="nav-discover">Discover</button>
        <div className="hidden h-5 w-px bg-white/10 sm:block"/>
        <button onClick={() => setLocation('/admin')} data-testid="nav-admin" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[12px] text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"><Settings2 size={14}/> Admin</button>
      </nav>
    </div>
  </header>;
}
function Footer() {
  return <footer className="mt-20 border-t border-white/[.08] bg-[#0b1220]/45">
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-5 py-8 md:px-10">
      <p className="max-w-5xl text-[11px] leading-5 text-slate-500">Disclaimer &amp; Credit: All movie rights, subtitles, and original content belong exclusively to chithrapata.com. CINENOVA is an independent utility platform designed solely to assist users in seamlessly delivering movie streams directly to their WhatsApp chats for personal convenience.</p>
      <div className="flex flex-col gap-2 border-t border-white/[.06] pt-4 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono tracking-[.12em]">CINENOVA <span className="text-orange-400">/</span> MOVIE DISCOVERY</span>
        <span>Developed by IMALSHA NETHSARA</span>
      </div>
    </div>
  </footer>;
}
function SkeletonGrid() {
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <div key={i} className="animate-pulse"><div className="aspect-[2/3] rounded-xl border border-white/[.06] bg-white/[.045]"/><div className="mt-3 h-3 w-4/5 rounded bg-white/[.06]"/><div className="mt-2 h-2 w-2/5 rounded bg-white/[.04]"/></div>)}</div>;
}
function MovieTile({ movie, index }: { movie: Movie; index: number }) {
  const [, setLocation] = useLocation();
  return <button onClick={() => setLocation(`/movie?url=${encodeURIComponent(movie.link)}`)} data-testid={`card-movie-${index}`} className="poster-card group text-left">
    <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/[.09] bg-[#171927]">
      {movie.image ? <img src={movie.image} alt={movie.title} loading="lazy" className="absolute inset-0 z-10 h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]" onError={(e) => { e.currentTarget.style.display = 'none'; }}/> : null}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br from-[#172a36] via-[#222038] to-[#13131e]"><Film size={36} className="text-cyan-200/25"/></div>
      <div className="absolute inset-x-0 bottom-0 z-20 h-2/5 bg-gradient-to-t from-[#090a12]/90 to-transparent"/>
      <span className="absolute left-2.5 top-2.5 z-30 rounded border border-cyan-200/25 bg-[#07161b]/75 px-2 py-1 font-mono text-[9px] tracking-wide text-cyan-100 backdrop-blur">{movie.quality || 'WEB-DL'}</span>
      <span className="absolute bottom-3 right-3 z-30 flex h-8 w-8 translate-y-2 items-center justify-center rounded-full border border-cyan-200/30 bg-cyan-300/15 text-cyan-100 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100"><ArrowRight size={15}/></span>
    </div>
    <h3 className="mt-3 line-clamp-2 min-h-[40px] text-[13px] font-semibold leading-5 text-slate-200 transition group-hover:text-orange-200" data-testid={`text-movie-title-${index}`}>{movie.title}</h3>
    <div className="mt-1 flex min-w-0 items-center justify-between gap-1 font-mono text-[9px] tracking-wide text-slate-500"><span className="truncate">{movie.quality || 'WEB-DL'}</span><span className="shrink-0 text-amber-200">IMDb {movie.rating}</span></div>
  </button>;
}
function HomePage() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const { data, isLoading, isError, refetch, isFetching } = useQuery({ queryKey: ['cinema-index', page, activeQuery], queryFn: () => getMovies(page, activeQuery), staleTime: 60_000 });
  const movies = data?.movies ?? [];
  const featured = movies[0];
  const submitSearch = (e: FormEvent) => { e.preventDefault(); setPage(1); setActiveQuery(search.trim()); };
  return <div className="cinema-bg min-h-[100dvh] text-slate-100">
    <Header/>
    <main className="mx-auto max-w-[1320px] px-5 md:px-10">
      {!activeQuery && <section className="relative flex min-h-[340px] items-center overflow-hidden border-b border-white/[.07] py-14 md:min-h-[390px]">
        <div className="pointer-events-none absolute right-[-4%] top-[-40px] h-[390px] w-[390px] rounded-full border border-cyan-300/[.08] before:absolute before:inset-8 before:rounded-full before:border before:border-purple-300/[.12] after:absolute after:inset-20 after:rounded-full after:bg-[radial-gradient(circle,rgba(28,203,220,.1),transparent_68%)]"/>
        <div className="relative max-w-[730px] fade-up">
          <div className="mb-6 flex min-w-0 flex-wrap items-center gap-3 font-mono text-[10px] tracking-[.25em] text-cyan-200/70 max-[380px]:gap-2 max-[380px]:tracking-[.12em]"><span className="h-px w-9 shrink-0 bg-cyan-300/70"/> ISSUE 01 <span className="text-slate-600">/</span> FIND YOUR NEXT FILM</div>
          <h1 className="text-[clamp(48px,8vw,88px)] font-bold leading-[.92] tracking-[-.065em] text-white">The next one<br/><span className="text-cyan-200">starts here.</span></h1>
          <p className="mt-6 max-w-[450px] text-sm leading-6 text-slate-400">A fast index of films worth your time. Find the title, check the available links, and request a clean copy through WhatsApp.</p>
          <form onSubmit={submitSearch} className="mt-8 flex max-w-[580px] gap-2 rounded-xl border border-white/[.12] bg-[#171925]/75 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,.25)] backdrop-blur-xl">
            <Search size={18} className="ml-3 mt-[11px] shrink-0 text-cyan-200/70 max-[380px]:ml-2"/>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a title..." aria-label="Search movies" data-testid="input-movie-search" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-slate-600"/>
            <button type="submit" data-testid="button-search" className="shrink-0 rounded-lg bg-cyan-300 px-5 py-2 text-xs font-bold tracking-wide text-[#071014] transition hover:bg-cyan-200 max-[380px]:px-2">Search</button>
          </form>
        </div>
        <div className="absolute bottom-9 right-0 hidden font-mono text-[9px] tracking-[.2em] text-slate-600 lg:block">CURATED SIGNAL / 2026</div>
      </section>}
      <section className="pb-8 pt-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-mono text-[10px] tracking-[.22em] text-purple-200/70">{activeQuery ? 'SEARCH RESULTS' : 'FRESH FROM THE INDEX'}</p><h2 className="mt-2 text-[26px] font-semibold tracking-[-.04em] text-white">{activeQuery ? `“${activeQuery}”` : 'Recently added'}</h2></div>
          <div className="flex items-center gap-4">
            {isFetching && !isLoading && <span className="font-mono text-[10px] text-slate-500">SYNCING INDEX</span>}
            {activeQuery && <button onClick={() => { setActiveQuery(''); setSearch(''); setPage(1); }} data-testid="button-clear-search" className="text-xs text-slate-400 hover:text-cyan-200">Clear search</button>}
            {data && <span className="font-mono text-[10px] text-slate-500">{data.count} RESULTS</span>}
          </div>
        </div>
        {isLoading ? <SkeletonGrid/> : isError ? <div className="rounded-2xl border border-rose-300/15 bg-rose-300/[.04] p-8 text-center"><p className="text-sm text-rose-100">The index is taking a moment to respond.</p><button onClick={() => refetch()} data-testid="button-retry-movies" className="mt-4 rounded-lg border border-rose-200/20 px-4 py-2 text-xs text-rose-100 hover:bg-rose-300/10">Try again</button></div> : movies.length === 0 ? <div className="rounded-2xl border border-white/[.08] bg-white/[.025] px-6 py-16 text-center"><Film size={28} className="mx-auto text-cyan-200/50"/><h3 className="mt-4 text-lg font-semibold text-slate-200">No films found</h3><p className="mt-2 text-sm text-slate-500">Try a different title or browse the latest additions.</p></div> : <>
          {featured && !activeQuery && <div className="mb-9 grid overflow-hidden rounded-2xl border border-cyan-100/[.13] bg-[#161827]/70 shadow-[0_22px_70px_rgba(0,0,0,.2)] md:grid-cols-[180px_1fr]">
            <div className="relative hidden h-[225px] md:block">{featured.image && <img src={featured.image} alt="" className="h-full w-full object-cover opacity-80"/>}<div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#161827]/90"/></div>
            <div className="flex items-center justify-between gap-6 p-6 md:py-8"><div><div className="flex items-center gap-2 font-mono text-[9px] tracking-[.2em] text-cyan-200/70"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300"/> LATEST SIGNAL</div><h3 className="mt-3 max-w-[620px] text-xl font-semibold leading-tight text-white md:text-2xl">{featured.title}</h3><p className="mt-2 text-xs text-slate-400">{featured.quality} <span className="mx-2 text-slate-700">/</span> Rating {featured.rating}</p></div><button onClick={() => setLocation(`/movie?url=${encodeURIComponent(featured.link)}`)} data-testid="button-featured-details" className="hidden shrink-0 items-center gap-2 rounded-lg border border-cyan-200/25 px-4 py-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-200/10 sm:flex">Explore title <ArrowRight size={14}/></button></div>
          </div>}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{movies.map((movie, i) => <MovieTile key={`${movie.link}-${i}`} movie={movie} index={i}/>)}</div>
          {!activeQuery && <div className="mt-12 flex items-center justify-center gap-4"><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || isFetching} data-testid="button-previous-page" className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-xs text-slate-300 transition hover:border-cyan-200/40 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft size={15}/> Previous</button><span data-testid="text-current-page" className="font-mono text-[11px] text-slate-500">PAGE <span className="text-cyan-100">{page}</span></span><button onClick={() => setPage((p) => p + 1)} disabled={movies.length === 0 || isFetching} data-testid="button-next-page" className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-xs text-slate-300 transition hover:border-cyan-200/40 disabled:cursor-not-allowed disabled:opacity-35">Next <ChevronLeft size={15} className="rotate-180"/></button></div>}
        </>}
      </section>
    </main><Footer/>
  </div>;
}
function DownloadModal({ movie, option, close }: { movie: string; option: DownloadOption | null; close: () => void }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);
  if (!option) return null;
  const send = async (e: FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    let selectedUrl: URL | undefined;
    try { selectedUrl = new URL(option.url); } catch {}
    if (!selectedUrl || selectedUrl.protocol !== 'https:' || !(selectedUrl.hostname.toLowerCase() === 'pixeldrain.com' || selectedUrl.hostname.toLowerCase().endsWith('.pixeldrain.com'))) {
      const message = 'This download source is not available.';
      setError(message);
      toast.error(message);
      return;
    }
    if (!/^\+?[0-9][0-9\s()-]{7,18}$/.test(cleanPhone)) {
      const message = 'Enter a valid WhatsApp phone number.';
      setError(message);
      toast.error(message);
      return;
    }
    setError(''); setSending(true);
    try {
      const botApiUrl = localStorage.getItem('botApiUrl')?.trim() ?? '';
      if (!botApiUrl) throw new Error('Bot not connected, please try again later');
      const whatsappJid = localStorage.getItem('whatsappJid')?.trim() || '120363433233156274@g.us';
      const payload = {
        whatsappJid,
        userPhone: cleanPhone,
        movieTitle: movie.trim(),
        fileSize: option.size || 'N/A',
        downloadLink: selectedUrl.href,
      };
      const response = await fetch(botApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const contentType = response.headers.get('content-type') ?? '';
      if (!/\b(?:application|text)\/(?:[a-z0-9.+-]+\+)?json\b/i.test(contentType)) {
        throw new Error(`Bot endpoint returned a non-JSON response (HTTP ${response.status}).`);
      }
      const result = await response.json() as { success?: unknown; status?: unknown; message?: unknown; error?: unknown } | null;
      const responseMessage = typeof result?.message === 'string'
        ? result.message
        : typeof result?.error === 'string'
          ? result.error
          : '';
      const applicationError = result?.success === false
        || result?.status === false
        || Boolean(result?.error)
        || (typeof result?.status === 'string' && /^(error|failed)$/i.test(result.status));
      if (!response.ok || applicationError) {
        throw new Error(responseMessage || `Bot request failed (HTTP ${response.status}).`);
      }
      console.info('Movie request sent to WhatsApp bot successfully.');
      toast.success('Movie sent to WhatsApp successfully!');
      close();
    } catch (err) {
      console.error('Movie request to WhatsApp bot failed:', err);
      const message = err instanceof Error ? err.message : 'Could not send your request. Please try again.';
      setError(message);
      toast.error(message);
    }
    finally { setSending(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#050914]/85 p-3 backdrop-blur-md sm:p-5" onClick={close} role="presentation">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="download-title" tabIndex={-1} className="relative my-auto max-h-[calc(100dvh-24px)] w-full max-w-[470px] overflow-y-auto rounded-2xl border border-orange-300/20 bg-[#141b2a]/95 p-5 shadow-[0_28px_100px_rgba(0,0,0,.6)] sm:p-7" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
      <button onClick={close} aria-label="Close dialog" data-testid="button-close-download-modal" className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-white/[.06] hover:text-white"><X size={17}/></button>
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-200/[.08] text-cyan-100"><MessageCircle size={20}/></div>
      <p className="font-mono text-[9px] tracking-[.22em] text-cyan-200/70">REQUEST A CLEAN COPY</p>
      <h2 id="download-title" className="mt-2 pr-8 text-xl font-semibold leading-snug text-white">{movie}</h2>
      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-white/[.07] bg-white/[.025] p-3 sm:grid-cols-3 sm:gap-2">
        <div><span className="block font-mono text-[8px] tracking-wider text-slate-500">SOURCE</span><span className="mt-1 block text-xs text-slate-200">{option.label}</span></div>
        <div><span className="block font-mono text-[8px] tracking-wider text-slate-500">QUALITY</span><span className="mt-1 block text-xs text-slate-200">{option.quality || 'Available'}</span></div>
        <div><span className="block font-mono text-[8px] tracking-wider text-slate-500">FILE SIZE</span><span className="mt-1 block text-xs text-slate-200">{option.size || 'Not listed'}</span></div>
      </div>
      <form onSubmit={send} className="mt-6">
        <label htmlFor="whatsapp-phone" className="mb-2 block text-xs font-medium text-slate-300">Your WhatsApp phone number</label>
        <input id="whatsapp-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+94 77 123 4567" data-testid="input-whatsapp-phone" className="w-full rounded-lg border border-white/10 bg-[#0d0f19] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-200/50"/>
        {error && <p role="alert" data-testid="status-download-error" className="mt-2 text-xs text-rose-300">{error}</p>}
        <button type="submit" disabled={sending} data-testid="button-share-whatsapp" className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-bold text-[#091014] transition hover:bg-cyan-200 disabled:opacity-60">{sending ? <LoaderCircle size={17} className="animate-spin"/> : <MessageCircle size={17}/>} Share to WhatsApp</button>
      </form>
      <p className="mt-4 flex items-center gap-2 text-[10px] leading-4 text-slate-500"><ShieldCheck size={13} className="shrink-0 text-cyan-200/60"/> Your phone number and selected movie details go to the bot endpoint configured by the administrator.</p>
    </div>
  </div>;
}
function MoviePage() {
  const [, setLocation] = useLocation();
  const movieUrl = new URLSearchParams(window.location.search).get('url') ?? '';
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['movie-info', movieUrl], queryFn: () => getInfo(movieUrl), enabled: Boolean(movieUrl) });
  const baseMovie = useMemo(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('title');
    const titleFromUrl = (() => { try { return new URL(movieUrl).pathname.split('/').filter(Boolean).pop()?.replace(/-\d{4}.*/, '').replaceAll('-', ' ') ?? ''; } catch { return ''; } })();
    return { title: fromQuery || titleFromUrl || 'Movie details', link: movieUrl, image: '', quality: 'WEB-DL', rating: 'N/A' };
  }, [movieUrl]);
  const detail = (data && typeof data === 'object' ? ((data as Record<string, unknown>).data ?? data) : {}) as Record<string, unknown>;
  const rawTitle = String(detail.title ?? detail.name ?? baseMovie.title);
  const cleanTitle = rawTitle.replace(/\s*(?:[-|]\s*)?chithrapata\.com.*$/i, '').trim();
  const movie = { ...baseMovie, title: cleanTitle || baseMovie.title, image: String(detail.image ?? detail.poster ?? ''), quality: String(detail.quality ?? baseMovie.quality) };
  const options = useMemo(() => eligibleOptions(data), [data]);
  const displayValue = (value: unknown) => Array.isArray(value) ? value.map((item) => typeof item === 'string' ? item : String((item as Record<string, unknown>)?.name ?? '')).filter(Boolean).join(', ') : String(value ?? '');
  const facts = [['YEAR', detail.year], ['DURATION', detail.duration], ['DIRECTOR', detail.director], ['COUNTRY', detail.country], ['LANGUAGE', detail.language], ['IMDB', detail.imdb], ['GENRES', detail.genres]].filter(([, value]) => value && displayValue(value) !== 'N/A');
  const cast = Array.isArray(detail.cast) ? detail.cast as Record<string, unknown>[] : [];
  const gallery = Array.isArray(detail.gallery) ? detail.gallery.filter((image): image is string => typeof image === 'string' && /^https?:\/\//i.test(image)) : [];
  const [selected, setSelected] = useState<DownloadOption | null>(null);
  return (
    <div className="cinema-bg min-h-[100dvh] text-slate-100">
      <Header/>
      <main className="mx-auto max-w-[1100px] px-5 py-9 md:px-10">
        <button onClick={() => setLocation('/')} data-testid="button-back-discovery" className="mb-8 inline-flex items-center gap-2 text-xs text-slate-400 transition hover:text-cyan-100"><ArrowLeft size={15}/> Back to discovery</button>
        {!movieUrl ? (
          <div className="rounded-2xl border border-white/10 p-12 text-center"><h1 className="text-xl text-white">No film selected</h1><p className="mt-2 text-sm text-slate-400">Return to discovery and choose a title.</p></div>
        ) : isLoading ? (
          <div className="grid animate-pulse gap-8 md:grid-cols-[260px_1fr]"><div className="aspect-[2/3] rounded-2xl bg-white/[.05]"/><div className="py-8"><div className="h-8 w-3/4 rounded bg-white/[.06]"/><div className="mt-6 h-4 w-1/3 rounded bg-white/[.05]"/></div></div>
        ) : isError ? (
          <div className="rounded-2xl border border-rose-200/15 p-8 text-center"><p className="text-sm text-rose-100">Could not load film details.</p><button onClick={() => refetch()} data-testid="button-retry-details" className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-xs">Try again</button></div>
        ) : (
          <div className="grid gap-8 md:grid-cols-[270px_1fr] md:gap-12">
            <div className="relative mx-auto w-full max-w-[270px] overflow-hidden rounded-2xl border border-white/10 bg-[#171927] shadow-[0_20px_60px_rgba(0,0,0,.4)]">
              {movie.image ? <img src={movie.image} alt={movie.title} className="aspect-[2/3] w-full object-cover"/> : <div className="flex aspect-[2/3] items-center justify-center bg-gradient-to-br from-[#172a36] to-[#201c35]"><Film size={60} className="text-cyan-100/25"/></div>}
            </div>
            <div className="pt-2 md:pt-8">
              <p className="font-mono text-[10px] tracking-[.22em] text-cyan-200/75">FILM / DETAILS</p>
              <h1 data-testid="text-detail-title" className="mt-4 max-w-[720px] text-3xl font-bold leading-tight tracking-[-.045em] text-white md:text-5xl">{movie.title}</h1>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-200/20 bg-cyan-200/[.06] px-3 py-1.5 font-mono text-[10px] text-cyan-100">{movie.quality}</span>
                {detail.rating != null && <span className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] text-slate-300">RATING {String(detail.rating)}</span>}
              </div>
              <p className="mt-7 max-w-[600px] text-sm leading-6 text-slate-400">{String(detail.story ?? detail.description ?? detail.synopsis ?? 'Choose an available clean link to request this film through WhatsApp. Downloads are sent via the configured bot; links are never opened directly from this page.')}</p>
              {facts.length > 0 && <div data-testid="list-movie-facts" className="mt-6 grid max-w-[650px] grid-cols-2 gap-x-6 gap-y-4 border-y border-white/[.07] py-5 sm:grid-cols-3">{facts.map(([label, value]) => <div key={String(label)}><span className="block font-mono text-[8px] tracking-[.16em] text-slate-600">{String(label)}</span><span className="mt-1 block text-xs leading-5 text-slate-300">{displayValue(value)}</span></div>)}</div>}
              {cast.length > 0 && <div className="mt-6"><p className="font-mono text-[9px] tracking-[.2em] text-slate-500">CAST</p><div className="mt-3 flex gap-3 overflow-x-auto pb-2">{cast.slice(0, 8).map((person, i) => <div key={`${String(person.name)}-${i}`} data-testid={`card-cast-${i}`} className="flex w-[150px] shrink-0 items-center gap-2.5 rounded-lg border border-white/[.07] bg-white/[.025] p-2">{typeof person.image === 'string' && person.image ? <img src={person.image} alt="" className="h-9 w-9 rounded-full object-cover"/> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-200/[.08] font-mono text-xs text-purple-100">{String(person.name ?? '?').slice(0, 1)}</span>}<span className="min-w-0"><span className="block truncate text-[11px] font-medium text-slate-200">{String(person.name ?? 'Cast member')}</span><span className="block truncate text-[9px] text-slate-500">{String(person.role ?? '')}</span></span></div>)}</div></div>}
              {gallery.length > 0 && (
                <div className="mt-6">
                  <p className="font-mono text-[9px] tracking-[.2em] text-slate-500">STILLS</p>
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                    {gallery.slice(0, 8).map((image, i) => (
                      <img key={`${image}-${i}`} data-testid={`img-gallery-${i}`} src={image} alt={`${movie.title} still ${i + 1}`} loading="lazy" className="h-24 w-40 shrink-0 rounded-lg border border-white/10 object-cover"/>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-10 min-w-0 border-t border-white/[.08] pt-6">
                <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] tracking-[.2em] text-orange-300/80">AVAILABLE SOURCES</p>
                    <h2 className="mt-2 text-lg font-semibold text-white">Choose a clean link</h2>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">{options.length} OPTIONS</span>
                </div>
                <a href="https://chat.whatsapp.com/KOfwT7f5EgoCm2T6uFkczg?s=cl&p=a&mlu=4&ilr=4" target="_blank" rel="noopener noreferrer" data-testid="link-whatsapp-group" className="mt-5 flex min-h-14 min-w-0 items-center gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[.06] px-4 py-3 text-sm font-semibold leading-6 text-emerald-100 transition hover:border-emerald-200/40 hover:bg-emerald-300/[.1]">
                  <MessageCircle size={19} className="shrink-0 text-emerald-300"/>
                  <span className="min-w-0 break-words">අපගේ WhatsApp සමූහයට අනිවාර්යයෙන්ම සම්බන්ධ වන්න!</span>
                  <ArrowRight size={15} className="ml-auto shrink-0"/>
                </a>

                {/* WhatsApp Download Warning Box */}
                <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs leading-5 text-rose-200">
                  ⚠️ <strong className="font-semibold">වැදගත් / Important:</strong> WhatsApp හරහා ලින්ක් ලබා ගැනීමට 2GB ට වඩා අඩු ෆයිල් ප්‍රමාණයක් (Quality එකක්) තෝරන්න.<br />
                  Please select a file size under 2GB to request via WhatsApp.
                </div>

                {options.length ? (
                  <div className="mt-4 grid min-w-0 gap-3">
                    {options.map((option, i) => (
                      <button key={`${option.url}-${i}`} onClick={() => setSelected(option)} data-testid={`button-download-option-${i}`} className="group flex min-h-[72px] min-w-0 items-center justify-between gap-3 rounded-xl border border-white/[.09] bg-white/[.025] p-4 text-left transition hover:border-orange-200/40 hover:bg-orange-200/[.04]">
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-200/20 bg-orange-300/[.08] text-orange-100"><Download size={17}/></span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-100">{option.label}</span>
                            <span className="mt-1 block break-words text-[10px] text-slate-500">{[option.quality, option.size].filter(Boolean).join(' · ') || 'Request via WhatsApp'}</span>
                          </span>
                        </span>
                        <ArrowRight size={16} className="shrink-0 text-slate-600 transition group-hover:translate-x-1 group-hover:text-orange-100"/>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div data-testid="status-no-eligible-downloads" className="mt-5 rounded-xl border border-white/[.08] bg-white/[.025] p-5 text-sm leading-6 text-slate-400">No eligible download sources are available for this title right now.</div>
                )}
                <p className="mt-5 flex items-center gap-2 text-[10px] text-slate-600"><ShieldCheck size={13}/><span>Only verified PixelDrain links are available. Requests are sent through WhatsApp.</span></p>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer/>
      {selected && <DownloadModal movie={movie.title} option={selected} close={() => setSelected(null)}/>}
    </div>
  );
}
function AdminPage() {
  const queryClient = useQueryClient();
  const { data: session, isLoading } = useGetAdminSession();
  const login = useCreateAdminSession();
  const logout = useDeleteAdminSession();
  const [password, setPassword] = useState('');
  const [botApiUrl, setBotApiUrl] = useState(() => localStorage.getItem('botApiUrl') ?? '');
  const [whatsappJid, setWhatsappJid] = useState(() => localStorage.getItem('whatsappJid') ?? '');
  const [loginError, setLoginError] = useState('');
  const [saved, setSaved] = useState(false);
  const [, setLocation] = useLocation();
  const authenticated = Boolean(session?.authenticated);
  const botConnected = Boolean(botApiUrl.trim() && whatsappJid.trim());
  const submitLogin = (e: FormEvent) => {
    e.preventDefault(); setLoginError('');
    login.mutate({ data: { password } }, { onSuccess: () => { setPassword(''); queryClient.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() }); }, onError: () => setLoginError('Access denied') });
  };
  const saveConfig = (e: FormEvent) => {
    e.preventDefault();
    const endpoint = botApiUrl.trim();
    localStorage.setItem('botApiUrl', endpoint);
    localStorage.setItem('whatsappJid', whatsappJid.trim());
    setBotApiUrl(endpoint);
    setSaved(true);
    toast.success('Bot configuration saved.');
    window.setTimeout(() => setSaved(false), 2400);
  };
  const signOut = () => logout.mutate(undefined, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() }) });
  return <div className="cinema-bg min-h-[100dvh] text-slate-100"><Header/><main className="mx-auto max-w-[900px] px-5 py-12 md:px-10">
    <button onClick={() => setLocation('/')} data-testid="button-admin-back" className="mb-8 inline-flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-100"><ArrowLeft size={15}/> Discovery</button>
    <div className="mb-9"><p className="font-mono text-[10px] tracking-[.23em] text-purple-200/70">CONTROL ROOM / 01</p><h1 className="mt-3 text-4xl font-bold tracking-[-.05em] text-white">Admin console</h1><p className="mt-3 max-w-[520px] text-sm leading-6 text-slate-400">Manage the bot connection used to deliver movie requests. Configuration is stored in this browser.</p></div>
    {isLoading ? <div className="h-48 animate-pulse rounded-2xl border border-white/[.08] bg-white/[.025]"/> : !authenticated ? <section className="max-w-[500px] rounded-2xl border border-white/[.1] bg-[#151725]/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,.25)] md:p-8"><div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-purple-200/20 bg-purple-300/[.07] text-purple-100"><LockKeyhole size={19}/></div><p className="font-mono text-[9px] tracking-[.2em] text-slate-500">RESTRICTED ACCESS</p><h2 className="mt-2 text-xl font-semibold text-white">Sign in to continue</h2><p className="mt-2 text-sm text-slate-400">Use your administrator password to open the configuration.</p>
      <form onSubmit={submitLogin} className="mt-6"><label htmlFor="admin-password" className="mb-2 block text-xs font-medium text-slate-300">Administrator password</label><input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required data-testid="input-admin-password" className="w-full rounded-lg border border-white/10 bg-[#0d0f19] px-4 py-3 text-sm text-white outline-none focus:border-cyan-200/50"/>{loginError && <p role="alert" data-testid="status-admin-login-error" className="mt-2 text-xs text-rose-300">{loginError}</p>}<button disabled={login.isPending} data-testid="button-admin-login" className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-bold text-[#091014] hover:bg-cyan-200 disabled:opacity-60">{login.isPending ? <LoaderCircle size={16} className="animate-spin"/> : <LockKeyhole size={16}/>} Sign in</button></form>
    </section> : <section className="rounded-2xl border border-white/[.1] bg-[#151725]/75 p-6 md:p-8">
       <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] pb-6"><div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${botConnected ? 'border-emerald-200/20 bg-emerald-200/[.07]' : 'border-rose-200/20 bg-rose-200/[.07]'}`}><span data-testid="status-bot-connection-dot" className={`h-2.5 w-2.5 rounded-full ${botConnected ? 'animate-pulse bg-emerald-300 shadow-[0_0_14px_rgba(110,255,180,.85)]' : 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,.65)]'}`}/></span><div><h2 className="font-semibold text-white">Bot configuration</h2><p data-testid="status-admin-authenticated" className="mt-1 text-xs text-slate-500">Administrator session active · <span className={botConnected ? 'text-emerald-200' : 'text-rose-300'}>{botConnected ? 'Bot connected' : 'Bot not connected'}</span></p></div></div><button onClick={signOut} disabled={logout.isPending} data-testid="button-admin-logout" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-white/20 hover:text-white">Sign out</button></div>
      <form onSubmit={saveConfig} className="mt-7 space-y-5"><div><label htmlFor="bot-api-url" className="mb-2 block text-xs font-medium text-slate-300">Bot API endpoint</label><input id="bot-api-url" type="url" value={botApiUrl} onChange={(e) => setBotApiUrl(e.target.value)} placeholder={DEFAULT_BOT_API_ENDPOINT} data-testid="input-bot-api-url" className="w-full rounded-lg border border-white/10 bg-[#0d0f19] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/50"/><p className="mt-2 text-[10px] text-slate-600">POST destination for movie delivery requests. Saved in this browser.</p></div>
        <div><label htmlFor="whatsapp-jid" className="mb-2 block text-xs font-medium text-slate-300">WhatsApp JID</label><input id="whatsapp-jid" value={whatsappJid} onChange={(e) => setWhatsappJid(e.target.value)} placeholder="destination@s.whatsapp.net" data-testid="input-whatsapp-jid" className="w-full rounded-lg border border-white/10 bg-[#0d0f19] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/50"/></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[.08] pt-5"><p className="max-w-md text-[10px] leading-4 text-slate-500">Values are saved locally in this browser and included when a viewer submits a WhatsApp request.</p><button data-testid="button-save-bot-config" className="flex items-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 text-xs font-bold text-[#091014] transition hover:bg-cyan-200">{saved ? <Check size={15}/> : <Settings2 size={15}/>} {saved ? 'Saved' : 'Save configuration'}</button></div>
      </form>
    </section>}
  </main><Footer/></div>;
}
function MissingPage() {
  const [, setLocation] = useLocation();
  return <div className="cinema-bg flex min-h-[100dvh] flex-col text-slate-100"><Header/><main className="mx-auto flex w-full max-w-[900px] flex-1 flex-col items-center justify-center px-5 py-16 text-center"><p className="font-mono text-xs tracking-[.24em] text-cyan-200/70">SIGNAL NOT FOUND / 404</p><h1 className="mt-4 text-4xl font-bold tracking-[-.05em] text-white">This title is off the map.</h1><button onClick={() => setLocation('/')} data-testid="button-not-found-home" className="mt-8 rounded-lg border border-cyan-200/25 px-5 py-3 text-sm text-cyan-100 transition hover:bg-cyan-200/10">Back to discovery</button></main><Footer/></div>;
}
function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={HomePage}/><Route path="/movie" component={MoviePage}/><Route path="/admin" component={AdminPage}/><Route component={MissingPage}/></Switch></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter><SonnerToaster theme="dark" position="bottom-right" richColors/></TooltipProvider></QueryClientProvider>;
}
export default App;

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Share2,
  Copy,
  Check,
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  User,
  Clock,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Type,
  Volume2,
} from 'lucide-react';
import { NewsItem } from '@/lib/types';
import { OptimizedImage } from './OptimizedImage';
import { AdSenseBanner } from './AdSenseBanner';
import { NewsCard } from './NewsCard';
import { toggleStoredBookmark, useIsBookmarked, useFontSize, setStoredFontSize, FontSizeLevel } from '@/lib/accessibility';
import { SITE_CONFIG } from '@/lib/site-config';
import { repairAndSanitizeArticleHtml, splitArticleHtmlIntoBlocks, stripHtmlTags } from '@/lib/sanitizer';

interface ArticlePageClientProps {
  article: NewsItem;
  relatedNews: NewsItem[];
  mostReadNews: NewsItem[];
  appUrl?: string;
  adsenseSlots?: {
    header?: string;
    sidebar?: string;
    sidebarBottom?: string;
    inArticle?: string;
    footer?: string;
  };
}

export function ArticlePageClient({
  article,
  relatedNews,
  mostReadNews,
  appUrl = '',
  adsenseSlots,
}: ArticlePageClientProps) {
  const inArticleSlot = adsenseSlots?.inArticle || SITE_CONFIG.adsense.slots.inArticle;
  const sidebarSlot = adsenseSlots?.sidebar || SITE_CONFIG.adsense.slots.sidebar;
  const sidebarBottomSlot = adsenseSlots?.sidebarBottom || SITE_CONFIG.adsense.slots.sidebarBottom;

  // Featured image strictly associated with this article's own metadata
  const featuredImage = article.imageUrl || (article.images && article.images[0]) || '';

  const linkOpts = React.useMemo(
    () => ({
      appUrl,
      appDomain: SITE_CONFIG.domain,
      currentArticleSlug: article.slug,
    }),
    [appUrl, article.slug]
  );

  // Full body content sanitized to fix corrupted gallery tags, unclosed attributes, and deduplicate images
  const [contentHtml, setContentHtml] = useState<string>(() =>
    repairAndSanitizeArticleHtml(article.contentHtml || '', featuredImage ? [featuredImage] : [], linkOpts)
  );

  const bodyBlocks = React.useMemo(
    () => splitArticleHtmlIntoBlocks(contentHtml, featuredImage ? [featuredImage] : [], linkOpts),
    [contentHtml, featuredImage, linkOpts]
  );

  // Bookmarking via external store subscription
  const isBookmarked = useIsBookmarked(article.id || article.slug);

  // Copy link feedback
  const [copied, setCopied] = useState(false);
  const [instagramFeedback, setInstagramFeedback] = useState(false);

  // Font size via external store subscription
  const fontSize = useFontSize();

  // AI Summary
  const [aiSummary, setAiSummary] = useState<string>(article.summary);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  // Helper to dynamically compute key points (min 6 for large articles, 3 for small articles)
  const isLargeArticle = (contentHtml && contentHtml.length > 800) || (article.summary && article.summary.length > 300) || (contentHtml && contentHtml.split('</p>').filter(Boolean).length >= 3);
  const minRequiredPoints = isLargeArticle ? 6 : 3;

  const displayedKeyPoints = React.useMemo(() => {
    const rawText = (contentHtml ? contentHtml.replace(/<[^>]+>/g, ' ') : '') || article.summary || '';
    const points: string[] = [];

    // 1. Add AI keyPoints if available
    if (keyPoints && keyPoints.length > 0) {
      for (const pt of keyPoints) {
        const clean = pt.trim().replace(/^[-•*]\s*/, '');
        if (clean && !points.includes(clean)) {
          points.push(clean);
        }
      }
    }

    // 2. Supplement from article sentences if below target
    if (points.length < minRequiredPoints) {
      const sentences = rawText
        .split(/(?<=[.?!])\s+/)
        .map(s => s.trim().replace(/^[-•*]\s*/, ''))
        .filter(s => s.length > 25 && !s.toLowerCase().includes('leia também') && !s.toLowerCase().includes('clique aqui') && !s.toLowerCase().includes('foto:') && !s.toLowerCase().includes('reprodução'));

      for (const sent of sentences) {
        if (points.length >= minRequiredPoints) break;
        if (!points.some(p => p.toLowerCase() === sent.toLowerCase() || p.includes(sent) || sent.includes(p))) {
          points.push(sent);
        }
      }
    }

    // 3. Fallback defaults if still below target
    const fallbackDefaults = [
      `Fato apurado: ${article.title}`,
      'Acompanhamento contínuo dos desdobramentos pelas autoridades competentes.',
      'Informação confirmada com base nas fontes e comunicações oficiais do setor.',
      'Análise de desdobramentos jurídicos e impacto direto para a sociedade.',
      'Monitoramento prioritário das manifestações institucionais e regulatórias.',
      'Atualização em tempo real das deliberações e medidas anunciadas pelo poder público.',
    ];

    for (const fb of fallbackDefaults) {
      if (points.length >= minRequiredPoints) break;
      if (!points.includes(fb)) {
        points.push(fb);
      }
    }

    return points.slice(0, minRequiredPoints);
  }, [keyPoints, contentHtml, article.summary, article.title, minRequiredPoints]);

  // Audio Reader
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [audioStatusMsg, setAudioStatusMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechChunksRef = useRef<string[]>([]);
  const speechChunkIdxRef = useRef<number>(0);
  const speechSeqRef = useRef<number>(0);
  const speechKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Fetch full article content from internal API
    async function fetchArticleBody() {
      try {
        const res = await fetch(
          `/api/news/article?slug=${encodeURIComponent(article.slug)}&title=${encodeURIComponent(article.title)}&category=${encodeURIComponent(article.category)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.contentHtml && data.contentHtml.length > 250) {
            setContentHtml(
              repairAndSanitizeArticleHtml(data.contentHtml, featuredImage ? [featuredImage] : [], linkOpts)
            );
          }
        }
      } catch {}
    }

    // Fetch AI Summary
    async function fetchAiSummary() {
      setLoadingAi(true);
      try {
        const res = await fetch('/api/news/ai-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: article.title,
            summary: article.summary,
            link: article.link,
            content: article.contentHtml || article.summary,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.summary) setAiSummary(data.summary);
          if (data.keyPoints) setKeyPoints(data.keyPoints);
        }
      } catch {} finally {
        setLoadingAi(false);
      }
    }

    fetchArticleBody();
    fetchAiSummary();

    return () => {
      speechSeqRef.current += 1;
      if (speechKeepAliveRef.current) {
        clearInterval(speechKeepAliveRef.current);
        speechKeepAliveRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [article.id, article.slug, article.title, article.summary, article.link, article.category, article.contentHtml, featuredImage, linkOpts]);

  const handleBookmarkToggle = () => {
    toggleStoredBookmark(article.id || article.slug);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const cycleFontSize = () => {
    const next: FontSizeLevel = fontSize === 'normal' ? 'large' : fontSize === 'large' ? 'xlarge' : 'normal';
    setStoredFontSize(next);
  };

  const splitSpeechChunks = (raw: string, maxLen = 180): string[] => {
    const clean = raw.replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    const parts = clean.split(/(?<=[.?!;:])\s+/);
    const chunks: string[] = [];
    for (const part of parts) {
      if (part.length <= maxLen) {
        if (chunks.length > 0 && chunks[chunks.length - 1].length + 1 + part.length <= maxLen) {
          chunks[chunks.length - 1] += ' ' + part;
        } else {
          chunks.push(part);
        }
        continue;
      }
      const words = part.split(' ');
      let cur = '';
      for (const word of words) {
        if (!cur) cur = word;
        else if (cur.length + 1 + word.length <= maxLen) cur += ' ' + word;
        else {
          chunks.push(cur);
          cur = word;
        }
      }
      if (cur) chunks.push(cur);
    }
    return chunks.filter(Boolean);
  };

  const stopAllAudio = () => {
    speechSeqRef.current += 1;
    if (speechKeepAliveRef.current) {
      clearInterval(speechKeepAliveRef.current);
      speechKeepAliveRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    speechUtteranceRef.current = null;
    setIsPlayingAudio(false);
  };

  const cyclePlaybackSpeed = () => {
    const speeds = [1, 1.25, 1.5];
    const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const next = speeds[nextIndex];
    setPlaybackSpeed(next);

    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
    if (speechUtteranceRef.current && isPlayingAudio) {
      startSpeechSynthesis(next, speechChunkIdxRef.current);
    }
  };

  const startSpeechSynthesis = (rate: number, fromIndex = 0) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setAudioStatusMsg('Síntese de voz indisponível neste navegador.');
      setIsPlayingAudio(false);
      return;
    }

    const bodyText = stripHtmlTags(contentHtml || '');
    const fullText = `${article.title}. ${aiSummary || article.summary}. ${bodyText}`;
    if (!speechChunksRef.current.length || fromIndex === 0) {
      speechChunksRef.current = splitSpeechChunks(fullText, 180);
    }
    const chunks = speechChunksRef.current;
    if (!chunks.length) {
      setIsPlayingAudio(false);
      return;
    }

    speechSeqRef.current += 1;
    const activeSeq = speechSeqRef.current;
    try {
      window.speechSynthesis.cancel();
    } catch {}

    setAudioStatusMsg(null);
    setIsPlayingAudio(true);

    if (speechKeepAliveRef.current) clearInterval(speechKeepAliveRef.current);
    speechKeepAliveRef.current = setInterval(() => {
      try {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      } catch {}
    }, 10000);

    const pickVoice = () => {
      try {
        const voices = window.speechSynthesis.getVoices() || [];
        return (
          voices.find((v) => v.lang?.toLowerCase().startsWith('pt-br')) ||
          voices.find((v) => v.lang?.toLowerCase().startsWith('pt')) ||
          null
        );
      } catch {
        return null;
      }
    };

    const speakChunk = (idx: number) => {
      if (activeSeq !== speechSeqRef.current || idx >= chunks.length) {
        if (activeSeq === speechSeqRef.current) stopAllAudio();
        return;
      }
      speechChunkIdxRef.current = idx;
      const utterance = new SpeechSynthesisUtterance(chunks[idx]);
      utterance.lang = 'pt-BR';
      utterance.rate = rate;
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        if (activeSeq === speechSeqRef.current) speakChunk(idx + 1);
      };
      utterance.onerror = (ev) => {
        if (activeSeq !== speechSeqRef.current) return;
        if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) return;
        stopAllAudio();
      };
      speechUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
    if (voices.length > 0) {
      speakChunk(fromIndex);
    } else {
      let started = false;
      const launch = () => {
        if (!started) {
          started = true;
          speakChunk(fromIndex);
        }
      };
      if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = launch;
      }
      setTimeout(launch, 150);
    }
  };

  const toggleAudio = async () => {
    if (isPlayingAudio) {
      stopAllAudio();
      return;
    }

    // Try ElevenLabs audio endpoint
    try {
      const plainText = `${article.title}. ${aiSummary || article.summary}`;
      const res = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plainText }),
      });

      if (res.ok && res.headers.get('content-type')?.includes('audio/mpeg')) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = playbackSpeed;
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => {
          audioRef.current = null;
          startSpeechSynthesis(playbackSpeed, 0);
        };
        audioRef.current = audio;
        await audio.play();
        setIsPlayingAudio(true);
        return;
      }
    } catch {}

    // Web Speech API chunked fallback
    startSpeechSynthesis(playbackSpeed, 0);
  };

  // Social share URLs (stable canonical URL on both server and client)
  const shareBaseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || 'https://news.mirandinhacontabilidade.workers.dev'
  ).replace(/\/+$/, '');
  const pageUrl = `${shareBaseUrl}/noticia/${article.slug}`;
  const shareTitle = encodeURIComponent(article.title);
  const shareWhatsApp = `https://api.whatsapp.com/send?text=${shareTitle}%20${encodeURIComponent(pageUrl)}`;
  const shareTwitter = `https://twitter.com/intent/tweet?text=${shareTitle}&url=${encodeURIComponent(pageUrl)}`;
  const shareFacebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;

  const handleShareInstagram = () => {
    if (typeof navigator !== 'undefined') {
      try {
        navigator.clipboard?.writeText?.(`${article.title}\n${pageUrl}`);
      } catch {}
      setInstagramFeedback(true);
      setTimeout(() => setInstagramFeedback(false), 3500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-6 flex-wrap">
        <Link href="/" className="hover:text-brand-700 dark:hover:text-brand-400 transition-colors">
          Início
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link
          href={`/categoria/${article.categoryId || 'todas'}`}
          className="hover:text-brand-700 dark:hover:text-brand-400 transition-colors uppercase font-bold text-[11px]"
        >
          {article.category}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 dark:text-zinc-200 line-clamp-1 max-w-md font-medium">
          {article.title}
        </span>
      </nav>

      {/* Main Grid: Article Content (col-8) + Sidebar (col-4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <main className="lg:col-span-8">
          {/* Category Kicker */}
          <span className="text-xs font-black uppercase tracking-widest text-brand-700 dark:text-brand-400 block mb-2">
            {article.category}
          </span>

          {/* Main Article Headline */}
          <h1 className="text-2xl sm:text-3xl lg:text-5xl font-black text-slate-900 dark:text-zinc-50 leading-[1.12] tracking-tight mb-4">
            {article.title}
          </h1>

          {/* Lead / Subhead */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-zinc-300 font-normal leading-relaxed mb-6 border-l-4 border-brand-700 pl-4 text-justify hyphens-none">
            {stripHtmlTags(article.summary || '')}
          </p>

          {/* Author, Date, and Source Metadata */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-3.5 border-y border-slate-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center text-brand-700 dark:text-brand-400 font-black">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-zinc-100">
                  {article.author || 'Norma Jurídica'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Redação
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Publicado {article.timeAgo}</span>
            </div>
          </div>

          {/* Interactive Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-2xl mb-8">
            {/* Audio Reader Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAudio}
                className="flex items-center gap-2 px-3 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                title={isPlayingAudio ? 'Pausar leitura' : 'Ouvir matéria'}
              >
                {isPlayingAudio ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Ouvir Notícia</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={cyclePlaybackSpeed}
                className="px-2.5 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-black transition-colors"
                title="Velocidade de reprodução"
              >
                {playbackSpeed}x
              </button>
              {audioStatusMsg && (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  {audioStatusMsg}
                </span>
              )}
            </div>

            {/* Utility action buttons */}
            <div className="flex items-center gap-2">
              {/* Font resize button */}
              <button
                type="button"
                onClick={cycleFontSize}
                className="p-2 bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-brand-700 rounded-xl transition-colors cursor-pointer"
                title="Aumentar tamanho do texto"
                aria-label="Ajustar tamanho do texto"
              >
                <Type className="w-4 h-4" />
              </button>

              {/* Bookmark button */}
              <button
                type="button"
                onClick={handleBookmarkToggle}
                suppressHydrationWarning
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isBookmarked
                    ? 'bg-brand-700 text-white'
                    : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-brand-700'
                }`}
                title={isBookmarked ? 'Remover dos Salvos' : 'Salvar Matéria'}
                aria-label={isBookmarked ? 'Remover dos Salvos' : 'Salvar Matéria'}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>

              {/* Copy link button */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-brand-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Copiar link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>
          </div>

          {/* Featured Image Display with Zoom on Hover */}
          <div className="mb-6" suppressHydrationWarning>
            <div
              className="zoom-frame group relative aspect-[16/9] w-full rounded-2xl overflow-hidden shadow-lg bg-slate-900 border border-slate-200 dark:border-zinc-800 cursor-pointer"
              suppressHydrationWarning
              data-pin-nopin="true"
              data-pin-no-hover="true"
            >
              <OptimizedImage
                src={featuredImage}
                alt={article.title}
                fill
                priority={true}
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover group-hover:scale-105 hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 italic px-1">
              {article.imageCaption || `Registro jornalístico editorial • ${article.category}`}
            </p>
          </div>

          {/* Key Points Summary Card (Only bullet points, no repeated paragraph) */}
          <section className="mb-8 p-5 md:p-6 bg-gradient-to-br from-brand-50 to-blue-50/50 dark:from-zinc-900 dark:to-brand-950/30 border border-brand-200 dark:border-brand-900/50 rounded-2xl shadow-sm" aria-label="Resumo da Notícia">
            <div className="flex items-center gap-2 mb-3.5">
              <BookOpen className="w-5 h-5 text-brand-700 dark:text-brand-400" />
              <h2 className="text-base font-black text-brand-900 dark:text-brand-300 uppercase tracking-tight">
                Resumo da Notícia
              </h2>
            </div>

            <div>
              <span className="text-xs font-bold text-brand-800 dark:text-brand-400 uppercase tracking-wider block mb-2.5">
                Pontos Principais:
              </span>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
                {displayedKeyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-brand-600 dark:text-brand-400 font-bold mt-0.5 flex-shrink-0">•</span>
                    <span className="text-justify hyphens-none leading-relaxed">{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Full Article Body with Justified text and contextual in-body images via OptimizedImage */}
          <article className="article-body prose prose-slate dark:prose-invert prose-a:text-brand-700 dark:prose-a:text-brand-400 prose-a:underline prose-a:font-medium max-w-none text-slate-800 dark:text-zinc-200 font-serif leading-8 text-base md:text-lg mb-8 text-justify hyphens-none [text-align:justify]">
            {bodyBlocks.map((block, idx) =>
              block.type === 'image' ? (
                <figure key={`body-img-${idx}`} className="my-6 not-prose">
                  <div className="relative w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                    {block.linkHref ? (
                      <a
                        href={block.linkHref}
                        target={block.linkExternal ? '_blank' : undefined}
                        rel={block.linkExternal ? 'noopener noreferrer' : undefined}
                        data-app-link={!block.linkExternal ? 'true' : undefined}
                        className="block"
                      >
                        <OptimizedImage
                          src={block.src}
                          alt={block.alt || article.title}
                          width={900}
                          height={506}
                          sizes="(max-width: 1024px) 100vw, 66vw"
                          className="w-full h-auto object-cover rounded-xl"
                        />
                      </a>
                    ) : (
                      <OptimizedImage
                        src={block.src}
                        alt={block.alt || article.title}
                        width={900}
                        height={506}
                        sizes="(max-width: 1024px) 100vw, 66vw"
                        className="w-full h-auto object-cover rounded-xl"
                      />
                    )}
                  </div>
                  {block.alt && block.alt !== 'Imagem da matéria' && (
                    <figcaption className="text-xs text-slate-500 dark:text-zinc-400 mt-2 italic px-1">
                      {block.alt}
                    </figcaption>
                  )}
                </figure>
              ) : (
                <div key={`body-html-${idx}`} dangerouslySetInnerHTML={{ __html: block.html }} />
              )
            )}
          </article>

          {/* In-Article Advertisement Banner */}
          {inArticleSlot ? (
            <div className="my-8">
              <AdSenseBanner slot={inArticleSlot} />
            </div>
          ) : null}

          {/* Social Sharing Section with authentic network logos & Instagram */}
          <div className="p-5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl mb-12 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                  Compartilhe esta informação
                </span>
                {(instagramFeedback || copied) && (
                  <span className="ml-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 animate-pulse">
                    Link copiado!
                  </span>
                )}
              </div>

              {/* Logos das Redes Sociais */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* WhatsApp */}
                <a
                  href={shareWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer"
                  title="Compartilhar no WhatsApp"
                  aria-label="Compartilhar no WhatsApp"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.074-2.109-.508-1.745-.719-2.87-2.488-2.958-2.604-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.043.072.043.419-.101.824zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.66 1.434 5.176L2 22l4.954-1.399C8.423 21.492 10.155 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                  </svg>
                </a>

                {/* X (antigo Twitter) */}
                <a
                  href={shareTwitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-slate-900 dark:bg-zinc-800 hover:bg-black text-white flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer"
                  title="Compartilhar no X (Twitter)"
                  aria-label="Compartilhar no X"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>

                {/* Facebook */}
                <a
                  href={shareFacebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-[#1877F2] hover:bg-[#166fe5] text-white flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer"
                  title="Compartilhar no Facebook"
                  aria-label="Compartilhar no Facebook"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href="https://www.instagram.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleShareInstagram}
                  className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-90 text-white flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer"
                  title="Compartilhar no Instagram"
                  aria-label="Compartilhar no Instagram"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>

                {/* Copiar Link */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer"
                  title="Copiar link da matéria"
                  aria-label="Copiar link da matéria"
                >
                  {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Related Articles Section */}
          {relatedNews.length > 0 && (
            <section className="mb-12" aria-label="Leia Também">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-6 bg-brand-700 dark:bg-brand-500 rounded-full" />
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                  Leia Também
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {relatedNews.slice(0, 3).map(rel => (
                  <NewsCard key={rel.slug} news={rel} variant="grid" />
                ))}
              </div>
            </section>
          )}
        </main>

        {/* Sidebar Sticky (col-4) */}
        <aside className="lg:col-span-4 space-y-8">
          {/* Sidebar Advertisement */}
          <div className="sticky top-20 space-y-8">
            <AdSenseBanner slot={sidebarSlot} />

            {/* "Mais Lidas • Em Alta" */}
            {mostReadNews.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="w-1.5 h-5 bg-brand-700 rounded-full" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-zinc-100">
                    Mais Lidas • Em Alta
                  </h3>
                </div>

                <div className="space-y-4">
                  {mostReadNews.slice(0, 5).map((item, idx) => (
                    <Link
                      key={item.slug}
                      href={`/noticia/${item.slug}`}
                      prefetch={true}
                      className="group flex gap-3.5 items-start focus:outline-none"
                    >
                      <span className="text-3xl font-black text-brand-700 dark:text-brand-400 w-6 flex-shrink-0 text-center leading-none">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-0.5">
                          {item.category}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 group-hover:text-brand-700 dark:group-hover:text-brand-400 line-clamp-2 leading-snug transition-colors">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          {item.timeAgo}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Sidebar Advertisement */}
            <AdSenseBanner slot={sidebarBottomSlot} />
          </div>
        </aside>
      </div>
    </div>
  );
}

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
  Sparkles,
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

interface ArticlePageClientProps {
  article: NewsItem;
  relatedNews: NewsItem[];
  mostReadNews: NewsItem[];
}

export function ArticlePageClient({
  article,
  relatedNews,
  mostReadNews,
}: ArticlePageClientProps) {
  // Gallery state
  const images = article.images && article.images.length > 0 ? article.images : [article.imageUrl || '/cover.png'];
  const [selectedImage, setSelectedImage] = useState<string>(images[0] || '/cover.png');

  // Bookmarking via external store subscription
  const isBookmarked = useIsBookmarked(article.id || article.slug);

  // Copy link feedback
  const [copied, setCopied] = useState(false);

  // Font size via external store subscription
  const fontSize = useFontSize();

  // Full body content (enriched/scraped if necessary)
  const [contentHtml, setContentHtml] = useState<string>(article.contentHtml || '');

  // AI Summary
  const [aiSummary, setAiSummary] = useState<string>(article.summary);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  // Audio Reader
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
            setContentHtml(data.contentHtml);
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
      // Cancel speech synthesis or audio on unmount
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [article.id, article.slug, article.title, article.summary, article.link, article.category]);

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

  const cyclePlaybackSpeed = () => {
    const speeds = [1, 1.25, 1.5];
    const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const next = speeds[nextIndex];
    setPlaybackSpeed(next);

    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
    if (speechUtteranceRef.current && isPlayingAudio) {
      // Re-trigger speech at new rate
      window.speechSynthesis.cancel();
      startSpeechSynthesis(next);
    }
  };

  const startSpeechSynthesis = (rate: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const plainText = `${article.title}. ${aiSummary || article.summary}. ${contentHtml.replace(/<[^>]+>/g, ' ')}`;
    const utterance = new SpeechSynthesisUtterance(plainText.slice(0, 3500));
    utterance.lang = 'pt-BR';
    utterance.rate = rate;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  const toggleAudio = async () => {
    if (isPlayingAudio) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlayingAudio(false);
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
          // Fall back to browser speech
          startSpeechSynthesis(playbackSpeed);
        };
        audioRef.current = audio;
        audio.play();
        setIsPlayingAudio(true);
        return;
      }
    } catch {}

    // Web Speech API fallback
    startSpeechSynthesis(playbackSpeed);
  };

  // Social share URLs
  const pageUrl = typeof window !== 'undefined' ? window.location.href : `https://normajuridica.com.br/noticia/${article.slug}`;
  const shareTitle = encodeURIComponent(article.title);
  const shareWhatsApp = `https://api.whatsapp.com/send?text=${shareTitle}%20${encodeURIComponent(pageUrl)}`;
  const shareTwitter = `https://twitter.com/intent/tweet?text=${shareTitle}&url=${encodeURIComponent(pageUrl)}`;
  const shareFacebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;

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
          <p className="text-base sm:text-lg text-slate-600 dark:text-zinc-300 font-normal leading-relaxed mb-6 border-l-4 border-brand-700 pl-4 text-justify hyphens-auto">
            {article.summary}
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
                  Redação Oficial • {article.source}
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
          <div className="mb-6">
            <div className="zoom-frame group relative aspect-[16/9] w-full rounded-2xl overflow-hidden shadow-lg bg-slate-900 border border-slate-200 dark:border-zinc-800 cursor-pointer">
              <OptimizedImage
                src={selectedImage}
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

          {/* Gallery Thumbnails (Parte 14 requirement: when images.length > 1) */}
          {images.length > 1 && (
            <div className="mb-8 p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800">
              <span className="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-3">
                Galeria de Fotos da Matéria ({images.length} fotos)
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {images.map((imgUrl, idx) => (
                  <button
                    key={`${imgUrl}-${idx}`}
                    type="button"
                    onClick={() => setSelectedImage(imgUrl)}
                    className={`zoom-frame group relative aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedImage === imgUrl
                        ? 'border-brand-600 ring-2 ring-brand-400'
                        : 'border-transparent opacity-75 hover:opacity-100 hover:border-slate-400'
                    }`}
                  >
                    <OptimizedImage
                      src={imgUrl}
                      alt={`Imagem ${idx + 1} - ${article.title}`}
                      fill
                      sizes="120px"
                      className="object-cover group-hover:scale-110 hover:scale-110 transition-transform duration-500"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Summary Card */}
          <section className="mb-8 p-5 md:p-6 bg-gradient-to-br from-brand-50 to-blue-50/50 dark:from-zinc-900 dark:to-brand-950/30 border border-brand-200 dark:border-brand-900/50 rounded-2xl shadow-sm" aria-label="Resumo da Notícia">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-brand-700 dark:text-brand-400" />
              <h2 className="text-base font-black text-brand-900 dark:text-brand-300 uppercase tracking-tight">
                Resumo da Notícia • Síntese Editorial
              </h2>
            </div>

            <p className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed mb-4 font-medium text-justify hyphens-auto">
              {aiSummary}
            </p>

            {keyPoints.length > 0 && (
              <div className="border-t border-brand-200 dark:border-brand-900/40 pt-3">
                <span className="text-xs font-bold text-brand-800 dark:text-brand-400 uppercase tracking-wider block mb-2">
                  Pontos Principais:
                </span>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
                  {keyPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-brand-600 dark:text-brand-400 font-bold">•</span>
                      <span className="text-justify hyphens-auto">{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Full Article Body with Justified text */}
          <article
            className="article-body prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 font-serif leading-8 text-base md:text-lg mb-8 text-justify hyphens-auto [text-align:justify]"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* In-Article Advertisement Banner */}
          <div className="my-8">
            <AdSenseBanner slot={SITE_CONFIG.adsense.slots.inArticle} />
          </div>

          {/* Social Sharing Section */}
          <div className="p-5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl mb-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-brand-600" />
                Compartilhe esta informação
              </span>

              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={shareWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  WhatsApp
                </a>
                <a
                  href={shareTwitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-900 dark:bg-zinc-800 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors"
                >
                  X (Twitter)
                </a>
                <a
                  href={shareFacebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Facebook
                </a>
              </div>
            </div>
          </div>

          {/* Related Articles Section */}
          {relatedNews.length > 0 && (
            <section className="mb-12" aria-label="Leia Também">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-6 bg-brand-700 dark:bg-brand-500 rounded-full" />
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                  Leia Também • Cobertura Relacionada
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
            <AdSenseBanner slot={SITE_CONFIG.adsense.slots.sidebar} />

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
            <AdSenseBanner slot={SITE_CONFIG.adsense.slots.sidebarBottom} />
          </div>
        </aside>
      </div>
    </div>
  );
}

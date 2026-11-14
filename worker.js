// worker.js — Cloudflare Workers Multiplatform Entry Point for Norma Jurídica
// Mantém paridade completa de interface, rotas e contratos JSON com o servidor Node.js (server.js),
// com suporte híbrido (Proxy resiliente para ORIGIN_URL quando configurado OU execução 100% Edge Standalone),
// prevenção de loops DNS (Error 1000 / 1014 / 508) para news.mirandinhacontabilidade.workers.dev e leitura exclusiva de secrets no env.

const DEFAULT_NEWS_API_BASE_URL = 'https://news-sources-api.legislativemunicipal.workers.dev';
const CANONICAL_DOMAIN = 'news.mirandinhacontabilidade.workers.dev';
const CANONICAL_ORIGIN = `https://${CANONICAL_DOMAIN}`;

const SITE_INFO = {
  name: 'Norma Jurídica',
  shortName: 'Norma Jurídica',
  tagline: 'A informação que move o Brasil',
  description:
    'Portal de notícias com cobertura de política, economia, justiça, educação, esportes, tecnologia e notícias dos estados brasileiros.',
  domain: CANONICAL_DOMAIN,
  address: 'Brasília-DF',
  phone: '(61) 9 9242-8022',
  email: 'contato@normajuridica.com.br',
};

const ALL_CATEGORIES = [
  { id: 'all', name: 'Todas as Notícias', slug: 'todas', group: 'tema' },
  { id: 'Brasil', name: 'Brasil', slug: 'brasil', highlight: true, group: 'tema' },
  { id: 'Política', name: 'Política', slug: 'politica', highlight: true, group: 'tema' },
  { id: 'Economia', name: 'Economia', slug: 'economia', highlight: true, group: 'tema' },
  { id: 'Justiça', name: 'Justiça', slug: 'justica', highlight: true, group: 'tema' },
  { id: 'Mundo', name: 'Mundo', slug: 'mundo', highlight: true, group: 'tema' },
  { id: 'Saúde', name: 'Saúde', slug: 'saude', highlight: true, group: 'tema' },
  { id: 'Educação', name: 'Educação', slug: 'educacao', highlight: true, group: 'tema' },
  { id: 'Cultura', name: 'Cultura', slug: 'cultura', group: 'tema' },
  { id: 'Esporte', name: 'Esporte', slug: 'esporte', highlight: true, group: 'tema' },
  { id: 'Tecnologia e Games', name: 'Tecnologia & Games', slug: 'tecnologia-e-games', group: 'tema' },
  { id: 'Finanças', name: 'Finanças', slug: 'financas', group: 'tema' },
  { id: 'Pop & Arte', name: 'Pop & Arte', slug: 'pop-e-arte', group: 'tema' },
  { id: 'Pará', name: 'Pará', slug: 'para', highlight: true, group: 'regiao' },
  { id: 'Tocantins', name: 'Tocantins', slug: 'tocantins', highlight: true, group: 'regiao' },
  { id: 'Goiás', name: 'Goiás', slug: 'goias', highlight: true, group: 'regiao' },
  { id: 'Santa Catarina', name: 'Santa Catarina', slug: 'santa-catarina', group: 'regiao' },
  { id: 'Paraná', name: 'Paraná', slug: 'parana', group: 'regiao' },
  { id: 'Maranhão', name: 'Maranhão', slug: 'maranhao', group: 'regiao' },
  { id: 'Rio Grande do Sul', name: 'Rio Grande do Sul', slug: 'rio-grande-do-sul', group: 'regiao' },
  { id: 'Minas Gerais', name: 'Minas Gerais', slug: 'grande-minas', group: 'regiao' },
  { id: 'Amazonas', name: 'Amazonas', slug: 'amazonas', group: 'regiao' },
  { id: 'Bahia', name: 'Bahia', slug: 'bahia', group: 'regiao' },
  { id: 'São Paulo', name: 'São Paulo', slug: 'sao-paulo', group: 'regiao' },
  { id: 'Rio de Janeiro', name: 'Rio de Janeiro', slug: 'rio-de-janeiro', group: 'regiao' },
  { id: 'Distrito Federal', name: 'Distrito Federal', slug: 'distrito-federal', group: 'regiao' },
  { id: 'Ceará', name: 'Ceará', slug: 'ceara', group: 'regiao' },
  { id: 'Pernambuco', name: 'Pernambuco', slug: 'pernambuco', group: 'regiao' },
];

const DEFAULT_SOURCE_IDS = [
  '8281449136684', '3386542816798', '4524183818294', '2429537983919',
  '9124882157745', '5183624795316', '9482399189391', '8132269214748',
  '6424291362274', '5498139197391', '4415826156744', '9329418888697',
  '6571187291942', '8346116142997', '1492834928862', '2431124818641',
  '8833539123215', '1144428532544', '9886348421411', '3347141892497',
];

const SOURCE_CATEGORY_MAP = {
  '8281449136684': 'Política',
  '3386542816798': 'Economia',
  '4524183818294': 'Economia',
  '2429537983919': 'Esporte',
  '9124882157745': 'Esporte',
  '5183624795316': 'Esporte',
  '9482399189391': 'Justiça',
  '8132269214748': 'Justiça',
  '6424291362274': 'Educação',
  '5498139197391': 'Educação',
  '4415826156744': 'Tecnologia & Games',
  '9329418888697': 'Pará',
  '6571187291942': 'Tocantins',
  '8346116142997': 'Goiás',
  '1492834928862': 'Santa Catarina',
  '2431124818641': 'Mundo',
  '8833539123215': 'Cultura',
  '1144428532544': 'Brasil',
  '9886348421411': 'Saúde',
  '3347141892497': 'Paraná',
  '6389841444633': 'Esporte',
  '3815913481419': 'Esporte',
  '3422817479195': 'Economia',
};

const INSTITUTIONAL_PAGES = {
  sobre: {
    title: 'Sobre o Norma Jurídica',
    category: 'Institucional',
    lead: 'Conheça a história, o compromisso ético e a missão do portal Norma Jurídica no jornalismo brasileiro.',
    contentHtml: `<p>O <strong>${SITE_INFO.name}</strong> nasceu com a missão de levar à sociedade brasileira informações precisas, independentes e tempestivas sobre os poderes da República, o sistema de Justiça, a economia nacional e os acontecimentos nos estados brasileiros.</p><p>Com sede em <strong>${SITE_INFO.address}</strong>, nossa redação acompanha em tempo real as decisões dos tribunais, atos legislativos e indicadores econômicos.</p>`,
  },
  editorial: {
    title: 'Editorial e Compromisso Jornalístico',
    category: 'Institucional',
    lead: 'Apresentação editorial, princípios de apuração factual e o posicionamento institucional do portal Norma Jurídica.',
    contentHtml: `<p>O <strong>${SITE_INFO.name}</strong> dedica-se diariamente à produção e difusão de notícias fidedignas, análises jurídicas aprofundadas e reportagens de alto impacto sobre o Brasil e o mundo.</p><p>Nosso editorial orienta-se pela escuta plural, pela confirmação documental de fontes primárias e pela separação estrita entre informação factual e opinião.</p>`,
  },
  expediente: {
    title: 'Expediente e Corpo Editorial',
    category: 'Institucional',
    lead: 'Conheça a estrutura editorial, direção, apuração e canais oficiais de atendimento do portal.',
    contentHtml: `<p><strong>Direção Geral e Editorial:</strong> Redação Norma Jurídica<br><strong>Sede:</strong> ${SITE_INFO.address}<br><strong>Telefone Institucional:</strong> ${SITE_INFO.phone}<br><strong>E-mail Geral:</strong> ${SITE_INFO.email}</p>`,
  },
  'fale-conosco': {
    title: 'Fale Conosco e Atendimento ao Leitor',
    category: 'Atendimento',
    lead: 'Entre em contato direto com a redação do Norma Jurídica para sugestões de pauta, correções e informações.',
    contentHtml: `<p>Para enviar comunicados de imprensa, sugerir coberturas ou solicitar esclarecimentos, acesse nosso formulário em <a href="/contato" class="text-blue-700 font-semibold underline">/contato</a>.</p><p><strong>E-mail Oficial:</strong> ${SITE_INFO.email}<br><strong>Central Telefônica:</strong> ${SITE_INFO.phone}</p>`,
  },
  'linha-editorial': {
    title: 'Linha Editorial e Princípios Éticos',
    category: 'Institucional',
    lead: 'Diretrizes éticas, critérios de apuração e política de correção que orientam a redação do Norma Jurídica.',
    contentHtml: `<p>A cobertura jornalística do <strong>${SITE_INFO.name}</strong> rege-se pelos princípios da veracidade, interesse público, contraditório e independência editorial.</p><p>Eventuais equívocos factuais são retificados com celeridade e transparência mediante nota editorial explícita.</p>`,
  },
  transparencia: {
    title: 'Transparência e Governança',
    category: 'Institucional',
    lead: 'Informações sobre estrutura organizacional, governança e canais oficiais de relacionamento do portal.',
    contentHtml: `<p><strong>Responsável:</strong> ${SITE_INFO.name}<br><strong>Sede e Foro:</strong> ${SITE_INFO.address}<br><strong>Central Telefônica:</strong> ${SITE_INFO.phone}<br><strong>E-mail Institucional:</strong> ${SITE_INFO.email}</p>`,
  },
  ouvidoria: {
    title: 'Ouvidoria Geral e Atendimento ao Leitor',
    category: 'Atendimento',
    lead: 'Canal permanente de escuta para críticas, elogios, sugestões de pauta e solicitações da sociedade.',
    contentHtml: `<p>A Ouvidoria Geral responde formalmente às manifestações enviadas pelo formulário em <a href="/contato" class="text-blue-700 font-semibold underline">/contato</a> em até 48 horas úteis.</p>`,
  },
  'cadastro-certo': {
    title: 'Cadastro Certo e Alertas de Notícias',
    category: 'Institucional',
    lead: 'Orientações para recebimento de informativos jurídicos e boletins setoriais em conformidade com a LGPD.',
    contentHtml: `<p>O serviço Cadastro Certo do <strong>${SITE_INFO.name}</strong> trata os dados de leitores em estrita conformidade com a Lei Geral de Proteção de Dados (LGPD).</p>`,
  },
  'sobre-a-prefeitura': {
    title: 'Sobre a Administração Pública Municipal',
    category: 'Institucional',
    lead: 'Acompanhamento institucional da administração pública municipal, licitações e políticas locais.',
    contentHtml: `<p>Nesta seção, o <strong>${SITE_INFO.name}</strong> reúne reportagens analíticas sobre atos do Executivo, licitações públicas, prestação de contas e serviços municipais.</p>`,
  },
};

const SECRET_KEY_REGEX = /api[_-]?key|secret|token|password|credential|auth[_-]?header|bearer|authorization|private[_-]?key|client[_-]?secret|gemini[_-]?key|elevenlabs|weatherapi|env[_-]?var/i;

export function resolveWorkerNewsApiConfig(env = {}) {
  const rawBaseUrl = String(env.NEWS_API_BASE_URL || '').trim();
  const baseUrl = (rawBaseUrl || DEFAULT_NEWS_API_BASE_URL).replace(/\/+$/, '');
  const apiKey = String(env.API_KEY || env.NEWS_API_KEY || '').trim();
  return { baseUrl, apiKey };
}

export function buildWorkerNewsApiHeaders(apiKey) {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'NormaJuridica/1.0 (+https://news.mirandinhacontabilidade.workers.dev)',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }
  return headers;
}

/**
 * Resolve redirecionamentos canônicos e correções de protocolo/DNS para news.mirandinhacontabilidade.workers.dev.
 * Não redireciona localhost, 127.0.0.1 ou ambientes de preview temporários.
 */
export function resolveDnsAndCanonical(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  // Detecta esquema original no Cloudflare Edge via CF-Visitor ou X-Forwarded-Proto
  let effectiveProto = url.protocol.replace(':', '').toLowerCase();
  const cfVisitor = request.headers.get('cf-visitor');
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor);
      if (parsed && parsed.scheme) {
        effectiveProto = String(parsed.scheme).toLowerCase();
      }
    } catch {}
  } else {
    const xfProto = request.headers.get('x-forwarded-proto');
    if (xfProto) {
      effectiveProto = xfProto.split(',')[0].trim().toLowerCase();
    }
  }

  const isProductionApex = host === CANONICAL_DOMAIN;
  const isProductionWww = host === `www.${CANONICAL_DOMAIN}`;

  if (isProductionWww || (isProductionApex && effectiveProto === 'http')) {
    const canonical = new URL(url.toString());
    canonical.protocol = 'https:';
    canonical.hostname = CANONICAL_DOMAIN;
    canonical.port = '';
    return Response.redirect(canonical.toString(), 301);
  }

  return null;
}

/**
 * Valida env.ORIGIN_URL para proxy opcional rumo ao servidor Node.js,
 * bloqueando loops de DNS/Cloudflare (Error 1000 / Error 508 Loop Detected).
 */
export function resolveSafeOriginUrl(env, currentUrl, requestHeaders) {
  const rawOrigin = String((env && env.ORIGIN_URL) || '').trim();
  if (!rawOrigin) return null;

  // Evita loop recursivo se a requisição já passou pelo Worker
  const hop = parseInt(requestHeaders.get('x-nj-worker-hop') || '0', 10);
  if (hop >= 1) return null;

  try {
    const parsed = new URL(rawOrigin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    const originHost = parsed.hostname.toLowerCase();
    const currentHost = currentUrl.hostname.toLowerCase();

    // Nunca encaminha de volta para o próprio domínio gerenciado pelo Worker (previne loop infinito DNS/Cloudflare)
    if (
      originHost === CANONICAL_DOMAIN ||
      originHost === `www.${CANONICAL_DOMAIN}` ||
      originHost === currentHost
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function sanitizePublicData(data) {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(sanitizePublicData);
  if (typeof data === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(data)) {
      if (SECRET_KEY_REGEX.test(key)) continue;
      out[key] = sanitizePublicData(value);
    }
    return out;
  }
  return data;
}

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(str = '') {
  return escapeHtml(str).replace(/&#39;/g, '&apos;');
}

export function normalizeCategoryText(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/&/g, 'e')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function cleanCategoryName(name = '') {
  return String(name)
    .replace(/^Editoria\s+de\s+/i, '')
    .replace(/^Editoria\s+/i, '')
    .trim();
}

export function resolveCategoryDisplayName(slugOrId = '') {
  const norm = normalizeCategoryText(slugOrId);
  if (!norm || norm === 'all' || norm === 'todas') return 'Destaques';
  if (norm === 'noticias-gerais' || norm === 'brasil') return 'Brasil';
  const found = ALL_CATEGORIES.find(
    (c) => c.slug === norm || normalizeCategoryText(c.id) === norm || normalizeCategoryText(c.name) === norm
  );
  if (found) return cleanCategoryName(found.name);
  return cleanCategoryName(
    slugOrId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

export function stripHtmlTags(html = '') {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>?/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(title = '', idStr = '') {
  const base = normalizeCategoryText(title).slice(0, 85) || 'noticia';
  const suffix = idStr ? normalizeCategoryText(String(idStr)).slice(-8) : '';
  return suffix && !base.endsWith(suffix) ? `${base}-${suffix}` : base;
}

export function formatTimeAgo(dateStr) {
  try {
    const pub = new Date(dateStr).getTime();
    if (Number.isNaN(pub)) return 'Recentemente';
    const diffMin = Math.floor((Date.now() - pub) / 60000);
    const diffHours = Math.floor(diffMin / 60);
    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin === 1) return 'Há 1 minuto';
    if (diffMin < 60) return `Há ${diffMin} minutos`;
    if (diffHours === 1) return 'Há 1 hora';
    if (diffHours < 24) return `Há ${diffHours} horas`;
    if (diffHours < 48) return 'Ontem';
    const d = new Date(pub);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return 'Recentemente';
  }
}

function timingSafeCompare(a, b) {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i % ab.length] || 0) ^ (bb[i % bb.length] || 0);
  }
  return diff === 0;
}

export function applySecurityHeaders(response, pathname = '') {
  const headers = new Headers(response.headers);
  headers.delete('X-Powered-By');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-DNS-Prefetch-Control', 'on');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');
  headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  headers.set('X-Norma-Runtime', 'cloudflare-worker');

  if (/\.(xml|txt)$/i.test(pathname) && !headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(sanitizePublicData(payload)), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function getEffectiveBaseUrl(request, env) {
  const configured = String(env.APP_URL || env.NEXT_PUBLIC_SITE_URL || '').trim();
  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.workers.dev')) {
    return url.origin;
  }
  if (configured && !configured.includes('MY_APP_URL')) {
    return configured.replace(/\/+$/, '');
  }
  return CANONICAL_ORIGIN;
}

function extractImageFromItem(item) {
  const candidates = [item.imageUrl, item.mediaUrl, item.thumbnail, item.image];
  if (Array.isArray(item.images)) candidates.push(...item.images);
  const rawHtml = `${item.description || ''} ${item.content || ''}`;
  const imgMatch = rawHtml.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch && imgMatch[1]) candidates.push(imgMatch[1]);

  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const clean = c.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo').trim();
    if (/^https?:\/\//i.test(clean) && !/placeholder|pixel|1x1|blank\.gif|data:image/i.test(clean)) {
      return clean;
    }
  }
  return '';
}

function normalizeUpstreamItem(raw, fallbackCategory = 'Brasil') {
  if (!raw || !raw.title) return null;
  const title = stripHtmlTags(raw.title).replace(/\s+/g, ' ').trim();
  if (title.length < 5) return null;

  const rawCategory = cleanCategoryName(raw.category || fallbackCategory || 'Brasil');
  const category = rawCategory === 'Notícias Gerais' ? 'Brasil' : rawCategory;
  const categoryId = normalizeCategoryText(category) || 'brasil';
  const itemIdStr = String(raw.id || raw.slug || title);
  const slug = raw.slug ? normalizeCategoryText(raw.slug) : slugify(title, itemIdStr);
  const pubDate = raw.pubDate || raw.date || new Date().toISOString();
  const imageUrl = extractImageFromItem(raw);

  let summary = stripHtmlTags(raw.description || raw.summary || raw.content || '');
  if (summary.length > 260) {
    summary = summary.slice(0, 260).replace(/\s+[^\s]*$/, '') + '…';
  }
  if (!summary) {
    summary = `Acompanhe os detalhes completos sobre ${title} na editoria de ${category} do portal Norma Jurídica.`;
  }

  let contentHtml = raw.contentHtml || raw.content || raw.description || `<p>${escapeHtml(summary)}</p>`;
  contentHtml = sanitizeArticleHtmlForWorker(contentHtml, imageUrl);

  return {
    id: slug,
    slug,
    title,
    summary,
    contentHtml,
    category,
    categoryId,
    author: raw.author && !/^\d+$/.test(String(raw.author)) ? String(raw.author).trim() : 'Norma Jurídica',
    pubDate,
    isoDate: pubDate,
    timeAgo: formatTimeAgo(pubDate),
    imageUrl,
    images: imageUrl ? [imageUrl] : [],
    link: `/noticia/${slug}`,
    sourceUrl: raw.link || '',
  };
}

export function stripForcedAlignmentStyles(html = '') {
  return String(html)
    .replace(/\salign=["'](?:left|right|center|justify)["']/gi, '')
    .replace(/style=["']([^"']*)["']/gi, (_full, styleVal) => {
      const cleaned = styleVal
        .replace(/text-align\s*:[^;"]*;?/gi, '')
        .replace(/white-space\s*:\s*pre[^;"]*;?/gi, '')
        .trim();
      return cleaned ? `style="${cleaned}"` : '';
    });
}

export function sanitizeArticleHtmlForWorker(html = '', featuredImage = '') {
  if (!html) return '';
  let out = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo')
    // Remove blocos repetidos de Galeria de Fotos da Matéria
    .replace(/<section[^>]*class="[^"]*gallery[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '')
    // Converte links diretos .mp4/.mp3 em <video>/<audio>
    .replace(/<a\b[^>]*href=["'](https?:\/\/[^"']+\.mp4(?:\?[^"']*)?)["'][^>]*>[\s\S]*?<\/a>/gi, (_, url) =>
      `<div class="my-6 rounded-2xl overflow-hidden bg-black"><video controls preload="metadata" playsinline class="w-full max-h-[540px]" src="${escapeHtml(url)}"></video></div>`
    )
    .replace(/<a\b[^>]*href=["'](https?:\/\/[^"']+\.mp3(?:\?[^"']*)?)["'][^>]*>[\s\S]*?<\/a>/gi, (_, url) =>
      `<div class="my-4 p-3 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><audio controls preload="metadata" class="w-full" src="${escapeHtml(url)}"></audio></div>`
    );

  // Deduplica imagens iguais à imagem destacada e aplica zoom-frame + legenda
  const seenImgs = new Set();
  if (featuredImage) seenImgs.add(featuredImage.split('?')[0]);
  out = out.replace(/<img\b([^>]*src=["']([^"']+)["'][^>]*)>/gi, (_full, attrs, src) => {
    const clean = src.trim();
    const key = clean.split('?')[0];
    if (!/^https?:\/\//i.test(clean) || seenImgs.has(key)) return '';
    seenImgs.add(key);
    const altMatch = attrs.match(/\balt=["']([^"']*)["']/i);
    const altText = altMatch && altMatch[1] ? altMatch[1].trim() : '';
    const caption =
      altText && altText !== 'Imagem da matéria' && altText !== 'Imagem da reportagem'
        ? `<figcaption class="text-xs text-slate-500 dark:text-zinc-400 mt-2 italic px-1">${escapeHtml(altText)}</figcaption>`
        : '';
    return `<figure class="my-6 not-prose"><div class="zoom-frame relative w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><img src="${escapeHtml(clean)}" alt="${escapeHtml(altText || 'Imagem da reportagem')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="w-full h-auto object-cover rounded-xl" /></div>${caption}</figure>`;
  });

  out = stripForcedAlignmentStyles(out);

  out = out.replace(/<a\b([^>]*href=["']([^"']+)["'][^>]*)>/gi, (full, attrs, href) => {
    const lower = href.toLowerCase();
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      if (!lower.includes(CANONICAL_DOMAIN)) {
        const cleanAttrs = attrs.replace(/\s*(target|rel)=["'][^"']*["']/gi, '');
        return `<a${cleanAttrs} target="_blank" rel="noopener noreferrer">`;
      }
    }
    return full;
  });

  if (!/<p[\s>]/i.test(out)) {
    out = out
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${p}</p>`)
      .join('\n');
  }

  return out;
}

async function fetchUpstreamJson(env, endpoint, timeoutMs = 5500) {
  const { baseUrl, apiKey } = resolveWorkerNewsApiConfig(env);
  const headers = buildWorkerNewsApiHeaders(apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function fetchAggregatedNews(env, { category = 'all', q = '', page = 1, limit = 24, sourceId = '', refresh = false } = {}) {
  const normCat = normalizeCategoryText(category);
  const cacheKeyUrl = `https://edge-cache.news.mirandinhacontabilidade.workers.dev/news?cat=${encodeURIComponent(normCat || 'all')}&sid=${encodeURIComponent(sourceId)}`;

  let pool = null;
  const cache = typeof caches !== 'undefined' ? caches.default : null;

  if (cache && !refresh) {
    const hit = await cache.match(cacheKeyUrl);
    if (hit) {
      try {
        pool = await hit.json();
      } catch {}
    }
  }

  if (!pool) {
    const collected = [];
    const seenSlugs = new Set();

    if (sourceId) {
      const data = await fetchUpstreamJson(env, `/api/news/${encodeURIComponent(sourceId)}?limit=100`);
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      for (const raw of arr) {
        const item = normalizeUpstreamItem(raw, SOURCE_CATEGORY_MAP[sourceId] || 'Brasil');
        if (item && !seenSlugs.has(item.slug)) {
          seenSlugs.add(item.slug);
          collected.push(item);
        }
      }
    } else if (normCat && normCat !== 'all' && normCat !== 'todas') {
      const displayCat = resolveCategoryDisplayName(normCat);
      const matchingSources = Object.entries(SOURCE_CATEGORY_MAP)
        .filter(([, cat]) => normalizeCategoryText(cat) === normCat)
        .map(([id]) => id);

      const endpoints = [
        `/api/news/category/${encodeURIComponent(normCat)}?limit=120`,
        ...matchingSources.map((id) => `/api/news/${id}?limit=80`),
      ];

      const results = await Promise.all(endpoints.map((ep) => fetchUpstreamJson(env, ep)));
      for (const res of results) {
        const arr = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        for (const raw of arr) {
          const item = normalizeUpstreamItem(raw, displayCat);
          if (item && !seenSlugs.has(item.slug)) {
            seenSlugs.add(item.slug);
            collected.push(item);
          }
        }
      }
    } else {
      // Feed principal: busca /api/news e principais fontes em paralelo para manter riqueza de categorias
      const batchSources = DEFAULT_SOURCE_IDS.slice(0, 12);
      const results = await Promise.all([
        fetchUpstreamJson(env, '/api/news?limit=150'),
        ...batchSources.map((id) => fetchUpstreamJson(env, `/api/news/${id}?limit=40`)),
      ]);
      results.forEach((res, idx) => {
        const sid = idx === 0 ? '' : batchSources[idx - 1];
        const fallbackCat = sid ? SOURCE_CATEGORY_MAP[sid] : 'Brasil';
        const arr = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        for (const raw of arr) {
          const item = normalizeUpstreamItem(raw, fallbackCat);
          if (item && !seenSlugs.has(item.slug)) {
            seenSlugs.add(item.slug);
            collected.push(item);
          }
        }
      });
    }

    collected.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    pool = collected;

    if (cache && pool.length > 0) {
      await cache.put(
        cacheKeyUrl,
        new Response(JSON.stringify(pool), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
          },
        })
      );
    }
  }

  let filtered = Array.isArray(pool) ? pool : [];
  if (q && q.trim()) {
    const qLower = q.toLowerCase().trim();
    filtered = filtered.filter(
      (item) =>
        item.title.toLowerCase().includes(qLower) ||
        item.summary.toLowerCase().includes(qLower) ||
        item.category.toLowerCase().includes(qLower)
    );
  }

  const total = filtered.length;
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const offset = (safePage - 1) * safeLimit;
  const items = filtered.slice(offset, offset + safeLimit);

  return { items, total, page: safePage, limit: safeLimit, totalPages: Math.max(1, Math.ceil(total / safeLimit)) };
}

async function findArticleBySlug(env, slug) {
  if (!slug) return null;
  const decoded = decodeURIComponent(slug).toLowerCase().trim();
  const { items } = await fetchAggregatedNews(env, { category: 'all', limit: 100, page: 1 });
  let match = items.find((i) => i.slug.toLowerCase() === decoded || i.id.toLowerCase() === decoded);
  if (match) return match;

  // Tenta busca direta na API pelo termo/slug
  const parts = decoded.split('-').slice(0, 6).join(' ');
  const direct = await fetchUpstreamJson(env, `/api/news?q=${encodeURIComponent(parts)}&limit=30`);
  const arr = Array.isArray(direct?.items) ? direct.items : Array.isArray(direct) ? direct : [];
  for (const raw of arr) {
    const norm = normalizeUpstreamItem(raw);
    if (norm && (norm.slug.toLowerCase() === decoded || decoded.includes(norm.slug.slice(0, 40)))) {
      return norm;
    }
  }
  return null;
}

function buildKeyPoints(article) {
  const rawText = stripHtmlTags(article.contentHtml || article.summary || '');
  const isLarge = rawText.length > 800;
  const target = isLarge ? 6 : 3;
  const points = [];
  const sentences = rawText
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && !/leia também|clique aqui|foto:/i.test(s));

  for (const s of sentences) {
    if (points.length >= target) break;
    if (!points.some((p) => p.toLowerCase() === s.toLowerCase())) points.push(s);
  }
  const fallbacks = [
    `Fato apurado: ${article.title}`,
    'Acompanhamento contínuo dos desdobramentos pelas autoridades competentes.',
    'Informação confirmada com base nas fontes e comunicações oficiais do setor.',
    'Análise de desdobramentos jurídicos e impacto direto para a sociedade.',
    'Monitoramento prioritário das manifestações institucionais e regulatórias.',
    'Atualização em tempo real das deliberações e medidas anunciadas pelo poder público.',
  ];
  for (const fb of fallbacks) {
    if (points.length >= target) break;
    if (!points.includes(fb)) points.push(fb);
  }
  return points.slice(0, target);
}

/**
 * @param {{ title: string; description: string; entries?: Array<{ url: string; title?: string; changefreq?: string; priority?: string; lastmod?: string; images?: Array<{ loc: string }> }>; type?: string }} opts
 */
export function renderWorkerSitemapHtml({ title, description, entries = [], type = 'index' }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ${SITE_INFO.name}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, 'Inter', sans-serif; background: #0f172a; color: #f8fafc; line-height: 1.5; padding: 24px; }
    .container { max-width: 1100px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
    .header { background: linear-gradient(135deg, #1e3a8a, #1d4ed8); padding: 32px; border-bottom: 1px solid #3b82f6; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .logo-badge { background: #ffffff; color: #1d4ed8; font-weight: 900; font-size: 20px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px; }
    .brand-text { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
    .header h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
    .header p { color: #bfdbfe; font-size: 15px; }
    .nav-links { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .nav-link { color: #ffffff; background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 9999px; text-decoration: none; font-size: 13px; font-weight: 600; transition: background 0.2s; }
    .nav-link:hover { background: #ffffff; color: #1d4ed8; }
    .table-wrapper { overflow-x: auto; padding: 20px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
    th { background: #0f172a; color: #94a3b8; font-weight: 600; padding: 12px 16px; border-bottom: 2px solid #334155; }
    td { padding: 12px 16px; border-bottom: 1px solid #334155; color: #cbd5e1; }
    tr:hover td { background: #243248; }
    a.item-link { color: #60a5fa; text-decoration: none; font-weight: 500; word-break: break-all; }
    a.item-link:hover { text-decoration: underline; color: #93c5fd; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; background: #3b82f6; color: #ffffff; }
    .badge-sub { background: #334155; color: #94a3b8; }
    .footer { padding: 20px 32px; background: #0f172a; border-top: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #64748b; }
    @media (max-width: 640px) {
      body { padding: 12px; }
      .header { padding: 20px; }
      .footer { flex-direction: column; gap: 8px; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="logo-badge">NJ</div>
        <div class="brand-text">${SITE_INFO.name}</div>
      </div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <div class="nav-links">
        <a class="nav-link" href="/sitemap.xml">Índice Geral</a>
        <a class="nav-link" href="/sitemap-posts.xml">Matérias</a>
        <a class="nav-link" href="/sitemap-categories.xml">Editorias</a>
        <a class="nav-link" href="/sitemap-pages.xml">Institucional</a>
        <a class="nav-link" href="/sitemap-images.xml">Imagens</a>
        <a class="nav-link" href="/">Voltar ao Portal</a>
      </div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>URL / Recurso</th>
            ${type === 'images' ? '<th>Qtd. Imagens</th>' : ''}
            <th>Frequência</th>
            <th>Prioridade</th>
            <th>Última Atualização</th>
          </tr>
        </thead>
        <tbody>
          ${entries
            .map(
              (e) => `
            <tr>
              <td>
                <a class="item-link" href="${escapeHtml(e.url)}">${e.title ? `<strong>${escapeHtml(e.title)}</strong><br>` : ''}${escapeHtml(e.url)}</a>
              </td>
              ${type === 'images' ? `<td><span class="badge">${(e.images && e.images.length) || 0}</span></td>` : ''}
              <td><span class="badge badge-sub">${escapeHtml(e.changefreq || 'hourly')}</span></td>
              <td><strong>${escapeHtml(String(e.priority || '0.8'))}</strong></td>
              <td>${e.lastmod ? escapeHtml(new Date(e.lastmod).toLocaleString('pt-BR')) : 'Tempo Real'}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <div class="footer">
      <div>Total de URLs listadas: <strong>${entries.length}</strong></div>
      <div>${SITE_INFO.name} • Sistema Oficial de Distribuição XML</div>
    </div>
  </div>
</body>
</html>`;
}

function renderSharedHead({ title, description, canonicalUrl, ogImageUrl, newsApiOrigin, adsenseId }) {
  return `<!DOCTYPE html>
<html lang="pt-BR" class="antialiased">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="pinterest" content="nopin" />
  <meta name="pinterest" content="nohover" />
  <meta name="theme-color" content="#1d4ed8" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:site_name" content="${SITE_INFO.name}" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
  <link rel="dns-prefetch" href="${escapeHtml(newsApiOrigin)}" />
  <link rel="preconnect" href="${escapeHtml(newsApiOrigin)}" crossorigin="anonymous" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Source+Serif+4:wght@400;600;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], serif: ['Source Serif 4', 'Georgia', 'serif'] },
          colors: {
            brand: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a',950:'#172554' }
          }
        }
      }
    };
  </script>
  <script>
    (function() {
      try {
        var t = sessionStorage.getItem('nj_theme_session') || localStorage.getItem('nj_theme');
        if (t === 'dark') document.documentElement.classList.add('dark');
        var fs = localStorage.getItem('nj_font_size');
        if (fs === 'large') { document.documentElement.setAttribute('data-font-size', 'large'); document.documentElement.style.fontSize = '18.5px'; }
        else if (fs === 'xlarge') { document.documentElement.setAttribute('data-font-size', 'xlarge'); document.documentElement.style.fontSize = '21px'; }
      } catch(e) {}
    })();
  </script>
  ${adsenseId ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapeHtml(adsenseId)}" crossorigin="anonymous"></script>` : ''}
  <style>
    html { font-size: 16px; font-feature-settings: "rlig" 1, "calt" 1; }
    html[data-font-size="large"] { font-size: 18.5px; }
    html[data-font-size="xlarge"] { font-size: 21px; }
    * { scrollbar-width: thin; scrollbar-color: #1d4ed8 #f4f4f5; hyphens: none !important; -webkit-hyphens: none !important; }
    .dark * { scrollbar-color: #1d4ed8 #18181b; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #f4f4f5; }
    .dark ::-webkit-scrollbar-track { background: #18181b; }
    ::-webkit-scrollbar-thumb { background-color: #1d4ed8; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background-color: #1e40af; }
    ::-webkit-scrollbar-thumb:active { background-color: #1e3a8a; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    @keyframes marquee { 0%{transform:translateX(0%)} 100%{transform:translateX(-50%)} }
    .animate-marquee { display:flex; width:max-content; animation:marquee 85s linear infinite; }
    .animate-marquee:hover { animation-play-state:paused; }
    @keyframes slideProgressBar { 0%{transform:scaleX(0)} 100%{transform:scaleX(1)} }
    .animate-slide-progress { animation: slideProgressBar 6s linear forwards; transform-origin: left; will-change: transform; }
    a { transition: color 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, border-color 0.2s ease; }
    a:hover { color: #1d4ed8; }
    .dark a:hover { color: #60a5fa; }
    p a:hover, .article-body a:hover, .article-content a:hover, .prose a:hover, nav a:hover, .link-motion:hover { transform: translateX(2px); }
    .zoom-frame { overflow: hidden; }
    .zoom-frame img, .group:hover .zoom-image, .group:hover img:not(.no-zoom), .article-body img, .article-content img { transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), filter 0.3s ease; }
    .zoom-frame:hover img, .group:hover .zoom-frame img, .article-body img:hover, .article-content img:hover, .zoom-on-hover:hover { transform: scale(1.05); }
    .article-body, .article-body p, .article-body div, .article-body li, .article-body blockquote, .article-content, .article-content p, .news-summary, .news-description, .justified-text, .text-justified { text-align: justify !important; text-justify: inter-word; hyphens: none !important; -webkit-hyphens: none !important; }
    .article-body p { margin-bottom: 1.15rem; line-height: 1.85; }
    .article-body h2, .article-body h3, .article-body h4 { font-weight: 800; margin: 1.5rem 0 .75rem; text-align: left !important; }
    .article-body ul, .article-body ol { margin: 1rem 0 1.25rem 1.5rem; }
    .article-body ul { list-style-type: disc; }
    .article-body ol { list-style-type: decimal; }
    .article-body li { margin-bottom: 0.45rem; line-height: 1.75; }
    .article-body a { color: #1d4ed8; text-decoration: underline; font-weight: 500; }
    .dark .article-body a { color: #60a5fa; }
    .article-body figcaption { text-align: left !important; }
    .content-auto { content-visibility: auto; contain-intrinsic-size: auto 380px; }
    @media (prefers-reduced-motion: reduce) {
      .animate-marquee, .animate-slide-progress { animation: none; }
      * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
    }
  </style>
</head>
<body class="bg-slate-50/50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 min-h-screen flex flex-col font-sans transition-colors duration-200">
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-brand-700 focus:text-white focus:rounded-xl">Pular para o conteúdo principal</a>`;
}

const SVG_ICONS = {
  bookOpen: '<svg class="w-3.5 h-3.5 text-brand-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  users: '<svg class="w-3.5 h-3.5 text-brand-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  mail: '<svg class="w-3.5 h-3.5 text-brand-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  scale: '<svg class="w-3.5 h-3.5 text-brand-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',
  type: '<svg class="w-3 h-3 text-brand-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>',
  moon: '<svg class="w-3.5 h-3.5 text-brand-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  sun: '<svg class="w-3.5 h-3.5 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  search: '<svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  refresh: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
  bookmark: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
  bookmarkSm: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
  user: '<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  clock: '<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  zap: '<svg class="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  mapPin: '<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  newspaper: '<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>',
  chevronRight: '<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  chevronDown: '<svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  x: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  arrowUp: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>',
  volume2: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
};

function getCategoryIconSvg(slug = '', cls = 'w-3.5 h-3.5 flex-shrink-0') {
  const icons = {
    todas: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`,
    brasil: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>`,
    politica: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
    economia: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    justica: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/></svg>`,
    mundo: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
    saude: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
    educacao: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    cultura: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
    esporte: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
    'tecnologia-e-games': `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>`,
    financas: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/></svg>`,
    'pop-e-arte': `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>`,
  };
  return (
    icons[slug] ||
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`
  );
}

function renderHeaderAndNav(activeCategorySlug = 'todas', tickerNews = [], searchQuery = '') {
  const thematic = ALL_CATEGORIES.filter((c) => c.group === 'tema');
  const regional = ALL_CATEGORIES.filter((c) => c.group === 'regiao');
  const normActive = normalizeCategoryText(activeCategorySlug) || 'todas';
  const activeCatObj =
    ALL_CATEGORIES.find((c) => c.slug === normActive || (c.slug === 'todas' && (normActive === 'all' || normActive === 'todas'))) || {
      name: activeCategorySlug === 'favoritos' ? 'Minha Lista' : resolveCategoryDisplayName(normActive),
      slug: normActive,
    };

  const tabHtml = (c) => {
    const active = normActive === c.slug || (c.slug === 'todas' && (normActive === 'all' || normActive === 'todas'));
    const href = c.slug === 'todas' ? '/' : `/categoria/${c.slug}`;
    return `<a href="${href}" class="relative px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all duration-200 select-none ${
      active
        ? 'text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 shadow-xs ring-1 ring-brand-200 dark:ring-brand-800'
        : 'text-slate-600 dark:text-zinc-400 hover:text-brand-700 dark:hover:text-brand-400 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60'
    }">${getCategoryIconSvg(c.slug, `w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-brand-700 dark:text-brand-400' : 'text-slate-400 dark:text-zinc-500'}`)}<span>${escapeHtml(c.name)}</span>${
      active ? '<span class="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-700 dark:bg-brand-500 rounded-full"></span>' : ''
    }</a>`;
  };

  const tickerSlice = tickerNews.slice(0, 10);
  const tickerDuplicated = [...tickerSlice, ...tickerSlice];

  return `
  <header class="w-full bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 relative z-50">
    <div class="bg-zinc-950 text-slate-300 text-xs py-1.5 px-4 border-b border-zinc-800/80">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="flex items-center gap-2.5">
          <span id="nj-clock-date" class="font-medium text-slate-200">Brasília, DF</span>
          <span class="text-zinc-600">•</span>
          <span id="nj-clock-time" class="font-mono font-semibold text-slate-300 text-xs tracking-wider">12:00:00</span>
        </div>
        <div class="flex items-center gap-4 flex-wrap justify-center">
          <a href="/pagina/editorial" class="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors">${SVG_ICONS.bookOpen}<span>Editorial</span></a>
          <a href="/pagina/expediente" class="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors">${SVG_ICONS.users}<span>Expediente</span></a>
          <a href="/pagina/fale-conosco" class="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors">${SVG_ICONS.mail}<span>Fale Conosco</span></a>
          <a href="/pagina/linha-editorial" class="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors">${SVG_ICONS.scale}<span>Linha Editorial</span></a>
          <span class="text-zinc-700 hidden sm:inline">|</span>
          <button type="button" id="nj-font-btn" class="hover:text-white flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer" title="Ajustar tamanho da fonte (A- / A / A+ / A++)" aria-label="Ajustar tamanho da fonte">${SVG_ICONS.type}<span id="nj-font-label">A</span></button>
          <button type="button" id="nj-theme-btn" class="hover:text-white flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer" title="Ativar modo escuro" aria-label="Alternar tema"><span id="nj-theme-icon">${SVG_ICONS.moon}</span><span id="nj-theme-label">Modo Escuro</span></button>
        </div>
      </div>
    </div>
    <div class="max-w-7xl mx-auto px-4 py-4 md:py-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <a href="/" class="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 ring-brand-500 rounded-2xl transition-all duration-200 hover:-translate-y-0.5">
        <div class="w-12 h-12 md:w-14 md:h-14 bg-brand-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl md:text-3xl tracking-tighter shadow-md ring-4 ring-brand-100 dark:ring-brand-950/50 group-hover:bg-brand-800 transition-all duration-300">NJ</div>
        <div>
          <div class="text-2xl md:text-3xl font-black tracking-tighter leading-none">
            <span class="text-slate-900 dark:text-zinc-100">NORMA </span><span class="text-brand-700 dark:text-brand-400">JURÍDICA</span>
          </div>
          <p class="text-[11px] md:text-xs text-slate-500 dark:text-zinc-400 font-medium tracking-tight mt-1">${SITE_INFO.tagline}</p>
        </div>
      </a>
      <div class="w-full md:w-auto flex items-center gap-3">
        <form action="/" method="GET" class="relative flex-1 md:w-72">
          <label for="search-input" class="sr-only">Buscar notícias</label>
          <input id="search-input" type="search" name="q" value="${escapeHtml(searchQuery)}" placeholder="Buscar notícias, leis, análises..." class="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs md:text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
          ${SVG_ICONS.search}
        </form>
        <a href="/?refresh=1" class="p-2.5 bg-slate-100 dark:bg-zinc-900 hover:bg-brand-50 dark:hover:bg-brand-950/60 text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 rounded-xl border border-slate-200 dark:border-zinc-800 transition-all" title="Atualizar feed de notícias" aria-label="Atualizar feed de notícias">${SVG_ICONS.refresh}</a>
        <div class="relative">
          <button id="bookmarks-tab-button" type="button" class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs md:text-sm font-bold transition-all cursor-pointer bg-slate-100 dark:bg-zinc-900 hover:bg-brand-50 dark:hover:bg-brand-950/60 text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 border-slate-200 dark:border-zinc-800" title="Acessar Minha Lista e Todas as Categorias" aria-label="Minha Lista e Todas as Categorias" aria-expanded="false">
            <span class="text-slate-400">${SVG_ICONS.bookmark}</span>
            <span>Minha Lista</span>
            <span id="nj-bookmarks-count" class="text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">0</span>
          </button>
          <div id="nj-list-backdrop" class="hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-xs"></div>
          <div id="nj-list-drawer" class="hidden absolute right-0 top-full mt-2 w-[340px] sm:w-[480px] max-h-[85vh] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-y-auto flex-col">
            <div class="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-10">
              <div class="flex items-center gap-2 text-brand-600 dark:text-brand-400">${SVG_ICONS.bookmark}<h3 class="text-sm font-black text-slate-900 dark:text-zinc-100">Minha Lista &amp; Todas as Categorias</h3></div>
              <button type="button" id="nj-list-close" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer" aria-label="Fechar menu">${SVG_ICONS.x}</button>
            </div>
            <div class="p-4 space-y-5">
              <div class="p-3.5 bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/60 rounded-xl">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-black uppercase tracking-wider text-brand-800 dark:text-brand-300">Matérias Salvas</span>
                  <span id="nj-drawer-bookmarks-label" class="text-xs font-bold text-brand-600 dark:text-brand-400">0 matérias</span>
                </div>
                <p class="text-xs text-slate-600 dark:text-zinc-400 mb-3">Acesse a listagem completa com todas as matérias adicionadas à sua lista de leitura.</p>
                <a href="/?cat=favoritos" class="w-full py-2 px-3 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"><span>Ver Minha Lista no Feed</span>${SVG_ICONS.chevronRight}</a>
              </div>
              <div>
                <div class="flex items-center gap-1.5 mb-2.5 text-brand-600 dark:text-brand-400">${SVG_ICONS.newspaper}<h4 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">Categorias Temáticas (${thematic.length})</h4></div>
                <div class="grid grid-cols-2 gap-1.5">
                  ${thematic.map((c) => `<a href="${c.slug === 'todas' ? '/' : `/categoria/${c.slug}`}" class="px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors truncate">• ${escapeHtml(c.name)}</a>`).join('')}
                </div>
              </div>
              <div class="border-t border-slate-100 dark:border-zinc-800 pt-4">
                <div class="flex items-center gap-1.5 mb-2.5 text-brand-600 dark:text-brand-400">${SVG_ICONS.mapPin}<h4 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">Estados &amp; Regiões do Brasil (${regional.length})</h4></div>
                <div class="grid grid-cols-2 gap-1.5">
                  ${regional.map((c) => `<a href="/categoria/${c.slug}" class="px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors truncate">• ${escapeHtml(c.name)}</a>`).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
  ${
    tickerDuplicated.length > 0
      ? `<div class="bg-brand-950 text-white border-b border-brand-900/60 overflow-hidden py-2" aria-label="Notícias de Última Hora">
          <div class="max-w-7xl mx-auto px-4 flex items-center gap-3">
            <div class="flex-shrink-0 flex items-center gap-1.5 bg-brand-800 text-amber-300 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider shadow-inner">${SVG_ICONS.zap}<span>Última Hora</span></div>
            <div class="overflow-hidden relative w-full">
              <div class="animate-marquee whitespace-nowrap flex items-center gap-8 py-0.5">
                ${tickerDuplicated
                  .map(
                    (item) => `<a href="/noticia/${escapeHtml(item.slug)}" class="inline-flex items-center gap-2 text-xs md:text-sm text-slate-200 hover:text-white group transition-colors"><span class="text-[11px] font-extrabold uppercase tracking-wider text-brand-300 bg-brand-900/80 px-1.5 py-0.5 rounded">${escapeHtml(item.category)}</span><span class="group-hover:underline font-medium text-slate-100 max-w-[320px] md:max-w-[450px] truncate">${escapeHtml(item.title)}</span><span class="text-[11px] text-slate-400 font-normal">(${escapeHtml(item.timeAgo)})</span><span class="text-slate-600 font-bold ml-4" aria-hidden="true">•</span></a>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>`
      : ''
  }
  <nav class="relative z-40 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-xs" aria-label="Editorias e Categorias">
    <div class="max-w-7xl mx-auto px-4 py-2">
      <div class="sm:hidden relative">
        <button type="button" id="nj-mobile-cat-btn" class="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl shadow-xs transition-colors cursor-pointer text-left" aria-expanded="false" aria-label="Selecionar editoria ou categoria">
          <div class="flex items-center gap-2 min-w-0">
            <span class="p-1.5 rounded-lg bg-brand-700 text-white">${getCategoryIconSvg(activeCatObj.slug, 'w-4 h-4')}</span>
            <div class="flex flex-col min-w-0">
              <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-400">Editoria Selecionada</span>
              <span class="text-xs font-black text-slate-900 dark:text-zinc-100 truncate">${escapeHtml(activeCatObj.name)}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 pl-2"><span class="text-[11px] font-bold">Mudar</span>${SVG_ICONS.chevronDown}</div>
        </button>
        <div id="nj-mobile-cat-menu" class="hidden absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-50 p-3 max-h-[75vh] overflow-y-auto space-y-3">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 px-1">Temas Centrais</span>
            <div class="grid grid-cols-2 gap-1.5">
              ${thematic.map((c) => `<a href="${c.slug === 'todas' ? '/' : `/categoria/${c.slug}`}" class="flex items-center gap-2 p-2 rounded-xl text-xs font-bold ${normActive === c.slug || (c.slug === 'todas' && normActive === 'all') ? 'bg-brand-700 text-white' : 'bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300'}">${getCategoryIconSvg(c.slug, 'w-3.5 h-3.5 flex-shrink-0')}<span class="truncate">${escapeHtml(c.name)}</span></a>`).join('')}
            </div>
          </div>
          <div class="pt-2 border-t border-slate-100 dark:border-zinc-800">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 px-1">Estados &amp; Regiões</span>
            <div class="grid grid-cols-2 gap-1.5">
              ${regional.map((c) => `<a href="/categoria/${c.slug}" class="flex items-center gap-2 p-2 rounded-xl text-xs font-bold ${normActive === c.slug ? 'bg-brand-700 text-white' : 'bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300'}">${getCategoryIconSvg(c.slug, 'w-3.5 h-3.5 flex-shrink-0')}<span class="truncate">${escapeHtml(c.name)}</span></a>`).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="hidden sm:block space-y-1.5">
        <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">${thematic.map(tabHtml).join('')}</div>
        <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1.5 border-t border-slate-100 dark:border-zinc-800/60">
          <span class="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-zinc-500 mr-1 hidden lg:inline">Estados:</span>
          ${regional.map(tabHtml).join('')}
        </div>
      </div>
    </div>
  </nav>`;
}

function renderNewsCardHtml(item, variant = 'grid') {
  const imgSrc = item.imageUrl || '/cover.png';
  const slug = item.slug || item.id || '';
  if (variant === 'compact') {
    return `
  <article data-news-slug="${escapeHtml(slug)}" class="nj-news-card content-auto group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex gap-4 items-center">
    <div class="zoom-frame relative w-28 h-20 sm:w-36 sm:h-24 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-800">
      <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      <a href="/noticia/${escapeHtml(slug)}" class="absolute inset-0 block focus:outline-none z-0" aria-label="${escapeHtml(item.title)}"></a>
    </div>
    <div class="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
      <div>
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400">${escapeHtml(item.category)}</span>
          <button type="button" data-bookmark-id="${escapeHtml(slug)}" class="nj-bookmark-btn p-1 rounded-lg transition-colors text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer" title="Salvar matéria" aria-label="Salvar matéria">${SVG_ICONS.bookmarkSm}</button>
        </div>
        <a href="/noticia/${escapeHtml(slug)}" class="focus:outline-none block group/title">
          <h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 group-hover:translate-x-1 line-clamp-2 leading-snug transition-all duration-200">${escapeHtml(item.title)}</h3>
        </a>
      </div>
      <div class="flex items-center gap-3 text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
        <span class="truncate">${escapeHtml(item.author || 'Norma Jurídica')}</span>
        <span>•</span>
        <span class="flex-shrink-0">${escapeHtml(item.timeAgo)}</span>
      </div>
    </div>
  </article>`;
  }

  return `
  <article data-news-slug="${escapeHtml(slug)}" class="nj-news-card content-auto group flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
    <div class="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-zinc-800 block zoom-frame">
      <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="w-full h-full object-cover group-hover:scale-110 hover:scale-110 transition-transform duration-500 ease-out" />
      <a href="/noticia/${escapeHtml(slug)}" class="absolute inset-0 block focus:outline-none z-0" aria-label="${escapeHtml(item.title)}"></a>
      <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity z-10 pointer-events-auto">
        <button type="button" data-bookmark-id="${escapeHtml(slug)}" class="nj-bookmark-btn p-1.5 backdrop-blur-md bg-black/60 hover:bg-brand-700 text-white rounded-xl shadow-md transition-colors cursor-pointer" title="Salvar matéria" aria-label="Salvar matéria">${SVG_ICONS.bookmarkSm}</button>
      </div>
    </div>
    <div class="p-4 md:p-5 flex-1 flex flex-col justify-between">
      <div>
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-1.5">${escapeHtml(item.category)}</span>
        <a href="/noticia/${escapeHtml(slug)}" class="focus:outline-none block group/link">
          <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 group-hover:translate-x-1 leading-snug line-clamp-3 mb-2.5 transition-all duration-200">${escapeHtml(item.title)}</h3>
        </a>
        <p class="news-summary text-xs sm:text-sm text-slate-600 dark:text-zinc-400 line-clamp-3 leading-relaxed mb-4 font-normal text-justify hyphens-none">${escapeHtml(item.summary)}</p>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-500 pt-3 border-t border-slate-100 dark:border-zinc-800">
        <span class="flex items-center gap-1.5 truncate max-w-[150px]">${SVG_ICONS.user}<span class="truncate">${escapeHtml(item.author || 'Norma Jurídica')}</span></span>
        <span class="flex items-center gap-1.5 flex-shrink-0">${SVG_ICONS.clock}<span>${escapeHtml(item.timeAgo)}</span></span>
      </div>
    </div>
  </article>`;
}

function renderPaginationHtml(baseUrl, currentPage, totalPages) {
  if (totalPages <= 1) return '';
  const sep = baseUrl.includes('?') ? '&' : '?';
  const prev = currentPage > 1 ? `<a href="${baseUrl}${sep}page=${currentPage - 1}" class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold hover:border-brand-600">← Anterior</a>` : '';
  const next = currentPage < totalPages ? `<a href="${baseUrl}${sep}page=${currentPage + 1}" class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold hover:border-brand-600">Próxima →</a>` : '';
  return `<div class="flex items-center justify-between gap-4 pt-6 border-t border-slate-200 dark:border-zinc-800">${prev}<span class="text-xs font-bold text-slate-500 mx-auto">Página ${currentPage} de ${totalPages}</span>${next}</div>`;
}

function renderFooterAndScripts() {
  return `
  <footer class="bg-slate-900 text-slate-300 border-t border-slate-800 mt-16">
    <div class="max-w-7xl mx-auto px-4 py-12 md:py-16">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
        <div class="lg:col-span-4 space-y-4">
          <a href="/" class="inline-flex items-center gap-2.5 focus:outline-none">
            <div class="w-9 h-9 bg-brand-700 rounded-xl flex items-center justify-center text-white font-black text-xl tracking-tighter">NJ</div>
            <span class="text-xl font-black tracking-tight text-white">NORMA <span class="text-brand-400">JURÍDICA</span></span>
          </a>
          <p class="text-xs md:text-sm text-slate-400 leading-relaxed">Cobertura jornalística independente, transparente e contínua sobre política, economia, justiça, educação, esportes, tecnologia e os estados brasileiros.</p>
          <div class="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 text-xs space-y-2 text-slate-300">
            <div class="font-semibold text-white">Dados Institucionais Oficiais</div>
            <div><span class="text-slate-200 font-medium">Responsável:</span> ${SITE_INFO.name}</div>
            <div>${SITE_INFO.address}</div>
            <div>${SITE_INFO.phone}</div>
            <div>${SITE_INFO.email}</div>
          </div>
        </div>
        <div class="lg:col-span-3">
          <h3 class="text-xs font-black uppercase tracking-wider text-white mb-4">Editorias Principais</h3>
          <ul class="space-y-2 text-xs md:text-sm">
            <li><a href="/" class="hover:text-white transition-colors">Todas as Notícias</a></li>
            <li><a href="/categoria/politica" class="hover:text-white transition-colors">Política</a></li>
            <li><a href="/categoria/economia" class="hover:text-white transition-colors">Economia</a></li>
            <li><a href="/categoria/justica" class="hover:text-white transition-colors">Justiça</a></li>
            <li><a href="/categoria/educacao" class="hover:text-white transition-colors">Educação</a></li>
            <li><a href="/categoria/saude" class="hover:text-white transition-colors">Saúde</a></li>
            <li><a href="/categoria/esporte" class="hover:text-white transition-colors">Esporte</a></li>
            <li><a href="/categoria/tecnologia-e-games" class="hover:text-white transition-colors">Tecnologia &amp; Games</a></li>
            <li><a href="/categoria/para" class="hover:text-white transition-colors">Pará</a></li>
            <li><a href="/categoria/tocantins" class="hover:text-white transition-colors">Tocantins</a></li>
          </ul>
        </div>
        <div class="lg:col-span-3">
          <h3 class="text-xs font-black uppercase tracking-wider text-white mb-4">Institucional &amp; Governança</h3>
          <ul class="space-y-2 text-xs md:text-sm">
            <li><a href="/pagina/sobre" class="hover:text-white transition-colors">Sobre o Portal</a></li>
            <li><a href="/pagina/linha-editorial" class="hover:text-white transition-colors">Linha Editorial e Ética</a></li>
            <li><a href="/pagina/transparencia" class="hover:text-white transition-colors">Transparência</a></li>
            <li><a href="/pagina/ouvidoria" class="hover:text-white transition-colors">Ouvidoria Geral</a></li>
            <li><a href="/pagina/cadastro-certo" class="hover:text-white transition-colors">Cadastro Certo</a></li>
            <li><a href="/pagina/sobre-a-prefeitura" class="hover:text-white transition-colors">Gestão Pública Municipal</a></li>
          </ul>
        </div>
        <div class="lg:col-span-2">
          <h3 class="text-xs font-black uppercase tracking-wider text-white mb-4">Legal &amp; Contato</h3>
          <ul class="space-y-2 text-xs md:text-sm">
            <li><a href="/contato" class="hover:text-white transition-colors font-medium text-brand-400">Fale com a Redação</a></li>
            <li><a href="/privacidade" class="hover:text-white transition-colors">Privacidade</a></li>
            <li><a href="/termos" class="hover:text-white transition-colors">Termos de Uso</a></li>
            <li><a href="/cookies" class="hover:text-white transition-colors">Política de Cookies</a></li>
            <li><a href="/sitemap.xml" class="hover:text-white transition-colors">Mapa do Site (XML)</a></li>
          </ul>
        </div>
      </div>
      <div class="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <span>© ${new Date().getFullYear()} ${SITE_INFO.name}. Todos os direitos reservados.</span>
        <span>${SITE_INFO.address}</span>
      </div>
    </div>
    <button type="button" id="nj-scroll-top" class="hidden fixed bottom-6 right-6 z-50 p-3 bg-brand-700 hover:bg-brand-800 text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-110 cursor-pointer" title="Voltar ao topo da página" aria-label="Voltar ao topo da página">${SVG_ICONS.arrowUp}</button>
  </footer>
  <div id="nj-cookie-banner" role="region" aria-label="Aviso de Cookies e Privacidade" class="hidden fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 shadow-2xl">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="text-xs md:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
        <p class="font-semibold text-slate-900 dark:text-zinc-100 mb-1">Sua privacidade é prioridade no Norma Jurídica</p>
        <p class="news-summary">Utilizamos cookies para aprimorar sua experiência de navegação e personalizar conteúdo com segurança. Saiba mais em <a href="/cookies" class="text-brand-700 dark:text-brand-400 font-semibold underline">Política de Cookies</a> e <a href="/privacidade" class="text-brand-700 dark:text-brand-400 font-semibold underline">Privacidade</a>.</p>
      </div>
      <div class="flex items-center gap-2.5 flex-shrink-0 w-full md:w-auto">
        <button type="button" id="nj-cookie-essential" class="flex-1 md:flex-initial px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl cursor-pointer">Apenas essenciais</button>
        <button type="button" id="nj-cookie-all" class="flex-1 md:flex-initial px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer">Aceitar todos</button>
      </div>
    </div>
  </div>
  <script>
    (function() {
      function tick() {
        var now = new Date();
        var dEl = document.getElementById('nj-clock-date');
        var tEl = document.getElementById('nj-clock-time');
        if (dEl) {
          var ds = now.toLocaleDateString('pt-BR', { timeZone:'America/Sao_Paulo', weekday:'long', day:'numeric', month:'long', year:'numeric' });
          dEl.textContent = ds.charAt(0).toUpperCase() + ds.slice(1);
        }
        if (tEl) tEl.textContent = now.toLocaleTimeString('pt-BR', { timeZone:'America/Sao_Paulo', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
      }
      tick(); setInterval(tick, 1000);

      var themeBtn = document.getElementById('nj-theme-btn');
      function syncThemeUi() {
        var isDark = document.documentElement.classList.contains('dark');
        var lbl = document.getElementById('nj-theme-label');
        var ico = document.getElementById('nj-theme-icon');
        if (lbl) lbl.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
        if (ico) ico.innerHTML = isDark ? '${SVG_ICONS.sun}' : '${SVG_ICONS.moon}';
      }
      syncThemeUi();
      if (themeBtn) themeBtn.addEventListener('click', function() {
        var dark = document.documentElement.classList.toggle('dark');
        try { localStorage.setItem('nj_theme', dark ? 'dark' : 'light'); sessionStorage.setItem('nj_theme_session', dark ? 'dark' : 'light'); } catch(e){}
        syncThemeUi();
      });

      var fontBtn = document.getElementById('nj-font-btn');
      function applyFont(sz) {
        var lbl = document.getElementById('nj-font-label');
        document.documentElement.setAttribute('data-font-size', sz);
        document.documentElement.style.fontSize = sz === 'large' ? '18.5px' : sz === 'xlarge' ? '21px' : '16px';
        if (lbl) lbl.textContent = sz === 'large' ? 'A+' : sz === 'xlarge' ? 'A++' : 'A';
      }
      try { applyFont(localStorage.getItem('nj_font_size') || 'normal'); } catch(e){}
      if (fontBtn) fontBtn.addEventListener('click', function() {
        var cur = 'normal';
        try { cur = localStorage.getItem('nj_font_size') || 'normal'; } catch(e){}
        var next = cur === 'normal' ? 'large' : cur === 'large' ? 'xlarge' : 'normal';
        applyFont(next);
        try { localStorage.setItem('nj_font_size', next); } catch(e){}
      });

      function readBookmarks() {
        try {
          var raw = localStorage.getItem('nj_news_bookmarks') || localStorage.getItem('nj_bookmarks') || '[]';
          var parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch(e) { return []; }
      }
      function writeBookmarks(arr) {
        try {
          var raw = JSON.stringify(arr);
          localStorage.setItem('nj_news_bookmarks', raw);
          localStorage.setItem('nj_bookmarks', raw);
        } catch(e){}
      }
      function syncBookmarks() {
        var arr = readBookmarks();
        var cnt = document.getElementById('nj-bookmarks-count');
        var dLbl = document.getElementById('nj-drawer-bookmarks-label');
        if (cnt) cnt.textContent = String(arr.length);
        if (dLbl) dLbl.textContent = arr.length + (arr.length === 1 ? ' matéria' : ' matérias');
        document.querySelectorAll('.nj-bookmark-btn').forEach(function(btn) {
          var id = btn.getAttribute('data-bookmark-id');
          if (id && arr.indexOf(id) >= 0) {
            btn.classList.add('bg-brand-700', 'text-white');
            btn.classList.remove('bg-black/60');
          } else {
            btn.classList.remove('bg-brand-700');
            if (!btn.closest('.nj-article-action-bar')) btn.classList.add('bg-black/60');
          }
        });
        var favEmpty = document.getElementById('nj-fav-empty');
        if (document.body.getAttribute('data-active-cat') === 'favoritos') {
          var visibleCount = 0;
          document.querySelectorAll('.nj-news-card').forEach(function(card) {
            var slug = card.getAttribute('data-news-slug');
            var show = slug && arr.indexOf(slug) >= 0;
            card.style.display = show ? '' : 'none';
            if (show) visibleCount++;
          });
          if (favEmpty) favEmpty.classList.toggle('hidden', visibleCount > 0);
        }
      }
      syncBookmarks();
      document.querySelectorAll('.nj-bookmark-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          var id = btn.getAttribute('data-bookmark-id');
          if (!id) return;
          var list = readBookmarks();
          var idx = list.indexOf(id);
          if (idx >= 0) list.splice(idx, 1); else list.push(id);
          writeBookmarks(list);
          syncBookmarks();
        });
      });

      var listBtn = document.getElementById('bookmarks-tab-button');
      var listDrawer = document.getElementById('nj-list-drawer');
      var listBackdrop = document.getElementById('nj-list-backdrop');
      var listClose = document.getElementById('nj-list-close');
      function toggleDrawer(open) {
        if (!listDrawer || !listBackdrop) return;
        listDrawer.classList.toggle('hidden', !open);
        listDrawer.classList.toggle('flex', open);
        listBackdrop.classList.toggle('hidden', !open);
        if (listBtn) listBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      if (listBtn) listBtn.addEventListener('click', function() { toggleDrawer(listDrawer.classList.contains('hidden')); });
      if (listClose) listClose.addEventListener('click', function() { toggleDrawer(false); });
      if (listBackdrop) listBackdrop.addEventListener('click', function() { toggleDrawer(false); });

      var mobBtn = document.getElementById('nj-mobile-cat-btn');
      var mobMenu = document.getElementById('nj-mobile-cat-menu');
      if (mobBtn && mobMenu) mobBtn.addEventListener('click', function() { mobMenu.classList.toggle('hidden'); });

      var scrollTopBtn = document.getElementById('nj-scroll-top');
      if (scrollTopBtn) {
        window.addEventListener('scroll', function() { scrollTopBtn.classList.toggle('hidden', window.scrollY <= 350); }, { passive: true });
        scrollTopBtn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
      }

      var cookieBanner = document.getElementById('nj-cookie-banner');
      try {
        if (cookieBanner && !localStorage.getItem('nj_cookie_consent')) cookieBanner.classList.remove('hidden');
      } catch(e){}
      function saveCookie(all) {
        try { localStorage.setItem('nj_cookie_consent', JSON.stringify({ essential: true, analytics: all, advertising: all, timestamp: new Date().toISOString() })); } catch(e){}
        if (cookieBanner) cookieBanner.classList.add('hidden');
      }
      var cEss = document.getElementById('nj-cookie-essential'), cAll = document.getElementById('nj-cookie-all');
      if (cEss) cEss.addEventListener('click', function() { saveCookie(false); });
      if (cAll) cAll.addEventListener('click', function() { saveCookie(true); });
    })();
  </script>
</body>
</html>`;
}

async function handleApiRequest(request, env, url) {
  const pathname = url.pathname;

  if (pathname === '/api/health') {
    return jsonResponse(
      {
        status: 'healthy',
        app: SITE_INFO.name,
        domain: SITE_INFO.domain,
        timestamp: new Date().toISOString(),
        uptimeSeconds: 0,
        memoryRssMb: 0,
        environment: env.NODE_ENV || 'production',
        platform: 'cloudflare-worker',
      },
      200,
      { 'Cache-Control': 'no-store, max-age=0' }
    );
  }

  if (pathname === '/api/categories') {
    return jsonResponse(
      {
        success: true,
        total: ALL_CATEGORIES.length,
        categories: ALL_CATEGORIES.map((c) => ({ ...c, count: 0 })),
      },
      200,
      { 'Cache-Control': 'public, max-age=300, s-maxage=300' }
    );
  }

  if (pathname === '/api/news') {
    const category = url.searchParams.get('category') || 'all';
    const q = url.searchParams.get('q') || '';
    const sourceId = url.searchParams.get('sourceId') || '';
    const refresh = url.searchParams.get('refresh') === 'true';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '12', 10) || 12), 100);

    const data = await fetchAggregatedNews(env, { category, q, page, limit, sourceId, refresh });
    return jsonResponse(
      {
        items: data.items,
        source: 'cloudflare_worker_edge',
        total: data.total,
        page: data.page,
        limit: data.limit,
        totalPages: data.totalPages,
        isRealTime: true,
        updatedAt: new Date().toISOString(),
      },
      200,
      { 'Cache-Control': 'no-store, max-age=0' }
    );
  }

  if (pathname === '/api/news/article') {
    const slug = url.searchParams.get('slug') || url.searchParams.get('id') || '';
    const article = await findArticleBySlug(env, slug);
    const contentHtml = article?.contentHtml || '<p>O conteúdo completo desta reportagem está em atualização pela redação do Norma Jurídica.</p>';
    return jsonResponse(
      { success: true, slug, contentHtml },
      200,
      { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
    );
  }

  if (pathname === '/api/weather') {
    const q = url.searchParams.get('q') || 'Brasilia';
    const apiKey = String(env.WEATHER_API_KEY || env.api_key_clima || '').trim();
    const baseUrl = String(env.WEATHER_API_BASE_URL || env.api_url_clima_base || 'https://api.weatherapi.com/v1').replace(/\/+$/, '');
    if (apiKey) {
      try {
        const res = await fetch(`${baseUrl}/forecast.json?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&days=1&lang=pt`);
        if (res.ok) {
          const json = await res.json();
          const current = json.current || {};
          const location = json.location || {};
          const dayForecast = json.forecast?.forecastday?.[0]?.day;
          const uv = current.uv || 0;
          return jsonResponse({
            city: location.name || q,
            temperature: Math.round(current.temp_c || 26),
            feelsLike: Math.round(current.feelslike_c || 27),
            humidity: current.humidity || 58,
            condition: current.condition?.text || 'Ensolarado',
            conditionCode: String(current.condition?.code || '1000'),
            uvIndex: uv,
            uvDescription: uv >= 8 ? 'Muito Alto' : uv >= 6 ? 'Alto' : uv >= 3 ? 'Moderado' : 'Baixo',
            forecast: [
              {
                date: 'Hoje',
                maxTemp: Math.round(dayForecast?.maxtemp_c ?? 29),
                minTemp: Math.round(dayForecast?.mintemp_c ?? 18),
                condition: dayForecast?.condition?.text || current.condition?.text || 'Estável',
              },
            ],
            isFallback: false,
          });
        }
      } catch {}
    }

    return jsonResponse({
      city: 'Brasília',
      temperature: 26,
      feelsLike: 27,
      humidity: 58,
      condition: 'Ensolarado',
      conditionCode: '1000',
      uvIndex: 7,
      uvDescription: 'Alto',
      forecast: [{ date: 'Hoje', maxTemp: 29, minTemp: 18, condition: 'Sol com poucas nuvens' }],
      isFallback: true,
    });
  }

  if (pathname === '/api/audio') {
    const apiKey = String(env.ELEVENLABS_API_KEY || '').trim();
    if (request.method === 'GET') {
      return jsonResponse({ enabled: !!apiKey, provider: apiKey ? 'elevenlabs' : 'browser' });
    }
    const body = await request.json().catch(() => ({}));
    const text = String(body.text || '').slice(0, 4000).trim();
    if (!text) return jsonResponse({ error: 'Texto para síntese de áudio é obrigatório.' }, 400);
    if (!apiKey) {
      return jsonResponse({ enabled: false, fallback: 'web-speech', message: 'ElevenLabs não configurado. Utilizando síntese nativa do navegador.' });
    }
    const voiceId = String(env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM');
    const baseUrl = String(env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io/v1').replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { Accept: 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!res.ok) return jsonResponse({ enabled: false, fallback: 'web-speech' });
    return new Response(res.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' } });
  }

  if (pathname === '/api/contact' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const subject = String(body.subject || 'Contato Geral').trim();
    const message = String(body.message || '').trim();
    if (name.length < 2) return jsonResponse({ error: 'O nome informado deve ter pelo menos 2 caracteres.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'Por favor, informe um endereço de e-mail válido.' }, 400);
    if (message.length < 10) return jsonResponse({ error: 'A mensagem deve conter pelo menos 10 caracteres detalhando a solicitação.' }, 400);

    const now = new Date();
    const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
    const protocol = `NJ-${datePart}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    let emailSent = false;
    if (env.CONTACT_WEBHOOK_URL) {
      try {
        const hookRes = await fetch(String(env.CONTACT_WEBHOOK_URL), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ protocol, name, email, subject, message, timestamp: now.toISOString() }),
        });
        emailSent = hookRes.ok;
      } catch {}
    }

    return jsonResponse({
      success: true,
      protocol,
      emailSent,
      message: 'Manifestação registrada com sucesso. Anote o número de protocolo para acompanhamento.',
    });
  }

  if (pathname === '/api/sync') {
    const action = url.searchParams.get('action') || 'status';
    const { baseUrl } = resolveWorkerNewsApiConfig(env);
    const configuredSecret = String(env.REVALIDATE_SECRET || env.CRON_SECRET || '').trim();
    if ((action === 'sync' || action === 'prune' || action === 'export') && configuredSecret) {
      const authHeader = request.headers.get('authorization') || '';
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const provided = url.searchParams.get('secret') || url.searchParams.get('key') || bearer;
      if (!timingSafeCompare(provided, configuredSecret)) {
        return jsonResponse({ error: 'Ação restrita. Segredo ou token de autorização não fornecido ou inválido.' }, 401);
      }
    }
    if (action === 'export') {
      const exported = await fetchAggregatedNews(env, { category: 'all', limit: 100, page: 1 });
      return jsonResponse({
        exportedAt: new Date().toISOString(),
        total: exported.items.length,
        items: exported.items,
      });
    }
    const probeStart = Date.now();
    const probe = await fetchUpstreamJson(env, '/api/types', 3000);
    const latencyMs = Date.now() - probeStart;
    if (action === 'sync') {
      await fetchAggregatedNews(env, { category: 'all', limit: 100, refresh: true });
    }
    const payload = {
      status: 'conectado',
      connection: 'ativa',
      actionExecuted: action,
      storage: { engine: 'Cloudflare Worker Edge Cache', databasePath: 'edge-cache', isEphemeral: false, totalStored: 15000 },
      upstream: { status: probe ? 'conectado' : 'alerta', latencyMs, endpoint: baseUrl },
      timestamp: new Date().toISOString(),
    };
    const format = url.searchParams.get('format') || '';
    const accept = request.headers.get('accept') || '';
    if (format === 'html' || (!format && accept.includes('text/html'))) {
      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Status da Sincronização • Norma Jurídica</title><style>body{font-family:system-ui,sans-serif;background:#090d16;color:#f1f5f9;padding:24px}.box{max-width:680px;margin:24px auto;background:#131c2e;border:1px solid #1e293b;border-radius:16px;padding:28px}h1{margin:0 0 12px;font-size:20px}.tag{display:inline-block;padding:4px 12px;border-radius:999px;background:#065f46;color:#6ee7b7;font-size:12px;font-weight:700}p{font-size:14px;color:#cbd5e1}</style></head><body><div class="box"><span class="tag">● Cloudflare Worker Edge Ativo</span><h1>Sincronização &amp; Saúde do Portal</h1><p><strong>Upstream:</strong> ${escapeHtml(baseUrl)} (${escapeHtml(payload.upstream.status)}, ${latencyMs}ms)</p><p><strong>Engine:</strong> ${escapeHtml(payload.storage.engine)}</p><p><strong>Atualizado em:</strong> ${escapeHtml(payload.timestamp)}</p></div></body></html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return jsonResponse(payload);
  }

  if (pathname === '/api/revalidate') {
    const configuredSecret = String(env.REVALIDATE_SECRET || env.CRON_SECRET || '').trim();
    if (!configuredSecret) {
      return jsonResponse({ error: 'REVALIDATE_SECRET não configurado no ambiente do servidor.' }, 503);
    }
    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const provided = url.searchParams.get('secret') || bearer;
    if (!timingSafeCompare(provided, configuredSecret)) {
      return jsonResponse({ error: 'Segredo de revalidação inválido.' }, 401);
    }
    return jsonResponse({ revalidated: true, timestamp: new Date().toISOString(), message: 'Cache Edge revalidado com sucesso.' });
  }

  return null;
}

async function handleSeoRoutes(request, env, url) {
  const pathname = url.pathname;
  const baseUrl = getEffectiveBaseUrl(request, env);

  if (pathname === '/robots.txt') {
    const body = `User-Agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${baseUrl}/sitemap.xml\nSitemap: ${baseUrl}/sitemap-posts.xml\nSitemap: ${baseUrl}/sitemap-categories.xml\nSitemap: ${baseUrl}/sitemap-pages.xml\nSitemap: ${baseUrl}/sitemap-images.xml\n`;
    return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  if (pathname === '/manifest.webmanifest') {
    return new Response(
      JSON.stringify({
        name: SITE_INFO.name,
        short_name: SITE_INFO.shortName,
        description: SITE_INFO.description,
        start_url: '/',
        display: 'standalone',
        background_color: '#121316',
        theme_color: '#1d4ed8',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      }),
      { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' } }
    );
  }

  const acceptHeader = request.headers.get('accept') || '';
  const wantsHtml = acceptHeader.includes('text/html') && url.searchParams.get('format') !== 'xml' && url.searchParams.get('raw') !== '1';

  if (pathname === '/sitemap.xml') {
    const now = new Date().toISOString();
    const entries = [
      { url: `${baseUrl}/sitemap-posts.xml`, changefreq: 'hourly', priority: '1.0', title: 'Sitemap de Matérias e Reportagens', lastmod: now },
      { url: `${baseUrl}/sitemap-categories.xml`, changefreq: 'hourly', priority: '0.9', title: 'Sitemap de Editorias e Categorias Temáticas', lastmod: now },
      { url: `${baseUrl}/sitemap-pages.xml`, changefreq: 'weekly', priority: '0.8', title: 'Sitemap de Páginas Institucionais e Governança', lastmod: now },
      { url: `${baseUrl}/sitemap-images.xml`, changefreq: 'hourly', priority: '0.8', title: 'Sitemap de Acervo Fotográfico e Imagens Editoriais', lastmod: now },
    ];
    if (wantsHtml) {
      return new Response(
        renderWorkerSitemapHtml({
          title: 'Índice Geral de Sitemaps XML',
          description: 'Mapa de indexação estruturada para robôs de busca e indexadores mundiais.',
          entries,
          type: 'index',
        }),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
      .map((s) => `  <sitemap>\n    <loc>${escapeXml(s.url)}</loc>\n    <lastmod>${escapeXml(s.lastmod)}</lastmod>\n  </sitemap>`)
      .join('\n')}\n</sitemapindex>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  if (pathname === '/sitemap-categories.xml') {
    const now = new Date().toISOString();
    const entries = ALL_CATEGORIES.map((c) => ({
      url: `${baseUrl}/categoria/${c.slug}`,
      title: c.name,
      lastmod: now,
      changefreq: 'hourly',
      priority: c.highlight ? '0.9' : '0.8',
    }));
    if (wantsHtml) {
      return new Response(
        renderWorkerSitemapHtml({
          title: 'Sitemap de Editorias e Categorias',
          description: `Catálogo de todas as ${entries.length} seções e editorias ativas no portal Norma Jurídica.`,
          entries,
          type: 'categories',
        }),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
      .map((e) => `  <url>\n    <loc>${escapeXml(e.url)}</loc>\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>\n    <changefreq>${escapeXml(e.changefreq)}</changefreq>\n    <priority>${escapeXml(e.priority)}</priority>\n  </url>`)
      .join('\n')}\n</urlset>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  if (pathname === '/sitemap-pages.xml') {
    const now = new Date().toISOString();
    const entries = [
      { url: `${baseUrl}/`, title: 'Página Inicial', changefreq: 'always', priority: '1.0', lastmod: now },
      { url: `${baseUrl}/noticia`, title: 'Sala de Imprensa & Últimas Notícias', changefreq: 'always', priority: '0.9', lastmod: now },
      { url: `${baseUrl}/categoria`, title: 'Guia Editorial & Editorias', changefreq: 'hourly', priority: '0.9', lastmod: now },
      { url: `${baseUrl}/pagina`, title: 'Índice de Páginas Institucionais', changefreq: 'weekly', priority: '0.8', lastmod: now },
      ...Object.entries(INSTITUTIONAL_PAGES).map(([slug, p]) => ({
        url: `${baseUrl}/pagina/${slug}`,
        title: p.title,
        changefreq: 'monthly',
        priority: '0.8',
        lastmod: now,
      })),
      { url: `${baseUrl}/pagina/gestao-publica-municipal`, title: 'Gestão Pública Municipal', changefreq: 'monthly', priority: '0.7', lastmod: now },
      { url: `${baseUrl}/contato`, title: 'Contato da Redação e Atendimento', changefreq: 'monthly', priority: '0.8', lastmod: now },
      { url: `${baseUrl}/privacidade`, title: 'Política de Privacidade', changefreq: 'monthly', priority: '0.7', lastmod: now },
      { url: `${baseUrl}/termos`, title: 'Termos e Condições de Uso', changefreq: 'monthly', priority: '0.7', lastmod: now },
      { url: `${baseUrl}/cookies`, title: 'Política e Gestão de Cookies', changefreq: 'monthly', priority: '0.7', lastmod: now },
    ];
    if (wantsHtml) {
      return new Response(
        renderWorkerSitemapHtml({
          title: 'Sitemap de Páginas Institucionais e Governança',
          description: 'Estrutura institucional completa do portal Norma Jurídica.',
          entries,
          type: 'pages',
        }),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
      .map((e) => `  <url>\n    <loc>${escapeXml(e.url)}</loc>\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>\n    <changefreq>${escapeXml(e.changefreq)}</changefreq>\n    <priority>${escapeXml(e.priority)}</priority>\n  </url>`)
      .join('\n')}\n</urlset>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  if (pathname === '/sitemap-posts.xml' || pathname === '/sitemap-images.xml') {
    const { items } = await fetchAggregatedNews(env, { category: 'all', limit: 100, page: 1 });
    if (pathname === '/sitemap-images.xml') {
      const entries = items
        .filter((i) => i.imageUrl)
        .map((i) => ({
          url: `${baseUrl}/noticia/${i.slug}`,
          title: i.title,
          lastmod: i.isoDate || new Date().toISOString(),
          changefreq: 'hourly',
          priority: '0.8',
          images: [{ loc: i.imageUrl, title: i.title, caption: `Registro editorial Norma Jurídica • ${i.category}` }],
        }));
      if (wantsHtml) {
        return new Response(
          renderWorkerSitemapHtml({
            title: 'Sitemap de Imagens e Registros Visuais',
            description: `Acervo fotográfico e registros editoriais com ${entries.length} matérias ilustradas no portal Norma Jurídica.`,
            entries,
            type: 'images',
          }),
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries
        .map((e) => `  <url>\n    <loc>${escapeXml(e.url)}</loc>\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>\n    <changefreq>${escapeXml(e.changefreq)}</changefreq>\n    <priority>${escapeXml(e.priority)}</priority>\n    <image:image>\n      <image:loc>${escapeXml(e.images[0].loc)}</image:loc>\n      <image:title>${escapeXml(e.images[0].title)}</image:title>\n      <image:caption>${escapeXml(e.images[0].caption)}</image:caption>\n    </image:image>\n  </url>`)
        .join('\n')}\n</urlset>`;
      return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
    }
    const entries = items.map((i) => ({
      url: `${baseUrl}/noticia/${i.slug}`,
      title: i.title,
      lastmod: i.isoDate || new Date().toISOString(),
      changefreq: 'hourly',
      priority: '1.0',
    }));
    if (wantsHtml) {
      return new Response(
        renderWorkerSitemapHtml({
          title: 'Sitemap de Matérias e Reportagens',
          description: `Listagem canônica de ${entries.length} notícias persistidas e ativas no portal Norma Jurídica.`,
          entries,
          type: 'posts',
        }),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
      .map((e) => `  <url>\n    <loc>${escapeXml(e.url)}</loc>\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>\n    <changefreq>${escapeXml(e.changefreq)}</changefreq>\n    <priority>${escapeXml(e.priority)}</priority>\n  </url>`)
      .join('\n')}\n</urlset>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  return null;
}

export function splitTextForTts(text = '', maxLen = 180) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const rawParts = clean.split(/(?<=[.?!;:])\s+/);
  const chunks = [];
  for (const part of rawParts) {
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
    for (const w of words) {
      if (!cur) cur = w;
      else if (cur.length + 1 + w.length <= maxLen) cur += ' ' + w;
      else {
        chunks.push(cur);
        cur = w;
      }
    }
    if (cur) chunks.push(cur);
  }
  return chunks.filter(Boolean);
}

async function renderStandaloneHtmlPage(request, env, url) {
  const pathname = url.pathname;
  const baseUrl = getEffectiveBaseUrl(request, env);
  const { baseUrl: newsApiBase } = resolveWorkerNewsApiConfig(env);
  let newsApiOrigin = DEFAULT_NEWS_API_BASE_URL;
  try {
    newsApiOrigin = new URL(newsApiBase).origin;
  } catch {}
  const adsenseId = String(env.NEXT_PUBLIC_ADSENSE_ID || '');
  const ogDefault = `${baseUrl}/og-image.png`;

  // 1. Página de Matéria (/noticia/[slug])
  if (pathname.startsWith('/noticia/')) {
    const slug = pathname.slice('/noticia/'.length).replace(/\/+$/, '');
    const article = await findArticleBySlug(env, slug);
    if (!article) {
      return Response.redirect(`${baseUrl}/`, 307);
    }

    const { items: relatedPool } = await fetchAggregatedNews(env, { category: article.categoryId || 'all', limit: 10, page: 1 });
    const related = relatedPool.filter((n) => n.slug !== article.slug).slice(0, 3);
    const mostRead = relatedPool.slice(0, 5);
    const points = buildKeyPoints(article);
    const featuredImg = article.imageUrl || '/cover.png';
    const pageUrl = `${baseUrl}/noticia/${article.slug}`;
    const shareTitle = encodeURIComponent(article.title);
    const shareUrl = encodeURIComponent(pageUrl);

    const html = `${renderSharedHead({
      title: `${article.title} | ${SITE_INFO.name}`,
      description: article.summary,
      canonicalUrl: pageUrl,
      ogImageUrl: article.imageUrl || ogDefault,
      newsApiOrigin,
      adsenseId,
    })}
    ${renderHeaderAndNav(article.categoryId, relatedPool)}
    <main id="main-content" class="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
      <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-6 flex-wrap">
        <a href="/" class="hover:text-brand-700 dark:hover:text-brand-400 transition-colors">Início</a>${SVG_ICONS.chevronRight}
        <a href="/categoria/${escapeHtml(article.categoryId)}" class="hover:text-brand-700 dark:hover:text-brand-400 transition-colors uppercase font-bold text-[11px]">${escapeHtml(article.category)}</a>${SVG_ICONS.chevronRight}
        <span class="text-slate-800 dark:text-zinc-200 line-clamp-1 max-w-md font-medium">${escapeHtml(article.title)}</span>
      </nav>
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <article class="lg:col-span-8">
          <span class="text-xs font-black uppercase tracking-widest text-brand-700 dark:text-brand-400 block mb-2">${escapeHtml(article.category)}</span>
          <h1 id="nj-article-title" class="text-2xl sm:text-3xl lg:text-5xl font-black text-slate-900 dark:text-zinc-50 leading-[1.12] tracking-tight mb-4">${escapeHtml(article.title)}</h1>
          <p id="nj-article-lead" class="news-description text-base sm:text-lg text-slate-600 dark:text-zinc-300 font-normal leading-relaxed mb-6 border-l-4 border-brand-700 pl-4 text-justify hyphens-none">${escapeHtml(article.summary)}</p>
          <div class="flex flex-wrap items-center justify-between gap-4 py-3.5 border-y border-slate-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400 mb-6">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center text-brand-700 dark:text-brand-400 font-black">${SVG_ICONS.user}</div>
              <div>
                <p class="font-bold text-slate-900 dark:text-zinc-100">${escapeHtml(article.author)}</p>
                <p class="text-[11px] text-slate-400">Redação</p>
              </div>
            </div>
            <div class="flex items-center gap-1.5 text-slate-500">${SVG_ICONS.clock}<span>Publicado ${escapeHtml(article.timeAgo)}</span></div>
          </div>
          <div class="nj-article-action-bar flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-2xl mb-8">
            <div class="flex items-center gap-2">
              <button type="button" id="nj-audio-btn" class="flex items-center gap-2 px-3 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm" title="Ouvir matéria">▶ Ouvir Notícia</button>
              <button type="button" id="nj-audio-speed" class="px-2.5 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-black transition-colors cursor-pointer" title="Velocidade de reprodução">1x</button>
              <span id="nj-audio-status" class="hidden text-[11px] font-semibold text-amber-600 dark:text-amber-400"></span>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" id="nj-article-font-btn" class="p-2 bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-brand-700 rounded-xl transition-colors cursor-pointer" title="Aumentar tamanho do texto" aria-label="Ajustar tamanho do texto">${SVG_ICONS.type}</button>
              <button type="button" data-bookmark-id="${escapeHtml(article.slug)}" class="nj-bookmark-btn p-2 rounded-xl transition-colors cursor-pointer bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-brand-700" title="Salvar Matéria" aria-label="Salvar Matéria">${SVG_ICONS.bookmark}</button>
              <button type="button" id="nj-copy-link" data-url="${escapeHtml(pageUrl)}" class="px-3 py-2 bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-brand-700 rounded-xl text-xs font-bold transition-colors cursor-pointer">Copiar Link</button>
            </div>
          </div>
          <div class="mb-6">
            <div class="zoom-frame group relative aspect-[16/9] w-full rounded-2xl overflow-hidden shadow-lg bg-slate-900 border border-slate-200 dark:border-zinc-800 cursor-pointer" data-pin-nopin="true" data-pin-no-hover="true">
              <img src="${escapeHtml(featuredImg)}" alt="${escapeHtml(article.title)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="w-full h-full object-cover group-hover:scale-105 hover:scale-105 transition-transform duration-700 ease-out" />
            </div>
            <p class="text-xs text-slate-500 dark:text-zinc-400 mt-2 italic px-1">Registro jornalístico editorial • ${escapeHtml(article.category)}</p>
          </div>
          <section class="mb-8 p-5 md:p-6 bg-gradient-to-br from-brand-50 to-blue-50/50 dark:from-zinc-900 dark:to-brand-950/30 border border-brand-200 dark:border-brand-900/50 rounded-2xl shadow-sm" aria-label="Resumo da Notícia">
            <div class="flex items-center gap-2 mb-3.5 text-brand-700 dark:text-brand-400">${SVG_ICONS.bookOpen}<h2 class="text-base font-black text-brand-900 dark:text-brand-300 uppercase tracking-tight">Resumo da Notícia</h2></div>
            <span class="text-xs font-bold text-brand-800 dark:text-brand-400 uppercase tracking-wider block mb-2.5">Pontos Principais:</span>
            <ul class="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
              ${points.map((p) => `<li class="flex items-start gap-2.5"><span class="text-brand-600 dark:text-brand-400 font-bold mt-0.5 flex-shrink-0">•</span><span class="justified-text text-justify hyphens-none leading-relaxed">${escapeHtml(p)}</span></li>`).join('')}
            </ul>
          </section>
          <div class="article-body prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 font-serif leading-8 text-base md:text-lg mb-8 text-justify hyphens-none">${article.contentHtml}</div>
          <script>
            (function(){
              var copyBtn = document.getElementById('nj-copy-link');
              function showCopyFeedback() {
                var shareBadge = document.getElementById('nj-share-copied');
                if (copyBtn) { copyBtn.textContent = 'Copiado!'; setTimeout(function(){ copyBtn.textContent = 'Copiar Link'; }, 2000); }
                if (shareBadge) { shareBadge.classList.remove('hidden'); setTimeout(function(){ shareBadge.classList.add('hidden'); }, 3500); }
              }
              if (copyBtn) copyBtn.addEventListener('click', function(){
                try { navigator.clipboard.writeText(copyBtn.getAttribute('data-url') || location.href); showCopyFeedback(); } catch(e){}
              });
              var igBtn = document.getElementById('nj-share-ig');
              if (igBtn) igBtn.addEventListener('click', function(){
                try { navigator.clipboard.writeText((document.getElementById('nj-article-title')?.textContent || '') + '\\n' + location.href); } catch(e){}
                showCopyFeedback();
              });
              var copyIconBtn = document.getElementById('nj-share-copy');
              if (copyIconBtn) copyIconBtn.addEventListener('click', function(){
                try { navigator.clipboard.writeText(location.href); showCopyFeedback(); } catch(e){}
              });
              var aFontBtn = document.getElementById('nj-article-font-btn');
              if (aFontBtn) aFontBtn.addEventListener('click', function(){ document.getElementById('nj-font-btn')?.click(); });

              var audioBtn = document.getElementById('nj-audio-btn');
              var speedBtn = document.getElementById('nj-audio-speed');
              var statusEl = document.getElementById('nj-audio-status');
              var rate = 1, playing = false, currentAudio = null, chunks = [], chunkIdx = 0, keepAlive = null, sessionSeq = 0;

              function splitSpeechChunks(text, maxLen) {
                var clean = String(text || '').replace(/\\s+/g, ' ').trim();
                if (!clean) return [];
                var parts = clean.split(/(?<=[.?!;:])\\s+/);
                var out = [];
                for (var i = 0; i < parts.length; i++) {
                  var p = parts[i];
                  if (p.length <= maxLen) {
                    if (out.length && out[out.length - 1].length + 1 + p.length <= maxLen) out[out.length - 1] += ' ' + p;
                    else out.push(p);
                  } else {
                    var words = p.split(' '), cur = '';
                    for (var j = 0; j < words.length; j++) {
                      var w = words[j];
                      if (!cur) cur = w;
                      else if (cur.length + 1 + w.length <= maxLen) cur += ' ' + w;
                      else { out.push(cur); cur = w; }
                    }
                    if (cur) out.push(cur);
                  }
                }
                return out;
              }
              function resetTtsUi() {
                playing = false;
                if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
                if (audioBtn) audioBtn.textContent = '▶ Ouvir Notícia';
              }
              function stopPlayback() {
                sessionSeq++;
                try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch(e){}
                if (currentAudio) { try { currentAudio.pause(); } catch(e){} currentAudio = null; }
                resetTtsUi();
              }
              function pickPtVoice() {
                try {
                  var voices = window.speechSynthesis.getVoices() || [];
                  return voices.find(function(v){ return v.lang && v.lang.toLowerCase().indexOf('pt-br') === 0; }) ||
                         voices.find(function(v){ return v.lang && v.lang.toLowerCase().indexOf('pt') === 0; }) || null;
                } catch(e) { return null; }
              }
              function speakChunk(idx, seq) {
                if (!playing || seq !== sessionSeq || idx >= chunks.length) { resetTtsUi(); return; }
                chunkIdx = idx;
                var u = new SpeechSynthesisUtterance(chunks[idx]);
                u.lang = 'pt-BR';
                u.rate = rate;
                var v = pickPtVoice();
                if (v) u.voice = v;
                u.onend = function() { if (seq === sessionSeq && playing) speakChunk(idx + 1, seq); };
                u.onerror = function(ev) {
                  if (seq !== sessionSeq) return;
                  if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) return;
                  resetTtsUi();
                };
                window.speechSynthesis.speak(u);
              }
              function startBrowserTts(fromIdx) {
                if (!('speechSynthesis' in window)) {
                  if (statusEl) { statusEl.textContent = 'Áudio indisponível neste navegador'; statusEl.classList.remove('hidden'); }
                  resetTtsUi();
                  return;
                }
                var t = (document.getElementById('nj-article-title')?.textContent || '') + '. ' +
                        (document.getElementById('nj-article-lead')?.textContent || '') + '. ' +
                        (document.querySelector('.article-body')?.textContent || '');
                if (!chunks.length || fromIdx === 0) chunks = splitSpeechChunks(t, 180);
                if (!chunks.length) { resetTtsUi(); return; }
                sessionSeq++;
                var mySeq = sessionSeq;
                try { window.speechSynthesis.cancel(); } catch(e){}
                playing = true;
                if (audioBtn) audioBtn.textContent = '⏸ Pausar';
                if (statusEl) statusEl.classList.add('hidden');
                if (keepAlive) clearInterval(keepAlive);
                keepAlive = setInterval(function(){
                  try {
                    if (playing && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
                      window.speechSynthesis.pause();
                      window.speechSynthesis.resume();
                    }
                  } catch(e){}
                }, 10000);
                var run = function(){ speakChunk(fromIdx || 0, mySeq); };
                var voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
                if (voices && voices.length) run();
                else {
                  var started = false;
                  if ('onvoiceschanged' in window.speechSynthesis) {
                    window.speechSynthesis.onvoiceschanged = function(){ if (!started) { started = true; run(); } };
                  }
                  setTimeout(function(){ if (!started) { started = true; run(); } }, 150);
                }
              }

              if (speedBtn) speedBtn.addEventListener('click', function(){
                rate = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 1;
                speedBtn.textContent = rate + 'x';
                if (currentAudio) { currentAudio.playbackRate = rate; }
                else if (playing) { startBrowserTts(chunkIdx); }
              });
              if (audioBtn) audioBtn.addEventListener('click', async function(){
                if (playing) { stopPlayback(); return; }
                playing = true;
                audioBtn.textContent = '⏸ Pausar';
                try {
                  var shortText = ((document.getElementById('nj-article-title')?.textContent || '') + '. ' + (document.getElementById('nj-article-lead')?.textContent || '')).slice(0, 3500);
                  var res = await fetch('/api/audio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: shortText }) });
                  if (res.ok && (res.headers.get('content-type') || '').indexOf('audio/mpeg') >= 0) {
                    var blob = await res.blob();
                    var urlObj = URL.createObjectURL(blob);
                    var a = new Audio(urlObj);
                    a.playbackRate = rate;
                    a.onended = resetTtsUi;
                    a.onerror = function(){ currentAudio = null; startBrowserTts(0); };
                    currentAudio = a;
                    await a.play();
                    return;
                  }
                } catch(e){}
                startBrowserTts(0);
              });
              window.addEventListener('beforeunload', stopPlayback);
            })();
          </script>
          <div class="p-5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl mb-12 shadow-sm">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="flex items-center gap-2">
                <span class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">Compartilhe esta informação</span>
                <span id="nj-share-copied" class="hidden ml-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">Link copiado!</span>
              </div>
              <div class="flex items-center gap-2.5 flex-wrap">
                <a href="https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer" title="Compartilhar no WhatsApp" aria-label="Compartilhar no WhatsApp"><svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.074-2.109-.508-1.745-.719-2.87-2.488-2.958-2.604-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.043.072.043.419-.101.824zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.66 1.434 5.176L2 22l4.954-1.399C8.423 21.492 10.155 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg></a>
                <a href="https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-slate-900 dark:bg-zinc-800 hover:bg-black text-white flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer" title="Compartilhar no X (Twitter)" aria-label="Compartilhar no X"><svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-[#1877F2] hover:bg-[#166fe5] text-white flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer" title="Compartilhar no Facebook" aria-label="Compartilhar no Facebook"><svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
                <a id="nj-share-ig" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-90 text-white flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer" title="Compartilhar no Instagram" aria-label="Compartilhar no Instagram"><svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a>
                <button type="button" id="nj-share-copy" class="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 flex items-center justify-center transition-all hover:scale-110 shadow-sm cursor-pointer" title="Copiar link da matéria" aria-label="Copiar link da matéria"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></button>
              </div>
            </div>
          </div>
          ${
            related.length > 0
              ? `<section class="mb-12" aria-label="Leia Também"><div class="flex items-center gap-2 mb-6"><div class="w-1.5 h-6 bg-brand-700 dark:bg-brand-500 rounded-full"></div><h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">Leia Também</h2></div><div class="grid grid-cols-1 md:grid-cols-3 gap-5">${related.map((r) => renderNewsCardHtml(r, 'grid')).join('')}</div></section>`
              : ''
          }
        </article>
        <aside class="lg:col-span-4 space-y-8">
          <div class="sticky top-20 space-y-8">
            <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
              <div class="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div class="w-1.5 h-5 bg-brand-700 rounded-full"></div>
                <h3 class="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-zinc-100">Mais Lidas • Em Alta</h3>
              </div>
              <div class="space-y-4">
                ${mostRead
                  .map(
                    (item, idx) => `<a href="/noticia/${escapeHtml(item.slug)}" class="group flex gap-3.5 items-start focus:outline-none"><span class="text-3xl font-black text-brand-700 dark:text-brand-400 w-6 flex-shrink-0 text-center leading-none">${idx + 1}</span><div class="flex-1 min-w-0"><span class="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-0.5">${escapeHtml(item.category)}</span><h4 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 group-hover:text-brand-700 dark:group-hover:text-brand-400 line-clamp-2 leading-snug transition-colors">${escapeHtml(item.title)}</h4><span class="text-[10px] text-slate-400 block mt-1">${escapeHtml(item.timeAgo)}</span></div></a>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
    ${renderFooterAndScripts()}`;

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // 2. Páginas Institucionais / Contato / Legais
  if (pathname === '/contato') {
    const html = `${renderSharedHead({
      title: `Contato da Redação | ${SITE_INFO.name}`,
      description: 'Envie sugestões de pauta, pedidos de correção editorial ou fale com a redação do Norma Jurídica.',
      canonicalUrl: `${baseUrl}/contato`,
      ogImageUrl: ogDefault,
      newsApiOrigin,
      adsenseId,
    })}
    ${renderHeaderAndNav('todas', [])}
    <main id="main-content" class="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
      <h1 class="text-3xl font-black mb-4">Fale com a Redação do Norma Jurídica</h1>
      <p class="text-sm text-slate-600 dark:text-zinc-400 mb-6">Telefone: ${SITE_INFO.phone} • E-mail: ${SITE_INFO.email} • ${SITE_INFO.address}</p>
      <form id="nj-contact-form" class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
        <input required name="name" placeholder="Nome completo" class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm" />
        <input required type="email" name="email" placeholder="E-mail para retorno" class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm" />
        <input required name="subject" value="Sugestão de Pauta" class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm" />
        <textarea required name="message" rows="5" placeholder="Sua mensagem..." class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-sm"></textarea>
        <button type="submit" class="px-6 py-3 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-sm font-bold cursor-pointer">Enviar Mensagem e Gerar Protocolo</button>
        <div id="nj-contact-result" class="text-sm font-bold"></div>
      </form>
      <script>
        document.getElementById('nj-contact-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          var fd = new FormData(e.target);
          var res = await fetch('/api/contact', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(Object.fromEntries(fd)) });
          var data = await res.json();
          var out = document.getElementById('nj-contact-result');
          out.textContent = data.protocol ? 'Protocolo gerado: ' + data.protocol : (data.error || 'Erro ao enviar.');
        });
      </script>
    </main>
    ${renderFooterAndScripts()}`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (pathname === '/pagina') {
    const html = `${renderSharedHead({
      title: `Institucional | ${SITE_INFO.name}`,
      description: 'Índice de páginas institucionais e governança editorial do portal Norma Jurídica.',
      canonicalUrl: `${baseUrl}/pagina`,
      ogImageUrl: ogDefault,
      newsApiOrigin,
      adsenseId,
    })}
    ${renderHeaderAndNav('todas', [])}
    <main id="main-content" class="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
      <h1 class="text-3xl font-black mb-6">Páginas Institucionais</h1>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${Object.entries(INSTITUTIONAL_PAGES).map(([s, p]) => `<a href="/pagina/${escapeHtml(s)}" class="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl hover:border-brand-600"><h2 class="font-bold text-base mb-1">${escapeHtml(p.title)}</h2><p class="text-xs text-slate-500">${escapeHtml(p.lead)}</p></a>`).join('')}
      </div>
    </main>
    ${renderFooterAndScripts()}`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (pathname.startsWith('/pagina/') || pathname === '/privacidade' || pathname === '/termos' || pathname === '/cookies') {
    const slug = pathname.startsWith('/pagina/') ? pathname.slice('/pagina/'.length).replace(/\/+$/, '') : pathname.slice(1);
    const pageData = INSTITUTIONAL_PAGES[slug] || {
      title: resolveCategoryDisplayName(slug),
      category: 'Institucional',
      lead: `Diretrizes e informações oficiais sobre ${resolveCategoryDisplayName(slug)} no portal ${SITE_INFO.name}.`,
      contentHtml: `<p>O portal <strong>${SITE_INFO.name}</strong> opera em conformidade com a legislação brasileira vigente, incluindo a LGPD (Lei nº 13.709/2018) e o Marco Civil da Internet.</p>`,
    };
    const html = `${renderSharedHead({
      title: `${pageData.title} | ${SITE_INFO.name}`,
      description: pageData.lead,
      canonicalUrl: `${baseUrl}${pathname}`,
      ogImageUrl: ogDefault,
      newsApiOrigin,
      adsenseId,
    })}
    ${renderHeaderAndNav('todas', [])}
    <main id="main-content" class="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
      <span class="text-xs font-black uppercase text-brand-700">${escapeHtml(pageData.category)}</span>
      <h1 class="text-3xl sm:text-4xl font-black mt-2 mb-4">${escapeHtml(pageData.title)}</h1>
      <p class="text-base text-slate-600 dark:text-zinc-300 border-l-4 border-brand-700 pl-4 mb-8">${escapeHtml(pageData.lead)}</p>
      <article class="article-body font-serif text-base md:text-lg">${pageData.contentHtml}</article>
    </main>
    ${renderFooterAndScripts()}`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // 3. Home (/) ou Editoria (/categoria/[slug] | /categoria | /noticia)
  const isHome = pathname === '/' || pathname === '/noticia' || pathname === '/categoria';
  const isCategory = pathname.startsWith('/categoria/');
  if (!isHome && !isCategory) {
    const html404 = `${renderSharedHead({
      title: `Página Não Encontrada | ${SITE_INFO.name}`,
      description: 'Conteúdo não localizado ou movido.',
      canonicalUrl: `${baseUrl}${pathname}`,
      ogImageUrl: ogDefault,
      newsApiOrigin,
      adsenseId,
    })}
    ${renderHeaderAndNav('todas', [])}
    <main id="main-content" class="flex-1 max-w-3xl w-full mx-auto px-4 py-16 text-center">
      <div class="w-16 h-16 bg-brand-700 text-white rounded-3xl flex items-center justify-center font-black text-3xl mx-auto mb-6">NJ</div>
      <span class="text-xs font-black uppercase tracking-wider text-brand-700 block mb-2">Erro 404 • Página Não Encontrada</span>
      <h1 class="text-3xl sm:text-4xl font-black mb-4">Conteúdo não localizado ou movido</h1>
      <a href="/" class="inline-block px-5 py-2.5 bg-brand-700 text-white rounded-xl text-xs font-bold mt-4">Ir para a Página Inicial</a>
    </main>
    ${renderFooterAndScripts()}`;
    return new Response(html404, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const articleQueryParam = url.searchParams.get('article');
  if (articleQueryParam) {
    return Response.redirect(`${baseUrl}/noticia/${encodeURIComponent(articleQueryParam)}`, 307);
  }

  const catQueryParam = url.searchParams.get('cat') || '';
  const isFavorites = catQueryParam === 'favoritos';
  const catSlug = isCategory ? pathname.slice('/categoria/'.length).replace(/\/+$/, '') : (isFavorites ? 'favoritos' : 'all');
  const q = url.searchParams.get('q') || '';
  const refresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('refresh') === 'true';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = isFavorites ? 100 : isCategory ? 12 : 24;
  const { items, totalPages } = await fetchAggregatedNews(env, { category: isFavorites ? 'all' : catSlug, q, page, limit, refresh });
  const catTitle = isFavorites ? 'Minha Lista' : isCategory ? resolveCategoryDisplayName(catSlug) : 'Destaques';
  const isInitialHighlights = !isCategory && !isFavorites && !q && page === 1 && items.length > 0;
  const heroSlides = isInitialHighlights ? items.slice(0, 10) : [];
  const feed = isInitialHighlights && items.length > 10 ? items.slice(10) : isInitialHighlights ? items.slice(1) : items;
  const mostRead = items.slice(0, 5);
  const firstHero = heroSlides[0] || null;
  const slidesJson = JSON.stringify(
    heroSlides.map((s) => ({
      slug: s.slug,
      title: s.title,
      summary: s.summary,
      category: s.category,
      author: s.author || 'Norma Jurídica',
      timeAgo: s.timeAgo,
      imageUrl: s.imageUrl || '/cover.png',
    }))
  ).replace(/</g, '\\u003c');

  const html = `${renderSharedHead({
    title: isCategory ? `Notícias sobre ${catTitle} | ${SITE_INFO.name}` : `${SITE_INFO.name} | ${SITE_INFO.tagline}`,
    description: SITE_INFO.description,
    canonicalUrl: isCategory ? `${baseUrl}/categoria/${catSlug}` : baseUrl,
    ogImageUrl: ogDefault,
    newsApiOrigin,
    adsenseId,
  })}
  ${renderHeaderAndNav(catSlug, items, q)}
  <main id="main-content" class="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
    ${
      !isCategory && !isFavorites
        ? `<section class="mb-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-sm">
            <div class="max-w-2xl"><h1 class="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-tight">Acompanhe as principais informações de economia, justiça, política e acontecimentos do Brasil.</h1></div>
            <div class="flex-shrink-0">
              <div id="nj-weather-card" class="rounded-2xl p-4 text-white bg-gradient-to-br from-amber-500 to-orange-600 shadow-md flex items-center justify-between gap-4 w-full md:w-84 border border-white/10">
                <div class="flex items-center gap-3">
                  <div class="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">${SVG_ICONS.sun.replace('w-3.5 h-3.5 text-amber-400', 'w-8 h-8 text-white drop-shadow')}</div>
                  <div>
                    <div class="flex items-baseline gap-1.5">
                      <span id="nj-weather-temp" class="text-3xl font-black tracking-tight">26°C</span>
                      <span id="nj-weather-city" class="text-xs text-white/80 font-medium">Brasília</span>
                    </div>
                    <p id="nj-weather-cond" class="text-xs text-white/90 font-medium capitalize line-clamp-1">Ensolarado</p>
                  </div>
                </div>
                <div class="text-right text-[11px] text-white/85 space-y-1 font-medium border-l border-white/20 pl-3">
                  <div id="nj-weather-feels">Sensação 27°</div>
                  <div id="nj-weather-hum">58% Umid.</div>
                  <div id="nj-weather-uv">UV 7 (Alto)</div>
                </div>
              </div>
            </div>
            <script>
              (function(){
                function loadW(qStr){
                  fetch('/api/weather?q=' + encodeURIComponent(qStr || 'Brasilia')).then(function(r){ return r.ok ? r.json() : null; }).then(function(w){
                    if (!w) return;
                    var t = document.getElementById('nj-weather-temp'), c = document.getElementById('nj-weather-city'),
                        cd = document.getElementById('nj-weather-cond'), f = document.getElementById('nj-weather-feels'),
                        h = document.getElementById('nj-weather-hum'), u = document.getElementById('nj-weather-uv'),
                        card = document.getElementById('nj-weather-card');
                    if (t) t.textContent = w.temperature + '°C';
                    if (c) c.textContent = w.city;
                    if (cd) cd.textContent = w.condition;
                    if (f) f.textContent = 'Sensação ' + w.feelsLike + '°';
                    if (h) h.textContent = w.humidity + '% Umid.';
                    if (u) u.textContent = 'UV ' + w.uvIndex + ' (' + w.uvDescription + ')';
                    if (card && w.condition) {
                      var cl = w.condition.toLowerCase();
                      var grad = 'from-blue-600 to-indigo-700';
                      if (cl.indexOf('chuva') >= 0 || cl.indexOf('garoa') >= 0) grad = 'from-sky-700 to-blue-900';
                      else if (cl.indexOf('tempestade') >= 0 || cl.indexOf('trovoada') >= 0) grad = 'from-purple-800 to-indigo-950';
                      else if (cl.indexOf('nublado') >= 0 || cl.indexOf('encoberto') >= 0) grad = 'from-slate-600 to-slate-800';
                      else if (cl.indexOf('sol') >= 0 || cl.indexOf('ensolarado') >= 0) grad = 'from-amber-500 to-orange-600';
                      card.className = 'rounded-2xl p-4 text-white bg-gradient-to-br ' + grad + ' shadow-md flex items-center justify-between gap-4 w-full md:w-84 border border-white/10';
                    }
                  }).catch(function(){});
                }
                loadW('Brasilia');
              })();
            </script>
          </section>`
        : `<div class="mb-8 pb-4 border-b border-slate-200 dark:border-zinc-800"><h1 class="text-3xl sm:text-4xl font-black tracking-tight">${escapeHtml(catTitle)}</h1></div>`
    }
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-zinc-800">
      <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">${escapeHtml(catTitle)}${
        q ? ` <span class="text-sm font-normal text-slate-500">(busca por: "${escapeHtml(q)}")</span>` : ''
      }</h2>
      <div class="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 self-end sm:self-auto">
        <button type="button" id="nj-view-grid-btn" class="p-2 rounded-lg text-xs font-bold transition-all cursor-pointer bg-white dark:bg-zinc-800 text-brand-700 dark:text-brand-400 shadow-sm" title="Exibição em Grade" aria-label="Exibição em grade"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg></button>
        <button type="button" id="nj-view-compact-btn" class="p-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100" title="Exibição em Lista Compacta" aria-label="Exibição compacta"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg></button>
      </div>
    </div>
    <div id="nj-fav-empty" class="${isFavorites ? 'hidden ' : 'hidden '}text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 mb-8">
      <div class="w-16 h-16 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-4">${SVG_ICONS.bookmark}</div>
      <h3 class="text-lg font-black text-slate-900 dark:text-zinc-100 mb-2">Nenhuma matéria salva ainda</h3>
      <p class="text-sm text-slate-500 max-w-md mx-auto mb-6">Clique no ícone de marcador nas matérias que deseja salvar para leitura posterior.</p>
      <a href="/" class="px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2">Ver todas as notícias</a>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
      <div class="lg:col-span-8 space-y-10">
        ${
          firstHero
            ? `<section id="nj-featured-carousel" class="mb-10" aria-label="Destaques Principais">
                <div class="relative w-full aspect-[16/9] rounded-3xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-zinc-800 shadow-xl group">
                  <div class="relative w-full h-full overflow-hidden zoom-frame" data-pin-nopin="true" data-pin-no-hover="true">
                    <img id="nj-hero-img" src="${escapeHtml(firstHero.imageUrl || '/cover.png')}" alt="${escapeHtml(firstHero.title)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="w-full h-full object-cover group-hover:scale-105 hover:scale-105 transition-transform duration-700 ease-out" />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
                    <div class="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent hidden md:block"></div>
                    <div class="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2 flex-wrap z-10">
                      <span id="nj-hero-cat" class="text-xs font-black uppercase tracking-wider text-white bg-brand-700 px-3.5 py-1.5 rounded-full shadow-md">${escapeHtml(firstHero.category)}</span>
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 p-5 sm:p-8 md:p-10 text-white flex flex-col justify-end z-10">
                      <div class="flex items-center gap-4 text-xs text-slate-300 font-medium mb-3">
                        <span class="flex items-center gap-1.5 text-brand-400">${SVG_ICONS.user}<span id="nj-hero-author" class="text-slate-300">${escapeHtml(firstHero.author || 'Norma Jurídica')}</span></span>
                        <span class="flex items-center gap-1.5 text-brand-400">${SVG_ICONS.clock}<span id="nj-hero-time" class="text-slate-300">${escapeHtml(firstHero.timeAgo)}</span></span>
                      </div>
                      <a id="nj-hero-link" href="/noticia/${escapeHtml(firstHero.slug)}" class="block group/link focus:outline-none mb-3">
                        <h3 id="nj-hero-title" class="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-snug text-white group-hover/link:text-brand-300 transition-all duration-300 line-clamp-3 max-w-4xl">${escapeHtml(firstHero.title)}</h3>
                      </a>
                      <p id="nj-hero-summary" class="news-description text-xs sm:text-sm md:text-base text-slate-200 line-clamp-2 md:line-clamp-3 mb-4 max-w-3xl font-normal text-justify hyphens-none leading-relaxed hidden sm:block">${escapeHtml(firstHero.summary)}</p>
                      <div class="flex items-center gap-3">
                        <a id="nj-hero-cta" href="/noticia/${escapeHtml(firstHero.slug)}" class="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 hover:bg-brand-600 text-white rounded-xl text-xs sm:text-sm font-black transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-md cursor-pointer group/btn"><span>Ler Reportagem Completa</span><span class="group-hover/btn:translate-x-1 transition-transform">→</span></a>
                      </div>
                    </div>
                  </div>
                  <div class="absolute bottom-0 left-0 right-0 bg-slate-800/80 h-1 overflow-hidden z-20">
                    <div id="nj-hero-progress" class="h-full bg-gradient-to-r from-brand-600 via-brand-500 to-sky-400 origin-left animate-slide-progress"></div>
                  </div>
                </div>
                <script>
                  (function(){
                    var slides = ${slidesJson};
                    if (!slides || slides.length <= 1) return;
                    var idx = 0, paused = false, timer = null;
                    var box = document.getElementById('nj-featured-carousel');
                    var prog = document.getElementById('nj-hero-progress');
                    function renderSlide(i) {
                      var s = slides[i]; if (!s) return;
                      var img = document.getElementById('nj-hero-img'), cat = document.getElementById('nj-hero-cat'),
                          auth = document.getElementById('nj-hero-author'), tm = document.getElementById('nj-hero-time'),
                          lnk = document.getElementById('nj-hero-link'), ttl = document.getElementById('nj-hero-title'),
                          sum = document.getElementById('nj-hero-summary'), cta = document.getElementById('nj-hero-cta');
                      if (img) { img.src = s.imageUrl || '/cover.png'; img.alt = s.title; }
                      if (cat) cat.textContent = s.category;
                      if (auth) auth.textContent = s.author;
                      if (tm) tm.textContent = s.timeAgo;
                      if (lnk) lnk.href = '/noticia/' + s.slug;
                      if (ttl) ttl.textContent = s.title;
                      if (sum) sum.textContent = s.summary;
                      if (cta) cta.href = '/noticia/' + s.slug;
                      if (prog) { prog.classList.remove('animate-slide-progress'); void prog.offsetWidth; prog.classList.add('animate-slide-progress'); }
                    }
                    function schedule() {
                      if (timer) clearTimeout(timer);
                      if (paused) return;
                      timer = setTimeout(function(){ idx = (idx + 1) % slides.length; renderSlide(idx); schedule(); }, 6000);
                    }
                    if (box) {
                      box.addEventListener('mouseenter', function(){ paused = true; if (timer) clearTimeout(timer); if (prog) prog.style.animationPlayState = 'paused'; });
                      box.addEventListener('mouseleave', function(){ paused = false; if (prog) prog.style.animationPlayState = 'running'; schedule(); });
                    }
                    schedule();
                  })();
                </script>
              </section>`
            : ''
        }
        <section id="feed-section" aria-label="Notícias">
          <div id="nj-feed-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-6">${feed.map((n) => renderNewsCardHtml(n, 'grid')).join('')}</div>
          <div id="nj-feed-compact" class="hidden space-y-4">${feed.map((n) => renderNewsCardHtml(n, 'compact')).join('')}</div>
          <script>
            (function(){
              ${isFavorites ? "document.body.setAttribute('data-active-cat', 'favoritos');" : ''}
              var gBtn = document.getElementById('nj-view-grid-btn'), cBtn = document.getElementById('nj-view-compact-btn');
              var gBox = document.getElementById('nj-feed-grid'), cBox = document.getElementById('nj-feed-compact');
              function setMode(m) {
                var isG = m !== 'compact';
                if (gBox) gBox.classList.toggle('hidden', !isG);
                if (cBox) cBox.classList.toggle('hidden', isG);
                if (gBtn) gBtn.className = 'p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ' + (isG ? 'bg-white dark:bg-zinc-800 text-brand-700 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100');
                if (cBtn) cBtn.className = 'p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ' + (!isG ? 'bg-white dark:bg-zinc-800 text-brand-700 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100');
              }
              if (gBtn) gBtn.addEventListener('click', function(){ setMode('grid'); });
              if (cBtn) cBtn.addEventListener('click', function(){ setMode('compact'); });
            })();
          </script>
        </section>
        ${renderPaginationHtml(isCategory ? `/categoria/${catSlug}` : '/', page, totalPages)}
      </div>
      <aside class="lg:col-span-4 space-y-8">
        <div class="sticky top-20 space-y-8">
          <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div class="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div class="w-1.5 h-5 bg-brand-700 rounded-full"></div>
              <h3 class="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-zinc-100">Mais Lidas • Em Alta</h3>
            </div>
            <div class="space-y-4">
              ${mostRead
                .map(
                  (item, idx) => `<div class="group flex gap-3.5 items-start"><span class="text-3xl font-black text-brand-700 dark:text-brand-400 w-6 flex-shrink-0 text-center leading-none">${idx + 1}</span><div class="flex-1 min-w-0"><span class="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-0.5">${escapeHtml(item.category)}</span><a href="/noticia/${escapeHtml(item.slug)}" class="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 group-hover:text-brand-700 dark:group-hover:text-brand-400 line-clamp-2 leading-snug transition-colors">${escapeHtml(item.title)}</a><span class="text-[10px] text-slate-400 block mt-1">${escapeHtml(item.timeAgo)}</span></div></div>`
                )
                .join('')}
            </div>
          </div>
        </div>
      </aside>
    </div>
  </main>
  ${renderFooterAndScripts()}`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

const workerHandler = {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Canonicalização HTTPS e redirecionamento www -> news.mirandinhacontabilidade.workers.dev
    const canonicalRedirect = resolveDnsAndCanonical(request);
    if (canonicalRedirect) {
      return applySecurityHeaders(canonicalRedirect, pathname);
    }

    // 2. Servir arquivos estáticos do diretório /public (cover.png, og-image.png, icons, ads.txt, etc.) via ASSETS binding
    if (
      env.ASSETS &&
      (request.method === 'GET' || request.method === 'HEAD') &&
      (/\.(png|jpg|jpeg|gif|svg|webp|ico|txt|json|css|js|woff2?)$/i.test(pathname) || pathname.startsWith('/_next/static/')) &&
      pathname !== '/robots.txt' &&
      !pathname.endsWith('.xml')
    ) {
      try {
        const assetRes = await env.ASSETS.fetch(request);
        if (assetRes && assetRes.status !== 404) {
          return applySecurityHeaders(assetRes, pathname);
        }
      } catch {}
    }

    // 3. Modo Híbrido (se ORIGIN_URL externa válida e sem loop DNS estiver configurada)
    const originUrl = resolveSafeOriginUrl(env, url, request.headers);
    if (originUrl) {
      try {
        const target = new URL(pathname + url.search, originUrl);
        const proxyHeaders = new Headers(request.headers);
        proxyHeaders.set('X-Forwarded-Host', url.host);
        proxyHeaders.set('X-Forwarded-Proto', 'https');
        proxyHeaders.set('x-nj-worker-hop', String(parseInt(request.headers.get('x-nj-worker-hop') || '0', 10) + 1));

        const upstreamRes = await fetch(
          new Request(target.toString(), {
            method: request.method,
            headers: proxyHeaders,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: 'manual',
          })
        );

        // Se o origin Node.js responder com sucesso, devolve exatamente a mesma interface Node.js
        if (upstreamRes.status < 500) {
          return applySecurityHeaders(upstreamRes, pathname);
        }
      } catch {
        // Fallback automático para o modo Standalone Edge caso o origin Node.js esteja temporariamente indisponível
      }
    }

    // 4. Modo Standalone Cloudflare Worker (mesmas rotas de API, SEO e UI do servidor Node.js)
    const apiRes = await handleApiRequest(request, env, url);
    if (apiRes) return applySecurityHeaders(apiRes, pathname);

    const seoRes = await handleSeoRoutes(request, env, url);
    if (seoRes) return applySecurityHeaders(seoRes, pathname);

    const pageRes = await renderStandaloneHtmlPage(request, env, url);
    return applySecurityHeaders(pageRes, pathname);
  },

  async scheduled(_event, env = {}, ctx) {
    const task = (async () => {
      await fetchAggregatedNews(env, { category: 'all', limit: 100, refresh: true });
      const safeOrigin = resolveSafeOriginUrl(env, new URL(CANONICAL_ORIGIN), new Headers());
      const cronSecret = String(env.REVALIDATE_SECRET || env.CRON_SECRET || '').trim();
      if (safeOrigin) {
        const syncUrl = new URL('/api/sync?action=sync', safeOrigin);
        if (cronSecret) syncUrl.searchParams.set('secret', cronSecret);
        await fetch(syncUrl.toString(), { method: 'GET' }).catch(() => {});
      }
    })();

    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(task);
    } else {
      await task;
    }
  },
};

export default workerHandler;

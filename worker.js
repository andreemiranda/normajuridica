// worker.js — Cloudflare Workers Multiplatform Entry Point for Norma Jurídica
// Mantém paridade completa de interface, rotas e contratos JSON com o servidor Node.js (server.js),
// com suporte híbrido (Proxy resiliente para ORIGIN_URL quando configurado OU execução 100% Edge Standalone),
// prevenção de loops DNS (Error 1000 / 1014 / 508) para normajuridica.com.br e leitura exclusiva de secrets no env.

const DEFAULT_NEWS_API_BASE_URL = 'https://news-sources-api.legislativemunicipal.workers.dev';
const CANONICAL_DOMAIN = 'normajuridica.com.br';
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
  email: `contato@${CANONICAL_DOMAIN}`,
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
    'User-Agent': 'NormaJuridica/1.0 (+https://normajuridica.com.br)',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }
  return headers;
}

/**
 * Resolve redirecionamentos canônicos e correções de protocolo/DNS para normajuridica.com.br.
 * Não redireciona localhost, 127.0.0.1, *.workers.dev ou ambientes de preview temporários.
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

function sanitizeArticleHtmlForWorker(html = '', featuredImage = '') {
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

  // Deduplica imagens iguais à imagem destacada e força abertura segura em links externos/arquivos
  const seenImgs = new Set();
  if (featuredImage) seenImgs.add(featuredImage.split('?')[0]);
  out = out.replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi, (full, src) => {
    const clean = src.trim();
    const key = clean.split('?')[0];
    if (!/^https?:\/\//i.test(clean) || seenImgs.has(key)) return '';
    seenImgs.add(key);
    return `<figure class="my-6"><img src="${escapeHtml(clean)}" alt="Imagem da reportagem" loading="lazy" referrerpolicy="no-referrer" class="w-full h-auto rounded-2xl border border-slate-200 dark:border-zinc-800" /></figure>`;
  });

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
  const cacheKeyUrl = `https://edge-cache.normajuridica.com.br/news?cat=${encodeURIComponent(normCat || 'all')}&sid=${encodeURIComponent(sourceId)}`;

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
        if (fs === 'large') document.documentElement.style.fontSize = '18.5px';
        else if (fs === 'xlarge') document.documentElement.style.fontSize = '21px';
      } catch(e) {}
    })();
  </script>
  ${adsenseId ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapeHtml(adsenseId)}" crossorigin="anonymous"></script>` : ''}
  <style>
    @keyframes marquee { 0%{transform:translateX(0%)} 100%{transform:translateX(-50%)} }
    .animate-marquee { display:flex; width:max-content; animation:marquee 85s linear infinite; }
    .animate-marquee:hover { animation-play-state:paused; }
    .article-body p { margin-bottom:1.15rem; text-align:justify; line-height:1.8; }
    .article-body h2,.article-body h3 { font-weight:800; margin:1.5rem 0 .75rem; }
  </style>
</head>
<body class="bg-slate-50/50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 min-h-screen flex flex-col font-sans transition-colors duration-200">
  <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-brand-700 focus:text-white focus:rounded-xl">Pular para o conteúdo principal</a>`;
}

function renderHeaderAndNav(activeCategorySlug = 'todas', tickerNews = []) {
  const thematic = ALL_CATEGORIES.filter((c) => c.group === 'tema');
  const regional = ALL_CATEGORIES.filter((c) => c.group === 'regiao');
  const normActive = normalizeCategoryText(activeCategorySlug) || 'todas';

  const tabHtml = (c) => {
    const active = normActive === c.slug || (c.slug === 'todas' && (normActive === 'all' || normActive === 'todas'));
    const href = c.slug === 'todas' ? '/' : `/categoria/${c.slug}`;
    return `<a href="${href}" class="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
      active
        ? 'text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 ring-1 ring-brand-200 dark:ring-brand-800'
        : 'text-slate-600 dark:text-zinc-400 hover:text-brand-700 dark:hover:text-brand-400 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60'
    }">${escapeHtml(c.name)}</a>`;
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
          <a href="/pagina/editorial" class="hover:text-white text-[11px] font-medium">Editorial</a>
          <a href="/pagina/expediente" class="hover:text-white text-[11px] font-medium">Expediente</a>
          <a href="/pagina/fale-conosco" class="hover:text-white text-[11px] font-medium">Fale Conosco</a>
          <a href="/pagina/linha-editorial" class="hover:text-white text-[11px] font-medium">Linha Editorial</a>
          <span class="text-zinc-700 hidden sm:inline">|</span>
          <button type="button" id="nj-font-btn" class="hover:text-white text-[11px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 cursor-pointer" title="Ajustar tamanho da fonte">A</button>
          <button type="button" id="nj-theme-btn" class="hover:text-white text-[11px] font-semibold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 cursor-pointer">Modo Escuro</button>
        </div>
      </div>
    </div>
    <div class="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
      <a href="/" class="flex items-center gap-3 focus:outline-none">
        <div class="w-11 h-11 bg-brand-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl tracking-tighter shadow-md">NJ</div>
        <div>
          <span class="text-2xl font-black tracking-tight text-slate-900 dark:text-white block leading-none">NORMA <span class="text-brand-700 dark:text-brand-400">JURÍDICA</span></span>
          <p class="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">${SITE_INFO.tagline}</p>
        </div>
      </a>
      <div class="flex items-center gap-2.5 w-full md:w-auto justify-end">
        <form action="/" method="GET" class="relative flex-1 md:w-64">
          <input type="search" name="q" placeholder="Buscar notícias..." aria-label="Buscar notícias" class="w-full pl-3.5 pr-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </form>
        <a href="/?refresh=1" class="p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold hover:text-brand-700" title="Atualizar feed de notícias" aria-label="Atualizar feed de notícias">↻</a>
        <a href="/?cat=favoritos" class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold hover:text-brand-700">
          <span>Minha Lista</span>
          <span id="nj-bookmarks-count" class="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800">0</span>
        </a>
      </div>
    </div>
  </header>
  ${
    tickerDuplicated.length > 0
      ? `<div class="bg-brand-950 text-white border-b border-brand-900/60 overflow-hidden py-2" aria-label="Notícias de Última Hora">
          <div class="max-w-7xl mx-auto px-4 flex items-center gap-3">
            <div class="flex-shrink-0 bg-brand-800 text-amber-300 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider">⚡ Última Hora</div>
            <div class="overflow-hidden relative w-full">
              <div class="animate-marquee whitespace-nowrap flex items-center gap-8 py-0.5">
                ${tickerDuplicated
                  .map(
                    (item) => `<a href="/noticia/${escapeHtml(item.slug)}" class="inline-flex items-center gap-2 text-xs md:text-sm text-slate-200 hover:text-white"><span class="text-[11px] font-extrabold uppercase text-brand-300 bg-brand-900/80 px-1.5 py-0.5 rounded">${escapeHtml(item.category)}</span><span class="font-medium text-slate-100 max-w-[360px] truncate">${escapeHtml(item.title)}</span><span class="text-[11px] text-slate-400">(${escapeHtml(item.timeAgo)})</span><span class="text-slate-600 font-bold ml-4">•</span></a>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>`
      : ''
  }
  <nav class="relative z-40 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-xs" aria-label="Editorias e Categorias">
    <div class="max-w-7xl mx-auto px-4 py-2 space-y-1.5">
      <div class="flex flex-wrap items-center gap-1.5">${thematic.map(tabHtml).join('')}</div>
      <div class="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-zinc-800/60">
        <span class="text-[10px] uppercase font-black tracking-wider text-slate-400 mr-1">Estados:</span>
        ${regional.map(tabHtml).join('')}
      </div>
    </div>
  </nav>`;
}

function renderNewsCardHtml(item) {
  const imgSrc = item.imageUrl || '/cover.png';
  return `
  <article class="group flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
    <div class="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-zinc-800">
      <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <a href="/noticia/${escapeHtml(item.slug)}" class="absolute inset-0 block z-0" aria-label="${escapeHtml(item.title)}"></a>
      <button type="button" data-bookmark-id="${escapeHtml(item.slug)}" class="nj-bookmark-btn absolute top-2.5 right-2.5 z-10 p-1.5 bg-black/60 hover:bg-brand-700 text-white rounded-xl shadow-md text-xs cursor-pointer" title="Salvar matéria" aria-label="Salvar matéria">🔖</button>
    </div>
    <div class="p-4 md:p-5 flex-1 flex flex-col justify-between">
      <div>
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-1.5">${escapeHtml(item.category)}</span>
        <a href="/noticia/${escapeHtml(item.slug)}" class="block focus:outline-none">
          <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 hover:text-brand-700 dark:hover:text-brand-400 leading-snug line-clamp-3 mb-2.5">${escapeHtml(item.title)}</h3>
        </a>
        <p class="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 line-clamp-3 leading-relaxed mb-4 text-justify">${escapeHtml(item.summary)}</p>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-zinc-800">
        <span class="truncate max-w-[150px]">${escapeHtml(item.author || 'Norma Jurídica')}</span>
        <span>${escapeHtml(item.timeAgo)}</span>
      </div>
    </div>
  </article>`;
}

function renderPaginationHtml(baseUrl, currentPage, totalPages) {
  if (totalPages <= 1) return '';
  const sep = baseUrl.includes('?') ? '&' : '?';
  const prev = currentPage > 1 ? `<a href="${baseUrl}${sep}page=${currentPage - 1}" class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold hover:border-brand-600">← Anterior</a>` : '';
  const next = currentPage < totalPages ? `<a href="${baseUrl}${sep}page=${currentPage + 1}" class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold hover:border-brand-600">Próxima →</a>` : '';
  return `<div class="flex items-center justify-between gap-4 pt-6">${prev}<span class="text-xs font-bold text-slate-500 mx-auto">Página ${currentPage} de ${totalPages}</span>${next}</div>`;
}

function renderFooterAndScripts() {
  return `
  <footer class="bg-slate-900 text-slate-300 border-t border-slate-800 mt-16">
    <div class="max-w-7xl mx-auto px-4 py-12 md:py-16">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
        <div class="lg:col-span-4 space-y-4">
          <a href="/" class="inline-flex items-center gap-2.5">
            <div class="w-9 h-9 bg-brand-700 rounded-xl flex items-center justify-center text-white font-black text-xl">NJ</div>
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
            <li><a href="/" class="hover:text-white">Todas as Notícias</a></li>
            <li><a href="/categoria/politica" class="hover:text-white">Política</a></li>
            <li><a href="/categoria/economia" class="hover:text-white">Economia</a></li>
            <li><a href="/categoria/justica" class="hover:text-white">Justiça</a></li>
            <li><a href="/categoria/educacao" class="hover:text-white">Educação</a></li>
            <li><a href="/categoria/saude" class="hover:text-white">Saúde</a></li>
            <li><a href="/categoria/esporte" class="hover:text-white">Esporte</a></li>
            <li><a href="/categoria/para" class="hover:text-white">Pará</a></li>
            <li><a href="/categoria/tocantins" class="hover:text-white">Tocantins</a></li>
          </ul>
        </div>
        <div class="lg:col-span-3">
          <h3 class="text-xs font-black uppercase tracking-wider text-white mb-4">Institucional &amp; Governança</h3>
          <ul class="space-y-2 text-xs md:text-sm">
            <li><a href="/pagina/sobre" class="hover:text-white">Sobre o Portal</a></li>
            <li><a href="/pagina/linha-editorial" class="hover:text-white">Linha Editorial e Ética</a></li>
            <li><a href="/pagina/transparencia" class="hover:text-white">Transparência</a></li>
            <li><a href="/pagina/ouvidoria" class="hover:text-white">Ouvidoria Geral</a></li>
            <li><a href="/pagina/cadastro-certo" class="hover:text-white">Cadastro Certo</a></li>
          </ul>
        </div>
        <div class="lg:col-span-2">
          <h3 class="text-xs font-black uppercase tracking-wider text-white mb-4">Legal &amp; Contato</h3>
          <ul class="space-y-2 text-xs md:text-sm">
            <li><a href="/contato" class="hover:text-white">Fale com a Redação</a></li>
            <li><a href="/privacidade" class="hover:text-white">Privacidade</a></li>
            <li><a href="/termos" class="hover:text-white">Termos de Uso</a></li>
            <li><a href="/cookies" class="hover:text-white">Política de Cookies</a></li>
            <li><a href="/sitemap.xml" class="hover:text-white">Mapa do Site (XML)</a></li>
          </ul>
        </div>
      </div>
      <div class="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500">
        <span>© ${new Date().getFullYear()} ${SITE_INFO.name}. Todos os direitos reservados.</span>
        <span>${SITE_INFO.address}</span>
      </div>
    </div>
  </footer>
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
      if (themeBtn) themeBtn.addEventListener('click', function() {
        var dark = document.documentElement.classList.toggle('dark');
        try { localStorage.setItem('nj_theme', dark ? 'dark' : 'light'); sessionStorage.setItem('nj_theme_session', dark ? 'dark' : 'light'); } catch(e){}
      });
      var fontBtn = document.getElementById('nj-font-btn');
      if (fontBtn) fontBtn.addEventListener('click', function() {
        var cur = 'normal';
        try { cur = localStorage.getItem('nj_font_size') || 'normal'; } catch(e){}
        var next = cur === 'normal' ? 'large' : cur === 'large' ? 'xlarge' : 'normal';
        document.documentElement.style.fontSize = next === 'large' ? '18.5px' : next === 'xlarge' ? '21px' : '16px';
        try { localStorage.setItem('nj_font_size', next); } catch(e){}
      });
      function syncBookmarks() {
        try {
          var list = JSON.parse(localStorage.getItem('nj_bookmarks') || '[]');
          var arr = Array.isArray(list) ? list : [];
          var cnt = document.getElementById('nj-bookmarks-count');
          if (cnt) cnt.textContent = String(arr.length);
          document.querySelectorAll('.nj-bookmark-btn').forEach(function(btn) {
            var id = btn.getAttribute('data-bookmark-id');
            if (id && arr.indexOf(id) >= 0) {
              btn.classList.add('bg-brand-700');
              btn.classList.remove('bg-black/60');
            } else {
              btn.classList.remove('bg-brand-700');
              btn.classList.add('bg-black/60');
            }
          });
        } catch(e){}
      }
      syncBookmarks();
      document.querySelectorAll('.nj-bookmark-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          var id = btn.getAttribute('data-bookmark-id');
          if (!id) return;
          try {
            var list = JSON.parse(localStorage.getItem('nj_bookmarks') || '[]');
            var idx = list.indexOf(id);
            if (idx >= 0) list.splice(idx, 1); else list.push(id);
            localStorage.setItem('nj_bookmarks', JSON.stringify(list));
            syncBookmarks();
          } catch(err){}
        });
      });
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

  if (pathname === '/sitemap.xml') {
    const now = new Date().toISOString();
    const sitemaps = ['sitemap-posts.xml', 'sitemap-categories.xml', 'sitemap-pages.xml', 'sitemap-images.xml'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps
      .map((s) => `  <sitemap>\n    <loc>${escapeXml(`${baseUrl}/${s}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n  </sitemap>`)
      .join('\n')}\n</sitemapindex>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  if (pathname === '/sitemap-categories.xml') {
    const now = new Date().toISOString();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ALL_CATEGORIES
      .map((c) => `  <url>\n    <loc>${escapeXml(`${baseUrl}/categoria/${c.slug}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>${c.highlight ? '0.9' : '0.8'}</priority>\n  </url>`)
      .join('\n')}\n</urlset>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  if (pathname === '/sitemap-pages.xml') {
    const now = new Date().toISOString();
    const paths = ['/', '/contato', '/privacidade', '/termos', '/cookies', ...Object.keys(INSTITUTIONAL_PAGES).map((s) => `/pagina/${s}`)];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
      .map((p) => `  <url>\n    <loc>${escapeXml(`${baseUrl}${p}`)}</loc>\n    <lastmod>${escapeXml(now)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`)
      .join('\n')}\n</urlset>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  if (pathname === '/sitemap-posts.xml' || pathname === '/sitemap-images.xml') {
    const { items } = await fetchAggregatedNews(env, { category: 'all', limit: 100, page: 1 });
    if (pathname === '/sitemap-images.xml') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${items
        .filter((i) => i.imageUrl)
        .map((i) => `  <url>\n    <loc>${escapeXml(`${baseUrl}/noticia/${i.slug}`)}</loc>\n    <image:image>\n      <image:loc>${escapeXml(i.imageUrl)}</image:loc>\n      <image:title>${escapeXml(i.title)}</image:title>\n    </image:image>\n  </url>`)
        .join('\n')}\n</urlset>`;
      return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items
      .map((i) => `  <url>\n    <loc>${escapeXml(`${baseUrl}/noticia/${i.slug}`)}</loc>\n    <lastmod>${escapeXml(i.isoDate)}</lastmod>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>`)
      .join('\n')}\n</urlset>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  return null;
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
      <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs text-slate-500 mb-6 flex-wrap">
        <a href="/" class="hover:text-brand-700">Início</a><span>›</span>
        <a href="/categoria/${escapeHtml(article.categoryId)}" class="hover:text-brand-700 uppercase font-bold">${escapeHtml(article.category)}</a><span>›</span>
        <span class="text-slate-800 dark:text-zinc-200 line-clamp-1 max-w-md font-medium">${escapeHtml(article.title)}</span>
      </nav>
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <article class="lg:col-span-8">
          <span class="text-xs font-black uppercase tracking-widest text-brand-700 dark:text-brand-400 block mb-2">${escapeHtml(article.category)}</span>
          <h1 class="text-2xl sm:text-3xl lg:text-5xl font-black text-slate-900 dark:text-zinc-50 leading-tight mb-4">${escapeHtml(article.title)}</h1>
          <p class="text-base sm:text-lg text-slate-600 dark:text-zinc-300 leading-relaxed mb-6 border-l-4 border-brand-700 pl-4 text-justify">${escapeHtml(article.summary)}</p>
          <div class="flex flex-wrap items-center justify-between gap-4 py-3.5 border-y border-slate-200 dark:border-zinc-800 text-xs text-slate-500 mb-6">
            <div><strong class="text-slate-900 dark:text-zinc-100">${escapeHtml(article.author)}</strong> • Redação</div>
            <div>Publicado ${escapeHtml(article.timeAgo)}</div>
          </div>
          <div class="mb-6">
            <div class="relative aspect-[16/9] w-full rounded-2xl overflow-hidden shadow-lg bg-slate-900 border border-slate-200 dark:border-zinc-800">
              <img src="${escapeHtml(featuredImg)}" alt="${escapeHtml(article.title)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="absolute inset-0 w-full h-full object-cover" />
            </div>
          </div>
          <section class="mb-8 p-5 md:p-6 bg-blue-50/70 dark:bg-zinc-900 border border-brand-200 dark:border-brand-900/50 rounded-2xl" aria-label="Resumo da Notícia">
            <h2 class="text-base font-black text-brand-900 dark:text-brand-300 uppercase tracking-tight mb-3">Resumo da Notícia</h2>
            <ul class="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 list-disc pl-5">
              ${points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
            </ul>
          </section>
          <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 rounded-2xl mb-6">
            <div class="flex items-center gap-2">
              <button type="button" id="nj-audio-btn" class="px-3.5 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold cursor-pointer">▶ Ouvir Notícia</button>
              <button type="button" id="nj-audio-speed" class="px-2.5 py-2 bg-slate-200 dark:bg-zinc-800 rounded-xl text-xs font-black cursor-pointer">1x</button>
            </div>
            <button type="button" id="nj-copy-link" data-url="${escapeHtml(pageUrl)}" class="px-3 py-2 bg-slate-200 dark:bg-zinc-800 rounded-xl text-xs font-bold cursor-pointer">Copiar Link</button>
          </div>
          <div class="article-body font-serif text-base md:text-lg text-slate-800 dark:text-zinc-200 mb-10">${article.contentHtml}</div>
          <script>
            (function(){
              var copyBtn = document.getElementById('nj-copy-link');
              if (copyBtn) copyBtn.addEventListener('click', function(){
                try { navigator.clipboard.writeText(copyBtn.getAttribute('data-url') || location.href); copyBtn.textContent = 'Copiado!'; setTimeout(function(){ copyBtn.textContent = 'Copiar Link'; }, 2000); } catch(e){}
              });
              var audioBtn = document.getElementById('nj-audio-btn'), speedBtn = document.getElementById('nj-audio-speed'), rate = 1, playing = false;
              if (speedBtn) speedBtn.addEventListener('click', function(){ rate = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 0.75 : 1; speedBtn.textContent = rate + 'x'; });
              if (audioBtn && 'speechSynthesis' in window) audioBtn.addEventListener('click', function(){
                if (playing) { window.speechSynthesis.cancel(); playing = false; audioBtn.textContent = '▶ Ouvir Notícia'; return; }
                var body = document.querySelector('.article-body');
                var u = new SpeechSynthesisUtterance((document.querySelector('h1')?.textContent || '') + '. ' + (body ? body.textContent : ''));
                u.lang = 'pt-BR'; u.rate = rate;
                u.onend = function(){ playing = false; audioBtn.textContent = '▶ Ouvir Notícia'; };
                playing = true; audioBtn.textContent = '⏸ Pausar'; window.speechSynthesis.speak(u);
              });
            })();
          </script>
          <div class="p-5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl mb-12 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span class="text-xs font-black uppercase tracking-wider">Compartilhe esta informação</span>
            <div class="flex items-center gap-2.5">
              <a href="https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold text-xs" title="WhatsApp">WA</a>
              <a href="https://twitter.com/intent/tweet?text=${shareTitle}&url=${shareUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs" title="X">X</a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold text-xs" title="Facebook">FB</a>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white flex items-center justify-center font-bold text-xs" title="Instagram">IG</a>
            </div>
          </div>
          ${
            related.length > 0
              ? `<section class="mb-12" aria-label="Leia Também"><h2 class="text-xl md:text-2xl font-black mb-6">Leia Também</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-5">${related.map(renderNewsCardHtml).join('')}</div></section>`
              : ''
          }
        </article>
        <aside class="lg:col-span-4">
          <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <h3 class="text-sm font-black uppercase tracking-wider mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">Mais Lidas • Em Alta</h3>
            <div class="space-y-4">
              ${mostRead
                .map(
                  (item, idx) => `<a href="/noticia/${escapeHtml(item.slug)}" class="group flex gap-3.5 items-start"><span class="text-3xl font-black text-brand-700 w-6 text-center leading-none">${idx + 1}</span><div><span class="text-[10px] font-extrabold uppercase text-brand-700 block">${escapeHtml(item.category)}</span><h4 class="text-xs sm:text-sm font-bold group-hover:text-brand-700 line-clamp-2">${escapeHtml(item.title)}</h4></div></a>`
                )
                .join('')}
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
  const catSlug = isCategory ? pathname.slice('/categoria/'.length).replace(/\/+$/, '') : 'all';
  const q = url.searchParams.get('q') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = isCategory ? 12 : 24;
  const { items, totalPages } = await fetchAggregatedNews(env, { category: catSlug, q, page, limit });
  const catTitle = isCategory ? resolveCategoryDisplayName(catSlug) : 'Destaques';
  const hero = !isCategory && !q && page === 1 ? items[0] : null;
  const feed = hero ? items.slice(1) : items;
  const mostRead = items.slice(0, 5);

  const html = `${renderSharedHead({
    title: isCategory ? `Notícias sobre ${catTitle} | ${SITE_INFO.name}` : `${SITE_INFO.name} | ${SITE_INFO.tagline}`,
    description: SITE_INFO.description,
    canonicalUrl: isCategory ? `${baseUrl}/categoria/${catSlug}` : baseUrl,
    ogImageUrl: ogDefault,
    newsApiOrigin,
    adsenseId,
  })}
  ${renderHeaderAndNav(catSlug, items)}
  <main id="main-content" class="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
    ${
      !isCategory
        ? `<section class="mb-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-sm">
            <div class="max-w-2xl"><h1 class="text-xl sm:text-2xl md:text-3xl font-black tracking-tight leading-tight">Acompanhe as principais informações de economia, justiça, política e acontecimentos do Brasil.</h1></div>
            <div id="nj-weather-card" class="rounded-2xl p-4 text-white bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md w-full md:w-80">
              <div id="nj-weather-main" class="text-2xl font-black">26°C • Brasília</div>
              <div id="nj-weather-sub" class="text-xs text-white/90">Ensolarado • Sensação 27°</div>
            </div>
            <script>
              fetch('/api/weather?q=Brasilia').then(function(r){return r.ok?r.json():null}).then(function(w){
                if(!w)return;
                var m=document.getElementById('nj-weather-main'),s=document.getElementById('nj-weather-sub');
                if(m)m.textContent=w.temperature+'°C • '+w.city;
                if(s)s.textContent=w.condition+' • Sensação '+w.feelsLike+'° • UV '+w.uvIndex;
              }).catch(function(){});
            </script>
          </section>`
        : `<div class="mb-8 pb-4 border-b border-slate-200 dark:border-zinc-800"><h1 class="text-3xl sm:text-4xl font-black tracking-tight">${escapeHtml(catTitle)}</h1></div>`
    }
    <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-zinc-800">
      <h2 class="text-xl md:text-2xl font-black tracking-tight">${escapeHtml(catTitle)}${q ? ` (busca: "${escapeHtml(q)}")` : ''}</h2>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
      <div class="lg:col-span-8 space-y-10">
        ${
          hero
            ? `<section aria-label="Destaques Principais" class="relative w-full aspect-[16/9] rounded-3xl overflow-hidden bg-slate-900 shadow-xl">
                <img src="${escapeHtml(hero.imageUrl || '/cover.png')}" alt="${escapeHtml(hero.title)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="absolute inset-0 w-full h-full object-cover" />
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
                <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
                  <span class="text-xs font-black uppercase bg-brand-700 px-3 py-1 rounded-full">${escapeHtml(hero.category)}</span>
                  <a href="/noticia/${escapeHtml(hero.slug)}" class="block mt-3"><h3 class="text-xl sm:text-3xl font-black leading-snug hover:text-brand-300">${escapeHtml(hero.title)}</h3></a>
                  <p class="text-xs sm:text-sm text-slate-200 mt-2 line-clamp-2">${escapeHtml(hero.summary)}</p>
                </div>
              </section>`
            : ''
        }
        <section id="feed-section" aria-label="Notícias">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">${feed.map(renderNewsCardHtml).join('')}</div>
        </section>
        ${renderPaginationHtml(isCategory ? `/categoria/${catSlug}` : '/', page, totalPages)}
      </div>
      <aside class="lg:col-span-4 space-y-8">
        <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <h3 class="text-sm font-black uppercase tracking-wider mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">Mais Lidas • Em Alta</h3>
          <div class="space-y-4">
            ${mostRead
              .map(
                (item, idx) => `<div class="flex gap-3.5 items-start"><span class="text-3xl font-black text-brand-700 w-6 text-center leading-none">${idx + 1}</span><div><span class="text-[10px] font-extrabold uppercase text-brand-700 block">${escapeHtml(item.category)}</span><a href="/noticia/${escapeHtml(item.slug)}" class="text-xs sm:text-sm font-bold hover:text-brand-700 line-clamp-2">${escapeHtml(item.title)}</a></div></div>`
              )
              .join('')}
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

    // 1. Canonicalização HTTPS / apex e correção de DNS www -> normajuridica.com.br
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

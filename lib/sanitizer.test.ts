import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripHtmlTags,
  normalizeImageKey,
  deduplicateArticleImagesHtml,
  splitArticleHtmlIntoBlocks,
  repairAndSanitizeArticleHtml,
  isApiSourceDomain,
  isFileOrAssetUrl,
  extractSourceNewsSlug,
  processArticleLinksHtml,
  extractUnresolvedSourceNewsCandidates,
  matchSlugCandidate,
} from './sanitizer';
import { mergeDynamicCategories } from './sources';

test('stripHtmlTags strips complete and truncated unclosed img/anchor tags and s2-Norma Jurídica', () => {
  const truncated =
    '<img fetchpriority="high" decoding="async" width="900" height="610" src="https://s2-Norma Jurídica.glbimg.com/abc/photo.jpg" alt="Deputad';
  assert.equal(stripHtmlTags(truncated), '');

  const mixed =
    'O Atlético-MG foi derrotado pelo Flamengo. <a href="https://www.cnnbrasil.com.br/esporte';
  assert.equal(stripHtmlTags(mixed), 'O Atlético-MG foi derrotado pelo Flamengo.');

  const softHyphen = 'in\u00ADfor\u00ADma\u00ADção&shy; pública';
  assert.equal(stripHtmlTags(softHyphen), 'informação pública');
});

test('normalizeImageKey canonicalizes WP resized suffixes and glbimg proxy URLs', () => {
  assert.equal(
    normalizeImageKey('https://example.com/uploads/2026/11/photo-1024x683.webp'),
    normalizeImageKey('https://example.com/uploads/2026/11/photo.webp')
  );
  assert.equal(
    normalizeImageKey('https://s2-g1.glbimg.com/XYZ=/i.s3.glbimg.com/v1/AUTH/internal_photos/bs/2026/a/pic.jpg'),
    normalizeImageKey('https://s2-Norma Jurídica.glbimg.com/OTHER=/i.s3.glbimg.com/v1/AUTH/internal_photos/bs/2026/a/pic.jpg')
  );
});

test('deduplicateArticleImagesHtml removes featured image and duplicate body images while preserving context', () => {
  const featured = 'https://clebertoledo.com.br/wp-content/uploads/2026/11/CamaraPalmasCAPA900.webp';
  const html = `
    <figure><img src="${featured}" alt="Capa"></figure>
    <p>Primeiro parágrafo da matéria.</p>
    <p><img src="https://clebertoledo.com.br/wp-content/uploads/2026/11/ThamiresLimaCAPA900.webp" alt="Vereadora"></p>
    <p>Segundo parágrafo da matéria.</p>
    <p><img src="https://clebertoledo.com.br/wp-content/uploads/2026/11/ThamiresLimaCAPA900-1024x683.webp" alt="Duplicada"></p>
  `;
  const cleaned = deduplicateArticleImagesHtml(html, [featured]);
  assert.equal(cleaned.includes('CamaraPalmasCAPA900.webp'), false);
  const matches = cleaned.match(/ThamiresLimaCAPA900/g) || [];
  assert.equal(matches.length, 1);
  assert.equal(cleaned.includes('Primeiro parágrafo'), true);
  assert.equal(cleaned.includes('Segundo parágrafo'), true);
});

test('splitArticleHtmlIntoBlocks splits HTML around unique in-context images', () => {
  const featured = 'https://example.com/feat.jpg';
  const html = `
    <p>Introdução.</p>
    <p><img src="https://example.com/feat.jpg" alt="Featured"></p>
    <p>Meio do texto.</p>
    <p><img src="https://static.gazetaesportiva.com/uploads/2026/11/match.webp" alt="Jogo"></p>
    <p>Conclusão.</p>
  `;
  const blocks = splitArticleHtmlIntoBlocks(html, [featured]);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'html');
  assert.equal(blocks[1].type, 'image');
  if (blocks[1].type === 'image') {
    assert.equal(blocks[1].src, 'https://static.gazetaesportiva.com/uploads/2026/11/match.webp');
    assert.equal(blocks[1].alt, 'Jogo');
  }
  assert.equal(blocks[2].type, 'html');
});

test('repairAndSanitizeArticleHtml embeds mp4/mp3, repairs nested audio/broken video, and strips Gazeta dumps', () => {
  const html = `
    <p>https://cdn.example.com/video.mp4</p>
    <p>https://cdn.example.com/audio.mp3</p>
    <p>' href='https://static.gazetaesportiva.com/uploads/2026/11/AFP__20261105__AGIF868555.webp' data-thumb='https://static.gazetaesportiva.com/uploads/2026/11/AFP__20261105__AGIF868555.webp'> (Foto por MARCELLO ZAMBRANA / AGIF / AGIF VIA AFP)</p>
    Foto por MARCELLO ZAMBRANA / AGIF / AGIF VIA AFP)</p>Foto: Rubens Chiri / São Paulo FC)</p>
    <p><audio class="wp-audio-shortcode" controls="controls"><source type="audio/mpeg" src="https://anchor.fm/s/123/ep.mp3?_=2" /><a href="https://anchor.fm/s/123/ep.mp3"><audio controls><source src="https://anchor.fm/s/123/ep.mp3" type="audio/mpeg" /></audio></a></audio></p>
    <p>Podcast: <a href="https://anchor.fm/s/123/ep.mp3" class="powerpress_link_pinw">Play in new window</a> | <a href="#">Embed</a></p>
    <video controls class="w-full aspect-video object-contain bg-black">Seu navegador não suporta.</video>" target="_blank" rel="noopener noreferrer">Abrir vídeo original ↗</a></figcaption></figure>
    <p>Texto preservado da reportagem.</p>
  `;
  const res = repairAndSanitizeArticleHtml(html);
  assert.equal(res.includes('<video controls'), true);
  assert.equal((res.match(/<audio\b/gi) || []).length, 2);
  assert.equal(res.includes('wp-audio-shortcode'), false);
  assert.equal(res.includes('Play in new window'), false);
  assert.equal(res.includes('Abrir vídeo original'), false);
  assert.equal(res.includes('MARCELLO ZAMBRANA'), false);
  assert.equal(res.includes('Rubens Chiri'), false);
  assert.equal(res.includes('data-thumb'), false);
  assert.equal(res.includes('Texto preservado da reportagem.'), true);
});

test('mergeDynamicCategories prevents duplicate regional entries in thematic group', () => {
  const merged = mergeDynamicCategories(['Campos Gerais PR', 'Costa Verde RJ', 'Editoria de Pará', 'Direito Tributário']);
  const campos = merged.filter(c => c.name.includes('Campos Gerais'));
  assert.equal(campos.length, 1);
  assert.equal(campos[0].group, 'regiao');
  const costa = merged.filter(c => c.name.includes('Costa Verde'));
  assert.equal(costa.length, 1);
  assert.equal(costa[0].group, 'regiao');
  const trib = merged.find(c => c.slug === 'direito-tributario');
  assert.equal(trib?.group, 'tema');
});

test('isApiSourceDomain and isFileOrAssetUrl classify source domains and file links accurately', () => {
  assert.equal(isApiSourceDomain('www.cnnbrasil.com.br'), true);
  assert.equal(isApiSourceDomain('static.gazetaesportiva.com'), true);
  assert.equal(isApiSourceDomain('meusitejuridico.editorajuspodivm.com.br'), true);
  assert.equal(isApiSourceDomain('www.editorajuspodivm.com.br'), false);
  assert.equal(isApiSourceDomain('www.migalhas.com.br'), false);
  assert.equal(isApiSourceDomain('www.planalto.gov.br'), false);

  assert.equal(isFileOrAssetUrl('https://clebertoledo.com.br/wp-content/uploads/2026/11/PCCR-do-Quadro-Especial.pdf'), true);
  assert.equal(isFileOrAssetUrl('https://www.unitins.br/Concursos/Publico/Arquivo.docx?v=1'), true);
  assert.equal(isFileOrAssetUrl('https://www.cnnbrasil.com.br/esportes/futebol/botafogo-bate-o-atletico-mg/'), false);
});

test('extractSourceNewsSlug extracts article slugs and ignores taxonomy/query/file URLs', () => {
  assert.equal(
    extractSourceNewsSlug('https://www.cnnbrasil.com.br/esportes/futebol/atletico-mg/botafogo-bate-o-atletico-mg-e-respira/'),
    'botafogo-bate-o-atletico-mg-e-respira'
  );
  assert.equal(
    extractSourceNewsSlug('https://g1.globo.com/to/tocantins/noticia/2026/11/10/decreto-publica-novas-regras.ghtml'),
    'decreto-publica-novas-regras'
  );
  assert.equal(extractSourceNewsSlug('https://clebertoledo.com.br/tag/palmas/'), null);
  assert.equal(extractSourceNewsSlug('https://clebertoledo.com.br/?s=pccr'), null);
  assert.equal(extractSourceNewsSlug('https://clebertoledo.com.br/wp-content/uploads/2026/11/edital.pdf'), null);
});

test('processArticleLinksHtml enforces APP_URL/DB/home rules for source news and target=_blank for external and file links', () => {
  const sampleHtml = `
    <p>Veja o <a href="https://clebertoledo.com.br/wp-content/uploads/2026/11/PCCR.pdf">edital em PDF</a>.</p>
    <p>Leia na <a href="https://www.cnnbrasil.com.br/esportes/futebol/botafogo-bate-o-atletico-mg/">matéria presente no banco</a>.</p>
    <p>Confira também <a href="https://www.cnnbrasil.com.br/esportes/futebol/noticia-inexistente-no-banco/">matéria ausente no banco</a>.</p>
    <p>Arquivo por tag <a href="https://clebertoledo.com.br/tag/palmas/">Palmas</a>.</p>
    <p>Consulte a <a href="https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm">Lei 8.112</a> e <a href="https://www.migalhas.com.br/quentes/412345/decisao-stj-tributario">artigo no Migalhas</a>.</p>
    <p><a class="ez-toc-link" href="https://ambitojuridico.com.br/como-passar-a-guarda/#requisitos">Requisitos</a></p>
  `;

  const withAppUrl = processArticleLinksHtml(sampleHtml, {
    appUrl: 'https://portal.example.com/',
    appDomain: 'normajuridica.com.br',
    currentArticleSlug: 'como-passar-a-guarda',
    resolveSlugInDb: (slug) =>
      slug === 'botafogo-bate-o-atletico-mg' ? 'botafogo-bate-o-atletico-mg' : null,
  });

  // Source PDF preserved + opens in new tab
  assert.match(withAppUrl, /href="https:\/\/clebertoledo\.com\.br\/wp-content\/uploads\/2026\/11\/PCCR\.pdf"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  // Source article present in DB -> rewritten to APP_URL/noticia/<slug> without target=_blank
  assert.match(withAppUrl, /href="https:\/\/portal\.example\.com\/noticia\/botafogo-bate-o-atletico-mg"[^>]*data-app-link="true"/);
  assert.equal(withAppUrl.includes('botafogo-bate-o-atletico-mg" target="_blank"'), false);
  // Source article absent from DB -> directed to home APP_URL/ without target=_blank
  assert.match(withAppUrl, /href="https:\/\/portal\.example\.com\/"[^>]*data-app-link="true"/);
  assert.equal(withAppUrl.includes('noticia-inexistente-no-banco'), false);
  // Source non-article tag link -> preserved + target=_blank
  assert.match(withAppUrl, /href="https:\/\/clebertoledo\.com\.br\/tag\/palmas\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  // External site links (even with slug) -> preserved + target=_blank
  assert.match(withAppUrl, /href="https:\/\/www\.planalto\.gov\.br\/ccivil_03\/leis\/l8112cons\.htm"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  assert.match(withAppUrl, /href="https:\/\/www\.migalhas\.com\.br\/quentes\/412345\/decisao-stj-tributario"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
  // ez-toc-link -> rewritten to current article anchor without target=_blank
  assert.match(withAppUrl, /href="https:\/\/portal\.example\.com\/noticia\/como-passar-a-guarda#requisitos"[^>]*data-app-link="true"/);

  // Without APP_URL set -> relative internal paths /noticia/... and /
  const relativeMode = processArticleLinksHtml(sampleHtml, {
    appUrl: '',
    appDomain: 'normajuridica.com.br',
    currentArticleSlug: 'como-passar-a-guarda',
    resolveSlugInDb: (slug) =>
      slug === 'botafogo-bate-o-atletico-mg' ? 'botafogo-bate-o-atletico-mg' : null,
  });
  assert.match(relativeMode, /href="\/noticia\/botafogo-bate-o-atletico-mg"[^>]*data-app-link="true"/);
  assert.match(relativeMode, /href="\/"[^>]*data-app-link="true"/);

  // Pre-rewritten /noticia/<slug> stored in DB must also be re-checked against DB
  const storedHtml = `<p><a href="/noticia/ifsp-seleciona-longo-slug" data-app-link="true">Aqui</a> e <a href="/noticia/slug-que-nao-existe" data-app-link="true">Ausente</a></p>`;
  const rechecked = processArticleLinksHtml(storedHtml, {
    appUrl: 'https://portal.example.com',
    appDomain: 'normajuridica.com.br',
    resolveSlugInDb: (s) => (s === 'ifsp-seleciona-longo-slug' ? 'ifsp-seleciona-curto' : null),
  });
  assert.match(rechecked, /href="https:\/\/portal\.example\.com\/noticia\/ifsp-seleciona-curto"/);
  assert.match(rechecked, /href="https:\/\/portal\.example\.com\/"[^>]*data-app-link="true"/);
  assert.equal(rechecked.includes('slug-que-nao-existe'), false);
});

test('splitArticleHtmlIntoBlocks repairs multi-paragraph anchors around images without unclosed tags', () => {
  const brokenCnn = `
    <p><a href="https://www.cnnbrasil.com.br/esportes/botafogo-bate-o-atletico-mg/" class="read-too__link"></p>
    <p><img src="https://admin.cnnbrasil.com.br/wp-content/uploads/foto.jpg" alt="Botafogo" /></p>
    <p>Botafogo vence Atlético-MG</p>
    <p></a></p>
  `;
  const blocks = splitArticleHtmlIntoBlocks(brokenCnn, [], {
    appUrl: '',
    resolveSlugInDb: (s) => (s === 'botafogo-bate-o-atletico-mg' ? s : null),
  });
  assert.equal(blocks.some(b => b.type === 'image'), true);
  for (const b of blocks) {
    if (b.type === 'html') {
      const opens = (b.html.match(/<a\b/gi) || []).length;
      const closes = (b.html.match(/<\/a>/gi) || []).length;
      assert.equal(opens, closes);
      assert.match(b.html, /href="\/noticia\/botafogo-bate-o-atletico-mg"/);
    }
  }
});

test('extractUnresolvedSourceNewsCandidates finds unresolved API-source and /noticia candidates while skipping PDFs and external links', () => {
  const html = `
    <p><a href="https://www.cnnbrasil.com.br/esportes/ja-no-banco-de-dados/">No DB</a></p>
    <p><a href="https://www.cnnbrasil.com.br/esportes/disponivel-apenas-na-api/">Na API</a></p>
    <p><a href="/noticia/stored-missing-slug-to-verify-in-api" data-app-link="true">No Banco Antigo</a></p>
    <p><a href="https://clebertoledo.com.br/wp-content/uploads/2026/11/edital.pdf">PDF</a></p>
    <p><a href="https://www.migalhas.com.br/quentes/412345/artigo-externo-qualquer">Externo</a></p>
    <p><a href="https://www.cnnbrasil.com.br/esportes/materia-atual-em-leitura/#secao">Atual</a></p>
  `;
  const unresolved = extractUnresolvedSourceNewsCandidates(html, {
    currentArticleSlug: 'materia-atual-em-leitura',
    resolveSlugInDb: (s) => (s === 'ja-no-banco-de-dados' ? s : null),
  });
  assert.deepEqual(
    unresolved.map((u) => u.candidateSlug),
    ['disponivel-apenas-na-api', 'stored-missing-slug-to-verify-in-api']
  );
});

test('matchSlugCandidate matches exact, 85-char truncated, prefix, and token-overlap slugs while rejecting mismatches', () => {
  assert.equal(
    matchSlugCandidate(
      'ifsp-seleciona-alunos-para-a-especializacao-gratuita-em-gestao-estrategica-de-tecnologia-da-informacao-2027',
      'ifsp-seleciona-alunos-para-a-especializacao-gratuita-em-gestao-estrategica-de'
    ),
    true
  );
  assert.equal(
    matchSlugCandidate(
      'botafogo-vence-atletico-mg-no-brasileirao-2026-fora-de-casa',
      'botafogo-vence-atletico-mg-no-brasileirao-2026'
    ),
    true
  );
  assert.equal(
    matchSlugCandidate(
      'stf-decide-sobre-reforma-tributaria-hoje',
      'palmeiras-empata-com-flamengo-no-maracana'
    ),
    false
  );
});

test('deferred fallback preserves candidate slugs for API check before redirecting misses to home', () => {
  const html = `
    <p><a href="https://www.cnnbrasil.com.br/esportes/encontrada-na-api-agora/">Achada na API</a></p>
    <p><a href="https://www.cnnbrasil.com.br/esportes/nao-existe-nem-banco-nem-api/">Inexistente</a></p>
  `;
  // Pass 1 (DB read with deferMissingLinkFallback=true)
  const pass1 = processArticleLinksHtml(html, {
    appUrl: 'https://portal.example.com',
    resolveSlugInDb: () => null,
    deferMissingLinkFallback: true,
  });
  assert.match(pass1, /href="https:\/\/portal\.example\.com\/noticia\/encontrada-na-api-agora"/);
  assert.match(pass1, /href="https:\/\/portal\.example\.com\/noticia\/nao-existe-nem-banco-nem-api"/);

  // Pass 2 (after API lookup resolved first slug only)
  const apiFound = new Map<string, string>([['encontrada-na-api-agora', 'encontrada-na-api-agora']]);
  const pass2 = processArticleLinksHtml(pass1, {
    appUrl: 'https://portal.example.com',
    resolveSlugInDb: (c) => apiFound.get(c) ?? null,
    deferMissingLinkFallback: false,
  });
  assert.match(pass2, /href="https:\/\/portal\.example\.com\/noticia\/encontrada-na-api-agora"/);
  assert.match(pass2, /href="https:\/\/portal\.example\.com\/"[^>]*data-app-link="true"/);
  assert.equal(pass2.includes('nao-existe-nem-banco-nem-api'), false);
});



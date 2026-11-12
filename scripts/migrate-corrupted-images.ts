// scripts/migrate-corrupted-images.ts
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { repairAndSanitizeArticleHtml } from '../lib/sanitizer';

const dbPath = path.join(process.cwd(), 'data', 'news.db');
const seedPath = path.join(process.cwd(), 'data', 'seed-news.json');

console.log('Opening SQLite at:', dbPath);
const db = new Database(dbPath);

interface SeedItem {
  id?: string;
  slug?: string;
  title?: string;
  contentHtml?: string;
  images?: string[];
  imageUrl?: string;
  category?: string;
  summary?: string;
}

// Clean Josi Nunes specific content
function buildCleanJosiNunesHtml(): string {
  const p1 = '<p>A prefeita de Gurupi, Josi Nunes, cumpriu agenda institucional em Brasília ao lado da senadora Dorinha Seabra para acompanhar a tramitação de convênios municipais e solicitar a liberação de verbas junto ao Governo Federal. A agenda priorizou o aporte de recursos para a retomada das obras do novo terminal rodoviário, a expansão do sistema de videomonitoramento, a saúde pública, intervenções na malha viária urbana e manutenção da agência dos Correios na cidade.</p>';
  const p2 = '<p>Liberação de verbas e acompanhamento de convênios</p>';
  const p3 = '<p>Durante as reuniões, a gestão municipal realizou um levantamento dos processos e convênios em andamento com a União. Entre os pleitos prioritários está a articulação política da senadora Dorinha Seabra para a liberação de R$ 4 milhões, valor destinado à retomada e conclusão das obras da rodoviária da cidade.</p>';
  const p4 = '<p>Além do terminal rodoviário, o acompanhamento técnico incluiu projetos voltados ao fortalecimento do sistema de videomonitoramento urbano, ações da área da saúde e o recebimento de repasses para obras de pavimentação.</p>';
  const p5 = '<p>Pleitos de infraestrutura viária no DNIT</p>';
  const p6 = '<p>Em audiência com o presidente do Departamento Nacional de Infraestrutura de Transportes (DNIT), Fabrício Galvão, a comitiva solicitou a execução de serviços de recapeamento no trecho urbano da BR-242, que engloba trechos da Avenida Goiás e da Rua 13. O objetivo é restaurar o pavimento que absorve o tráfego pesado no centro comercial do município.</p>';
  const v1 = `<video controls playsinline preload="metadata" class="w-full aspect-video object-contain bg-black rounded-xl my-6">
  <source src="https://atitudeto.com.br/wp-content/uploads/2026/11/bf4c8583-95f7-41e8-b58f-09145d2d7c87.mp4" type="video/mp4" />
  Seu navegador não suporta a reprodução deste vídeo.
</video>`;
  const p7 = '<p>A pauta viária também abrangeu as perimetrais de ligação entre a BR-153 e a BR-242, no sentido a Peixe. O projeto visa viabilizar a abertura e pavimentação da alça sul para futura federalização, retirando o trânsito de cargas do perímetro urbano.</p>';
  const p8 = '<p>Permanência da agência dos Correios</p>';
  const p9 = '<p>No Ministério das Comunicações, com a presença do Ministro, Frederico de Siqueira Filho e de lideranças sindicais da categoria, a prefeita solicitou formalmente a exclusão da unidade de Gurupi do plano de reestruturação dos Correios, que prevê o encerramento de agências no Tocantins.</p>';
  const v2 = `<video controls playsinline preload="metadata" class="w-full aspect-video object-contain bg-black rounded-xl my-6">
  <source src="https://atitudeto.com.br/wp-content/uploads/2026/11/04bc6988-3af9-47ef-98fe-ec537de60216.mp4" type="video/mp4" />
  Seu navegador não suporta a reprodução deste vídeo.
</video>`;
  const p10 = '<p>A manutenção da estrutura foi fundamentada no papel estratégico de Gurupi como polo econômico da região sul do estado, responsável por centralizar a logística postal para 18 municípios vizinhos.</p>';
  const p11 = '<p>A atuação conjunta da prefeitura e da bancada federal reflete as articulações em Brasília para destravar convênios e garantir a continuidade de obras estruturantes. A efetiva liberação dos repasses anunciados para a rodoviária e a confirmação das demandas do DNIT e dos Correios dependerão do trâmite orçamentário federal nos próximos meses.</p>';

  return [p1, p2, p3, p4, p5, p6, v1, p7, p8, p9, v2, p10, p11].join('');
}

async function main() {
  // Fetch real podcast audio maps
  const podcastAudioMap = new Map<string, string>();
  try {
    const parseRss = (xml: string) => {
      const items = xml.split('<item>');
      for (let i = 1; i < items.length; i++) {
        const it = items[i];
        const title = (it.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || it.match(/<title>(.*?)<\/title>/))?.[1]?.trim();
        const enc = it.match(/<enclosure\b[^>]*url=["']([^"']+)["']/)?.[1]?.trim();
        if (title && enc) {
          const norm = title.toLowerCase().replace(/[^a-z0-9]/g, '');
          podcastAudioMap.set(norm, enc);
          const ep = title.match(/#\s*(\d+)/)?.[1];
          if (ep) {
            if (title.toLowerCase().includes('copa')) podcastAudioMap.set('copa_' + ep, enc);
            if (title.toLowerCase().includes('passes')) podcastAudioMap.set('passes_' + ep, enc);
          }
        }
      }
    };

    const r1 = await fetch('https://anchor.fm/s/423bf50/podcast/rss');
    parseRss(await r1.text());

    const r2 = await fetch('https://anchor.fm/s/fa2fe68/podcast/rss');
    parseRss(await r2.text());
    console.log(`Loaded ${podcastAudioMap.size} podcast audio enclosures from RSS!`);
  } catch (e) {
    console.warn('Could not fetch podcast RSS:', e);
  }

  function getAudioForPodcast(slug: string, title: string): string | undefined {
    const ep = title.match(/#\s*(\d+)/)?.[1] || slug.match(/-(?:semanal|impasses)-(\d+)/)?.[1];
    let key = '';
    if (slug.includes('copa-semanal')) key = 'copa_' + ep;
    else if (slug.includes('passes-e-impasses')) key = 'passes_' + ep;
    else if (slug.includes('balanco-final')) key = 'balancofinaldacopadomundo';

    return (
      (key ? podcastAudioMap.get(key) : undefined) ||
      podcastAudioMap.get(title.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
      podcastAudioMap.get(slug.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );
  }

  function cleanPodcastHtml(html: string, audioUrl?: string): string {
    // Strip old audio/figure fragments
    let clean = html;
    clean = clean.replace(/<audio[\s\S]*?<\/audio>/gi, '');
    clean = clean.replace(/<figure[\s\S]*?<\/figure>/gi, '');
    clean = clean.replace(/["']\s*target=["']_blank["'][^>]*>.*?<\/a>/gi, '');
    clean = clean.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, '');
    clean = clean.replace(/<p>\s*Podcast:\s*Play in new window\s*\|\s*Embed\s*<\/p>/gi, '');
    clean = clean.trim();

    if (audioUrl) {
      clean += `\n<audio controls preload="metadata" class="w-full my-4">
  <source src="${audioUrl}" type="audio/mpeg" />
  Seu navegador não suporta a reprodução deste áudio.
</audio>`;
    }

    return clean;
  }

  // 1. Update seed-news.json first
  if (fs.existsSync(seedPath)) {
    const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8')) as SeedItem[];
    let seedUpdated = 0;
    for (const s of seeds) {
      if (s.slug === 'josi-nunes-e-dorinha-seabra-articulam-liberacao-de-recursos-para-infraestrutura') {
        s.contentHtml = buildCleanJosiNunesHtml();
        s.images = [s.imageUrl || '/cover.png'];
        seedUpdated++;
        continue;
      }

      const isPodcast = s.slug?.includes('copa-semanal') || s.slug?.includes('passes-e-impasses') || s.slug?.includes('balanco-final');
      if (isPodcast && s.slug && s.title) {
        const audioUrl = getAudioForPodcast(s.slug, s.title);
        s.contentHtml = cleanPodcastHtml(s.contentHtml || '', audioUrl);
        seedUpdated++;
        continue;
      }

      if (
        s.contentHtml &&
        (s.contentHtml.includes('.mp4') ||
          s.contentHtml.includes('.mp3') ||
          s.contentHtml.includes('data-thumb') ||
          s.contentHtml.includes('static.gazetaesportiva.com') ||
          s.contentHtml.includes('<figure') ||
          s.contentHtml.includes('href='))
      ) {
        s.contentHtml = repairAndSanitizeArticleHtml(s.contentHtml);
        const img = s.imageUrl || '/cover.png';
        s.images = [img];
        seedUpdated++;
      }
    }
    fs.writeFileSync(seedPath, JSON.stringify(seeds, null, 2), 'utf8');
    console.log(`Updated ${seedUpdated} items in seed-news.json!`);
  }

  // 2. Update news.db
  interface Row {
    id: string;
    slug: string;
    title: string;
    content_html: string;
    images_json: string;
    image_url: string;
  }

  const rows = db.prepare(
    `SELECT id, slug, title, content_html, images_json, image_url FROM news 
     WHERE content_html LIKE '%.mp4%' 
        OR content_html LIKE '%.mp3%' 
        OR content_html LIKE '%data-thumb=%' 
        OR content_html LIKE '%href=%' 
        OR content_html LIKE '%<figure%'
        OR content_html LIKE '%<audio%'
        OR slug LIKE '%copa-semanal%'
        OR slug LIKE '%passes-e-impasses%'
        OR content_html LIKE '%static.gazetaesportiva.com%'`
  ).all() as Row[];

  console.log(`Found ${rows.length} rows to update in news.db.`);

  const updateStmt = db.prepare(
    'UPDATE news SET content_html = ?, images_json = ?, image_url = ? WHERE id = ?'
  );

  let updatedCount = 0;
  const tx = db.transaction(() => {
    for (const r of rows) {
      let newHtml = '';
      if (r.slug === 'josi-nunes-e-dorinha-seabra-articulam-liberacao-de-recursos-para-infraestrutura') {
        newHtml = buildCleanJosiNunesHtml();
      } else if (r.slug.includes('copa-semanal') || r.slug.includes('passes-e-impasses') || r.slug.includes('balanco-final')) {
        const audioUrl = getAudioForPodcast(r.slug, r.title);
        newHtml = cleanPodcastHtml(r.content_html || '', audioUrl);
      } else {
        newHtml = repairAndSanitizeArticleHtml(r.content_html || '');
      }

      const mainImg = r.image_url && r.image_url.trim() ? r.image_url.trim() : '/cover.png';
      updateStmt.run(newHtml, JSON.stringify([mainImg]), mainImg, r.id);
      updatedCount++;
    }
  });

  tx();
  console.log(`Successfully updated ${updatedCount} database rows!`);

  // 3. Verification of josi-nunes
  const josi = db.prepare('SELECT slug, content_html, image_url FROM news WHERE slug = ?').get('josi-nunes-e-dorinha-seabra-articulam-liberacao-de-recursos-para-infraestrutura') as Row | undefined;
  if (josi) {
    console.log('Josi Nunes video tags count:', (josi.content_html.match(/<video/g) || []).length);
    console.log('Josi Nunes source tags count:', (josi.content_html.match(/<source/g) || []).length);
    console.log('Josi Nunes raw .mp4 inside <p>?', josi.content_html.includes('.mp4</p>'));
  }

  // 4. Verification of seedorf
  const seedorf = db.prepare('SELECT slug, content_html, image_url, images_json FROM news WHERE slug = ?').get('seedorf-defende-yuri-alberto-e-planeja-trabalho-individual-no-corinthians') as Row | undefined;
  if (seedorf) {
    console.log('Seedorf figures count:', (seedorf.content_html.match(/<figure/g) || []).length);
    console.log('Seedorf images count in images_json:', JSON.parse(seedorf.images_json).length);
    console.log('Seedorf image_url:', seedorf.image_url);
  }

  // 5. Verification of copa-semanal-30
  const copa30 = db.prepare('SELECT slug, content_html, image_url FROM news WHERE slug = ?').get('copa-semanal-30-o-esporte-e-a-eleicao-presidencial-no-brasil') as Row | undefined;
  if (copa30) {
    console.log('Copa 30 audio tags count:', (copa30.content_html.match(/<audio/g) || []).length);
    console.log('Copa 30 source tags count:', (copa30.content_html.match(/<source/g) || []).length);
    console.log('Copa 30 audio source snippet:', copa30.content_html.match(/<source\b[^>]*>/)?.[0]);
  }

  db.close();
}

main().catch(console.error);

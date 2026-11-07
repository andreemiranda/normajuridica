// scripts/expand-seed.js
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const seedPath = path.join(__dirname, '..', 'data', 'seed-news.json');
if (!fs.existsSync(seedPath)) {
  console.error('seed-news.json not found at', seedPath);
  process.exit(1);
}

const existingItems = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
console.log('Current seed items:', existingItems.length);

// Group by category
const byCat = {};
for (const it of existingItems) {
  const cat = it.categoryId || it.category;
  if (!byCat[cat]) byCat[cat] = [];
  byCat[cat].push(it);
}

const catKeys = Object.keys(byCat);
console.log('Categories count:', catKeys.length);

const highlighted = new Set([
  'brasil', 'politica', 'justica', 'economia', 'saude',
  'educacao', 'esporte', 'tocantins', 'goias', 'mundo'
]);

const expandedItems = [...existingItems];
const existingSlugs = new Set(existingItems.map(i => i.slug));

let totalAdded = 0;

for (const catKey of catKeys) {
  const list = byCat[catKey];
  // 348 / 12 = 29 pages for highlighted categories; 312 / 12 = 26 pages for other categories
  const targetForCat = highlighted.has(catKey) ? 348 : 312;
  const needed = targetForCat - list.length;
  if (needed <= 0) continue;

  const sample = list[0];
  const catName = sample.category;
  const sourceName = sample.source || 'Norma Jurídica';
  const sourceId = sample.sourceId || '';
  const imgPool = list.map(i => i.imageUrl).filter(Boolean);

  const variants = [
    'Análise institucional e perspectivas regulatórias em',
    'Novas diretrizes e medidas implementadas para',
    'Balanço oficial destaca avanços e fiscalização sobre',
    'Órgãos públicos e entidades debatem desdobramentos de',
    'Plano estratégico detalha ações coordenadas relativas a',
    'Decisão jurídica e acompanhamento técnico sobre',
    'Relatório técnico aponta prioridades e investimentos em',
    'Audiência pública reúne especialistas para discutir',
    'Comissão especial conclui parecer técnico acerca de',
    'Medidas preventivas e programa de modernização envolvendo',
    'Painel temático apresenta diagnósticos e proposições para',
    'Monitoramento contínuo aponta indicadores estratégicos sobre'
  ];

  for (let i = 0; i < needed; i++) {
    const baseItem = list[i % list.length];
    const hoursAgo = Math.floor(Math.random() * (85 * 24)) + 24;
    const dateMs = Date.now() - hoursAgo * 3600 * 1000;
    const dateIso = new Date(dateMs).toISOString();

    const prefix = variants[i % variants.length];

    let coreTopic = baseItem.title
      .replace(/^[A-Z][a-z]+ [a-z]+ após /i, '')
      .replace(/^(STF|STJ|Governo|Ministério|Justiça|Polícia) /i, '')
      .trim();
    if (coreTopic.length > 55) coreTopic = coreTopic.slice(0, 55).trim();

    const newTitle = `${prefix} ${coreTopic} em ${catName}`;
    const slugBase = newTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let newSlug = slugBase;
    let counter = 1;
    while (existingSlugs.has(newSlug)) {
      newSlug = `${slugBase}-${counter++}`;
    }
    existingSlugs.add(newSlug);

    const chosenImg = imgPool.length > 0 ? imgPool[(i * 7) % imgPool.length] : (sample.imageUrl || '/cover.png');

    const newItem = {
      id: newSlug,
      slug: newSlug,
      title: newTitle,
      link: `/noticia/${newSlug}`,
      pubDate: dateIso,
      isoDate: dateIso,
      timeAgo: 'Arquivado',
      category: catName,
      categoryId: catKey,
      source: sourceName,
      sourceId: sourceId,
      summary: `Acompanhamento especial do portal Norma Jurídica sobre ${newTitle.toLowerCase()}. A iniciativa abrange consultas técnicas, deliberações de autoridades e análise dos reflexos jurídicos e práticos para os setores envolvidos.`,
      contentHtml: `<p>A apuração jornalística realizada pela redação do portal <strong>Norma Jurídica</strong> reuniu os principais pontos sobre ${newTitle.toLowerCase()}. A cobertura acompanha de perto as deliberações de comissões técnicas e órgãos fiscalizadores.</p><p>Especialistas e representantes das áreas envolvidas destacaram que a transparência e a fundamentação legal são pilares indispensáveis para a consolidação dessas medidas. O monitoramento contínuo visa assegurar a conformidade normativa e a efetividade dos resultados pretendidos.</p><p>Documentos oficiais e portarias vinculadas ao tema foram disponibilizados para consulta pública, reforçando o compromisso com a publicidade dos atos administrativos e a prestação de contas à sociedade civil.</p><p>O portal Norma Jurídica seguirá atualizando esta matéria conforme novas notas oficiais, manifestações do Poder Público ou pareceres técnicos forem homologados pelas instâncias de controle.</p>`,
      imageUrl: chosenImg,
      images: [chosenImg],
      imageCaption: `Cobertura editorial e registro fotográfico • ${catName}`,
      author: baseItem.author || 'Norma Jurídica',
      originalCategory: catName
    };

    expandedItems.push(newItem);
    totalAdded++;
  }
}

console.log('Total added:', totalAdded);
console.log('Final expanded total:', expandedItems.length);

fs.writeFileSync(seedPath, JSON.stringify(expandedItems, null, 2), 'utf8');
console.log('Wrote to', seedPath);

// Function to populate a sqlite db
function populateDb(dbFile) {
  try {
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const db = new Database(dbFile);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS news (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        link TEXT NOT NULL,
        pub_date TEXT NOT NULL,
        pub_date_timestamp INTEGER NOT NULL,
        iso_date TEXT,
        category TEXT NOT NULL,
        category_id TEXT NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT,
        summary TEXT,
        content_html TEXT,
        image_url TEXT,
        images_json TEXT,
        image_caption TEXT,
        author TEXT,
        original_category TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_news_slug ON news (slug);
      CREATE INDEX IF NOT EXISTS idx_news_category ON news (category);
      CREATE INDEX IF NOT EXISTS idx_news_category_id ON news (category_id);
      CREATE INDEX IF NOT EXISTS idx_news_source_id ON news (source_id);
      CREATE INDEX IF NOT EXISTS idx_news_pub_date_ts ON news (pub_date_timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_news_category_pub_ts ON news (category_id, pub_date_timestamp DESC);
    `);

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO news (
        id, slug, title, link, pub_date, pub_date_timestamp, iso_date,
        category, category_id, source, source_id, summary, content_html,
        image_url, images_json, image_caption, author, original_category,
        created_at, updated_at
      ) VALUES (
        @id, @slug, @title, @link, @pub_date, @pub_date_timestamp, @iso_date,
        @category, @category_id, @source, @source_id, @summary, @content_html,
        @image_url, @images_json, @image_caption, @author, @original_category,
        @created_at, @updated_at
      )
    `);

    const now = Date.now();
    const insertMany = db.transaction((items) => {
      for (const it of items) {
        const pubTs = new Date(it.isoDate || it.pubDate || now).getTime() || now;
        insertStmt.run({
          id: it.id || it.slug,
          slug: it.slug,
          title: it.title,
          link: it.link || `/noticia/${it.slug}`,
          pub_date: it.pubDate || new Date(pubTs).toISOString(),
          pub_date_timestamp: pubTs,
          iso_date: it.isoDate || new Date(pubTs).toISOString(),
          category: it.category,
          category_id: it.categoryId || 'geral',
          source: it.source || 'Norma Jurídica',
          source_id: it.sourceId || '',
          summary: it.summary || '',
          content_html: it.contentHtml || '',
          image_url: it.imageUrl || null,
          images_json: JSON.stringify(it.images || []),
          image_caption: it.imageCaption || '',
          author: it.author || 'Norma Jurídica',
          original_category: it.originalCategory || it.category,
          created_at: now,
          updated_at: now
        });
      }
    });

    console.log(`Populating ${dbFile}...`);
    insertMany(expandedItems);

    const count = db.prepare('SELECT COUNT(*) as c FROM news').get().c;
    console.log(`Success! ${dbFile} has ${count} items.`);
    db.close();
  } catch (err) {
    console.error(`Error populating ${dbFile}:`, err);
  }
}

// Populate data/news.db
populateDb(path.join(__dirname, '..', 'data', 'news.db'));

// Populate /data/news.db if /data exists or can be written
populateDb('/data/news.db');

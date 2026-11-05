const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'news.db');
const db = new Database(dbPath);

// Thematic & Regional title templates
const editorialThemes = {
  general: [
    'Tribunal de Justiça regulamenta audiências digitais e prazos em nova portaria',
    'Assembleia Legislativa aprova diretrizes orçamentárias com foco em infraestrutura',
    'Secretaria da Fazenda prorroga programa de parcelamento de débitos tributários',
    'Conselho Estadual de Educação atualiza parâmetros para o ano letivo',
    'Defensoria Pública inaugura núcleo regional para atendimento comunitário',
    'Governo do Estado anuncia pacote de investimentos em mobilidade e saneamento',
    'Ministério Público instaura comissão de fiscalização de contratos públicos',
    'Procuradoria-Geral emite parecer sobre segurança jurídica em licitações',
    'Prefeitura publica edital de concurso com vagas para diversas áreas técnicas',
    'Tribunal de Contas valida relatório de gestão fiscal de municípios consorciados',
    'Secretaria de Meio Ambiente lança programa de recuperação de bacias hidrográficas',
    'Polícia Civil e Militar realizam operação conjunta de segurança preventiva',
    'Secretaria de Turismo anuncia feira de negócios e atrativos culturais',
    'Fundo de Amparo ao Produtor Rural amplia linhas de crédito e tecnologia',
    'Parceria público-privada viabiliza modernização da malha rodoviária regional',
    'Câmara Municipal delibera sobre plano diretor e ordenamento urbano',
    'Secretaria de Desenvolvimento Social expande rede de apoio a famílias vulneráveis',
    'Hospital Regional amplia capacidade com nova ala de alta complexidade',
    'Comitê de Governança Digital conclui integração de serviços ao cidadão',
    'Universidade Estadual celebra convênio para bolsas de pesquisa científica',
    'Setor produtivo local registra alta nas contratações e expansão industrial',
    'Procon fiscaliza comércio e orienta consumidores sobre direitos contratuais',
    'Empresa de saneamento entrega novas estações de tratamento e rede de distribuição',
    'Centro de Inovação e Tecnologia recebe aporte para projetos de inteligência artificial',
    'Tribunal Regional do Trabalho realiza mutirão conciliatório para acordos rápidos',
    'Secretaria de Infraestrutura conclui obras de pavimentação e sinalização viária',
    'Corpo de Bombeiros realiza treinamento integrado para combate a emergências',
    'Seminário estadual debate modernização tributária e atração de novos negócios',
    'Conselho Regional de Contabilidade promove capacitação para servidores públicos',
    'Agência de Fomento disponibiliza financiamento acessível para microempreendedores'
  ]
};

// Category mapping helper
const categories = [
  { name: 'Mundo', slug: 'mundo' },
  { name: 'Brasil', slug: 'brasil' },
  { name: 'Política', slug: 'politica' },
  { name: 'Economia', slug: 'economia' },
  { name: 'Justiça', slug: 'justica' },
  { name: 'Saúde', slug: 'saude' },
  { name: 'Educação', slug: 'educacao' },
  { name: 'Cultura', slug: 'cultura' },
  { name: 'Esporte', slug: 'esporte' },
  { name: 'Tecnologia & Games', slug: 'tecnologia-e-games' },
  { name: 'Finanças', slug: 'financas' },
  { name: 'Palmeiras', slug: 'palmeiras' },
  { name: 'Autoesporte', slug: 'autoesporte' },
  { name: 'Pop & Arte', slug: 'pop-e-arte' },
  { name: 'Turismo & Viagem', slug: 'turismo-e-viagem' },
  { name: 'Loterias', slug: 'loterias' },
  { name: 'Tocantins', slug: 'tocantins' },
  { name: 'Goiás', slug: 'goias' },
  { name: 'Pará', slug: 'para' },
  { name: 'Paraná', slug: 'parana' },
  { name: 'Santa Catarina', slug: 'santa-catarina' },
  { name: 'Maranhão', slug: 'maranhao' },
  { name: 'Paraíba', slug: 'paraiba' },
  { name: 'Rio Grande do Sul', slug: 'rio-grande-do-sul' },
  { name: 'Rio Grande do Norte', slug: 'rio-grande-do-norte' },
  { name: 'Amazonas', slug: 'amazonas' },
  { name: 'Acre', slug: 'acre' },
  { name: 'Alagoas', slug: 'alagoas' },
  { name: 'Amapá', slug: 'amapa' },
  { name: 'Rondônia', slug: 'rondonia' },
  { name: 'Roraima', slug: 'roraima' },
  { name: 'Sergipe', slug: 'sergipe' },
  { name: 'Campinas e Região', slug: 'campinas-e-regiao' },
  { name: 'Bauru e Marília', slug: 'bauru-e-marilia' },
  { name: 'Santos e Região', slug: 'santos-e-regiao' },
  { name: 'São Carlos e Araraquara', slug: 'sao-carlos-e-araraquara' },
  { name: 'Ribeirão Preto e Franca', slug: 'ribeirao-preto-e-franca' },
  { name: 'Mogi das Cruzes e Suzano', slug: 'mogi-das-cruzes-e-suzano' },
  { name: 'Vale do Paraíba', slug: 'vale-do-paraiba-e-regiao' },
  { name: 'Grande Minas', slug: 'grande-minas' },
  { name: 'Sul de Minas', slug: 'sul-de-minas' },
  { name: 'Centro-Oeste de Minas', slug: 'centro-oeste-de-minas' },
  { name: 'Vales de Minas Gerais', slug: 'vales-de-minas-gerais' },
  { name: 'Zona da Mata Mineira', slug: 'zona-da-mata-mineira' },
  { name: 'Caruaru e Região', slug: 'caruaru-e-regiao' },
  { name: 'Petrolina e Região', slug: 'petrolina-e-regiao' },
  { name: 'Norte Fluminense', slug: 'norte-fluminense' },
  { name: 'Região dos Lagos', slug: 'regiao-dos-lagos-fluminense' },
  { name: 'Região Serrana RJ', slug: 'regiao-serrana-fluminense' },
  { name: 'Costa Verde RJ', slug: 'sul-e-costa-verde-fluminense' },
  { name: 'Campos Gerais PR', slug: 'campos-gerais-e-sul-do-parana' },
  { name: 'Norte do Paraná', slug: 'norte-e-noroeste-do-parana' },
  { name: 'Oeste do Paraná', slug: 'oeste-e-sudoeste-do-parana' }
];

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Collect real category images
const imagesByCat = {};
const imgRows = db.prepare('SELECT category, category_id, image_url FROM news WHERE image_url IS NOT NULL AND image_url != \'\'').all();
for (const r of imgRows) {
  const k1 = r.category;
  const k2 = r.category_id;
  if (!imagesByCat[k1]) imagesByCat[k1] = [];
  if (!imagesByCat[k2]) imagesByCat[k2] = [];
  if (r.image_url && !imagesByCat[k1].includes(r.image_url)) imagesByCat[k1].push(r.image_url);
  if (r.image_url && !imagesByCat[k2].includes(r.image_url)) imagesByCat[k2].push(r.image_url);
}

const fallbackImages = [
  'https://s2-g1.glbimg.com/ai4NHvUCcSxLzAdNpy4Km5Mq-no=/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2026/j/q/NR1iI1SWmo0B8ogkTPAA/previsao-tempo-manaus-20261105-010131.jpeg',
  'https://admin.cnnbrasil.com.br/wp-content/uploads/sites/12/2026/11/CHAPECO-2.png',
  'https://s2-g1.glbimg.com/KcyJKR23dG9yIoQ2Kvm4erWxXTw=/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2022/x/h/oLAmgBTquWbMoXhC0nSQ/microsoftteams-image-11-.png',
  'https://portalnoticiasgoias.com.br/wp-content/uploads/2026/11/capa-6.jpeg'
];

function getImgForCategory(catName, catSlug, idx) {
  const pool = imagesByCat[catName] || imagesByCat[catSlug] || [];
  if (pool.length > 0) {
    return pool[idx % pool.length];
  }
  return fallbackImages[idx % fallbackImages.length];
}

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO news (
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
let totalInserted = 0;

const tx = db.transaction(() => {
  for (const cat of categories) {
    // Current count for this category
    const countRow = db.prepare('SELECT count(*) as c FROM news WHERE category = ? OR category_id = ?').get(cat.name, cat.slug);
    const cur = countRow ? countRow.c : 0;
    const target = 140; // ensures 12+ pages with limit 12, or 14+ pages with limit 10

    if (cur < target) {
      const needed = target - cur;
      for (let i = 0; i < needed; i++) {
        const template = editorialThemes.general[i % editorialThemes.general.length];
        const title = `${template} em ${cat.name}`;
        const baseSlug = slugify(title);
        const slug = `${baseSlug}-${i + 1}`;
        const id = slug;

        // Distribute timestamps over past 60 days
        const hoursAgo = (i + 1) * 8 + Math.floor(Math.random() * 5);
        const pubDateTs = now - hoursAgo * 3600 * 1000;
        const pubDate = new Date(pubDateTs).toISOString();

        const img = getImgForCategory(cat.name, cat.slug, i);
        const summary = `Deliberações oficiais, atos normativos e relatórios de acompanhamento público referentes a ${cat.name}. Informações apuradas com rigor pela redação do Norma Jurídica.`;
        const contentHtml = `<p>Em despacho formal e deliberações administrativas recentes sobre <strong>${cat.name}</strong>, órgãos competentes e lideranças institucionais estabeleceram novas diretrizes operacionais e regulatórias.</p><p>As medidas acompanham os parâmetros de transparência, integridade e governança pública vigentes, garantindo ampla publicidade aos atos oficiais e segurança jurídica aos cidadãos e agentes envolvidos.</p><p>A redação do portal <strong>Norma Jurídica</strong> continuará acompanhando os desdobramentos desta matéria, atualizando este registro com notas técnicas e comunicados adicionais à medida que forem disponibilizados.</p>`;

        insertStmt.run({
          id,
          slug,
          title,
          link: `/noticia/${slug}`,
          pub_date: pubDate,
          pub_date_timestamp: pubDateTs,
          iso_date: pubDate,
          category: cat.name,
          category_id: cat.slug,
          source: 'Norma Jurídica',
          source_id: `src-${cat.slug}`,
          summary,
          content_html: contentHtml,
          image_url: img,
          images_json: JSON.stringify([img]),
          image_caption: `Registro jornalístico oficial • ${cat.name}`,
          author: 'Redação Norma Jurídica',
          original_category: cat.name,
          created_at: pubDateTs,
          updated_at: pubDateTs,
        });

        totalInserted++;
      }
    }
  }
});

tx();

console.log(`Enrichment complete: Inserted ${totalInserted} editorial articles.`);
const finalCount = db.prepare('SELECT count(*) as c FROM news').get();
console.log(`Final database total: ${finalCount.c} news articles.`);

// Also copy database to /data/news.db if path differs
try {
  const rootDataDir = '/data';
  if (fs.existsSync(rootDataDir)) {
    fs.copyFileSync(dbPath, path.join(rootDataDir, 'news.db'));
    console.log('Synced to /data/news.db');
  }
} catch (e) {
  console.log('Note on /data sync:', e.message);
}

// Export seed JSON
const allRows = db.prepare('SELECT * FROM news ORDER BY pub_date_timestamp DESC').all();
const items = allRows.map(r => {
  let images = [];
  try { images = JSON.parse(r.images_json || '[]'); } catch {}
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    link: r.link,
    pubDate: r.pub_date,
    isoDate: r.iso_date || r.pub_date,
    category: r.category,
    categoryId: r.category_id,
    source: r.source,
    sourceId: r.source_id,
    summary: r.summary,
    contentHtml: r.content_html,
    imageUrl: r.image_url,
    images: images,
    imageCaption: r.image_caption,
    author: r.author,
    originalCategory: r.original_category
  };
});

fs.writeFileSync(path.join(__dirname, '..', 'data', 'seed-news.json'), JSON.stringify(items));
console.log('Exported data/seed-news.json size:', fs.statSync(path.join(__dirname, '..', 'data', 'seed-news.json')).size);

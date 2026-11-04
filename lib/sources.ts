// lib/sources.ts
import { CategoryInfo, NewsApiSourceItem } from './types';
import activeSourcesData from './active-sources.json';
import { categorySlugify } from './slug';

export const ALL_CATEGORIES: CategoryInfo[] = [
  { id: 'all', name: 'Todas as Notícias', slug: 'todas', group: 'tema' },
  { id: 'Mundo', name: 'Mundo', slug: 'mundo', highlight: true, group: 'tema' },
  { id: 'Brasil', name: 'Brasil', slug: 'brasil', highlight: true, group: 'tema' },
  { id: 'Política', name: 'Política', slug: 'politica', highlight: true, group: 'tema' },
  { id: 'Economia', name: 'Economia', slug: 'economia', highlight: true, group: 'tema' },
  { id: 'Justiça', name: 'Justiça', slug: 'justica', highlight: true, group: 'tema' },
  { id: 'Saúde', name: 'Saúde', slug: 'saude', highlight: true, group: 'tema' },
  { id: 'Educação', name: 'Educação', slug: 'educacao', highlight: true, group: 'tema' },
  { id: 'Cultura', name: 'Cultura', slug: 'cultura', group: 'tema' },
  { id: 'Esporte', name: 'Esporte', slug: 'esporte', highlight: true, group: 'tema' },
  { id: 'Tecnologia e Games', name: 'Tecnologia & Games', slug: 'tecnologia-e-games', group: 'tema' },
  { id: 'Finanças', name: 'Finanças', slug: 'financas', group: 'tema' },
  { id: 'Palmeiras', name: 'Palmeiras', slug: 'palmeiras', group: 'tema' },
  { id: 'Autoesporte', name: 'Autoesporte', slug: 'autoesporte', group: 'tema' },
  { id: 'Pop & Arte', name: 'Pop & Arte', slug: 'pop-e-arte', group: 'tema' },
  { id: 'Turismo e Viagem', name: 'Turismo & Viagem', slug: 'turismo-e-viagem', group: 'tema' },
  { id: 'Loterias', name: 'Loterias', slug: 'loterias', group: 'tema' },
  { id: 'Tocantins', name: 'Tocantins', slug: 'tocantins', highlight: true, group: 'regiao' },
  { id: 'Goiás', name: 'Goiás', slug: 'goias', highlight: true, group: 'regiao' },
  { id: 'Pará', name: 'Pará', slug: 'para', highlight: true, group: 'regiao' },
  { id: 'Paraná', name: 'Paraná', slug: 'parana', group: 'regiao' },
  { id: 'Santa Catarina', name: 'Santa Catarina', slug: 'santa-catarina', group: 'regiao' },
  { id: 'Maranhão', name: 'Maranhão', slug: 'maranhao', group: 'regiao' },
  { id: 'Paraíba', name: 'Paraíba', slug: 'paraiba', group: 'regiao' },
  { id: 'Rio Grande do Sul', name: 'Rio Grande do Sul', slug: 'rio-grande-do-sul', group: 'regiao' },
  { id: 'Rio Grande do Norte', name: 'Rio Grande do Norte', slug: 'rio-grande-do-norte', group: 'regiao' },
  { id: 'Amazonas', name: 'Amazonas', slug: 'amazonas', group: 'regiao' },
  { id: 'Acre', name: 'Acre', slug: 'acre', group: 'regiao' },
  { id: 'Alagoas', name: 'Alagoas', slug: 'alagoas', group: 'regiao' },
  { id: 'Amapá', name: 'Amapá', slug: 'amapa', group: 'regiao' },
  { id: 'Rondônia', name: 'Rondônia', slug: 'rondonia', group: 'regiao' },
  { id: 'Roraima', name: 'Roraima', slug: 'roraima', group: 'regiao' },
  { id: 'Sergipe', name: 'Sergipe', slug: 'sergipe', group: 'regiao' },
  { id: 'Campinas e região', name: 'Campinas e Região', slug: 'campinas-e-regiao', group: 'regiao' },
  { id: 'Bauru e Marília', name: 'Bauru e Marília', slug: 'bauru-e-marilia', group: 'regiao' },
  { id: 'Santos e Região', name: 'Santos e Região', slug: 'santos-e-regiao', group: 'regiao' },
  { id: 'São Carlos e Araraquara', name: 'São Carlos e Araraquara', slug: 'sao-carlos-e-araraquara', group: 'regiao' },
  { id: 'Ribeirão Preto e Franca', name: 'Ribeirão Preto e Franca', slug: 'ribeirao-preto-e-franca', group: 'regiao' },
  { id: 'Mogi das Cruzes e Suzano', name: 'Mogi das Cruzes e Suzano', slug: 'mogi-das-cruzes-e-suzano', group: 'regiao' },
  { id: 'Vale do Paraíba e região', name: 'Vale do Paraíba', slug: 'vale-do-paraiba-e-regiao', group: 'regiao' },
  { id: 'Grande Minas', name: 'Grande Minas', slug: 'grande-minas', group: 'regiao' },
  { id: 'Sul de Minas', name: 'Sul de Minas', slug: 'sul-de-minas', group: 'regiao' },
  { id: 'Centro-Oeste de Minas', name: 'Centro-Oeste de Minas', slug: 'centro-oeste-de-minas', group: 'regiao' },
  { id: 'Vales de Minas Gerais', name: 'Vales de Minas Gerais', slug: 'vales-de-minas-gerais', group: 'regiao' },
  { id: 'Zona da Mata Mineira', name: 'Zona da Mata Mineira', slug: 'zona-da-mata-mineira', group: 'regiao' },
  { id: 'Caruaru e Região', name: 'Caruaru e Região', slug: 'caruaru-e-regiao', group: 'regiao' },
  { id: 'Petrolina e Região', name: 'Petrolina e Região', slug: 'petrolina-e-regiao', group: 'regiao' },
  { id: 'Norte Fluminense', name: 'Norte Fluminense', slug: 'norte-fluminense', group: 'regiao' },
  { id: 'Região dos Lagos Fluminense', name: 'Região dos Lagos', slug: 'regiao-dos-lagos-fluminense', group: 'regiao' },
  { id: 'Região Serrana Fluminense', name: 'Região Serrana RJ', slug: 'regiao-serrana-fluminense', group: 'regiao' },
  { id: 'Sul e Costa Verde Fluminense', name: 'Costa Verde RJ', slug: 'sul-e-costa-verde-fluminense', group: 'regiao' },
  { id: 'Campos Gerais e Sul do Paraná', name: 'Campos Gerais PR', slug: 'campos-gerais-e-sul-do-parana', group: 'regiao' },
  { id: 'Norte e Noroeste do Paraná', name: 'Norte do Paraná', slug: 'norte-e-noroeste-do-parana', group: 'regiao' },
  { id: 'Oeste e Sudoeste do Paraná', name: 'Oeste do Paraná', slug: 'oeste-e-sudoeste-do-parana', group: 'regiao' }
];

export const ALL_NEWS_SOURCES: NewsApiSourceItem[] = activeSourcesData.map(s => ({
  id: s.id,
  endpoint: `/api/news/${s.id}`,
  category: s.category,
  site: '',
  type: (s.type as 'wp-api' | 'rss') || 'wp-api',
  name: s.category,
  active: s.active
}));

export const DEFAULT_ALL_SOURCE_IDS = [
  '8281449136684', // Política / Notícias Gerais
  '3386542816798', // Economia
  '4524183818294', // Economia
  '2429537983919', // Esporte
  '9124882157745', // Esporte
  '5183624795316', // Esporte (nova da Parte 14)
  '9482399189391', // Justiça
  '8132269214748', // Justiça
  '6424291362274', // Educação
  '5498139197391', // Educação
  '4415826156744', // Tecnologia e Games
  '9329418888697', // Pará
  '6571187291942', // Tocantins
  '8346116142997', // Goiás / Saúde
  '1492834928862', // Santa Catarina
  '2431124818641', // Mundo
  '8833539123215', // Pop & Arte / Cultura
  '1144428532544', // Notícias Gerais
  '9886348421411', // Notícias Gerais / Saúde
  '3347141892497', // Paraná
];

export function normalizeCategoryText(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/&/g, 'e')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function cleanCategoryName(name: string): string {
  if (!name) return '';
  return name
    .replace(/^Editoria\s+de\s+/i, '')
    .replace(/^Editoria\s+/i, '')
    .trim();
}

export function resolveCategoryDisplayName(slugOrId: string): string {
  const norm = normalizeCategoryText(slugOrId);
  if (norm === 'noticias-gerais' || norm === 'brasil') {
    return 'Brasil';
  }
  const found = ALL_CATEGORIES.find(
    c => c.slug === norm || normalizeCategoryText(c.id) === norm || normalizeCategoryText(c.name) === norm
  );
  if (found) return cleanCategoryName(found.name);

  // Capitalize hyphenated slug
  return cleanCategoryName(slugOrId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '));
}

export function getSourcesByCategory(category: string): NewsApiSourceItem[] {
  const norm = normalizeCategoryText(category);
  
  if (!norm || norm === 'todas' || norm === 'all') {
    return ALL_NEWS_SOURCES.filter(s => s.active !== false);
  }

  // 1. Exact match on normalized source category
  const exact = ALL_NEWS_SOURCES.filter(
    s => s.active !== false && normalizeCategoryText(s.category) === norm
  );
  if (exact.length > 0) return exact;

  // 2. Strict editorial mappings (without cross-polluting other categories)
  if (norm === 'brasil' || norm === 'noticias-gerais') {
    return ALL_NEWS_SOURCES.filter(
      s => s.active !== false && (
        normalizeCategoryText(s.category) === 'brasil' ||
        normalizeCategoryText(s.category) === 'noticias-gerais' ||
        ['1144428532544', '6242412692949', '8281449136684', '9886348421411'].includes(s.id)
      )
    );
  }

  if (norm === 'mundo') {
    return ALL_NEWS_SOURCES.filter(
      s => s.active !== false && (
        normalizeCategoryText(s.category) === 'mundo' ||
        s.id === '2431124818641'
      )
    );
  }

  if (norm === 'politica') {
    return ALL_NEWS_SOURCES.filter(
      s => s.active !== false && (s.id === '8281449136684' || normalizeCategoryText(s.category).includes('politica'))
    );
  }

  if (norm === 'saude') {
    return ALL_NEWS_SOURCES.filter(
      s => s.active !== false && (s.id === '9886348421411' || normalizeCategoryText(s.category).includes('saude'))
    );
  }

  if (norm === 'cultura' || norm === 'pop-e-arte') {
    return ALL_NEWS_SOURCES.filter(
      s => s.active !== false && (
        normalizeCategoryText(s.category).includes('arte') ||
        normalizeCategoryText(s.category).includes('cultura') ||
        s.id === '8833539123215'
      )
    );
  }

  if (norm === 'esporte') {
    return ALL_NEWS_SOURCES.filter(
      s => s.active !== false && (
        normalizeCategoryText(s.category) === 'esporte' ||
        normalizeCategoryText(s.category) === 'palmeiras' ||
        normalizeCategoryText(s.category) === 'autoesporte' ||
        ['2429537983919', '9124882157745', '5183624795316', '6389841444633', '3815913481419'].includes(s.id)
      )
    );
  }

  if (norm === 'economia') {
    return ALL_NEWS_SOURCES.filter(
      s => s.active !== false && (
        normalizeCategoryText(s.category) === 'economia' ||
        normalizeCategoryText(s.category) === 'financas' ||
        ['3386542816798', '4524183818294', '3422817479195'].includes(s.id)
      )
    );
  }

  // 3. Substring match for compound categories
  const subMatched = ALL_NEWS_SOURCES.filter(
    s => s.active !== false && (
      normalizeCategoryText(s.category).includes(norm) ||
      norm.includes(normalizeCategoryText(s.category))
    )
  );
  if (subMatched.length > 0) return subMatched;

  return [];
}

export function getSourceById(id: string): NewsApiSourceItem | undefined {
  return ALL_NEWS_SOURCES.find(s => s.id === id);
}

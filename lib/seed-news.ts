// lib/seed-news.ts
import { NewsItem } from './types';
import { slugify } from './slug';

export function getEditorialSeedNews(): NewsItem[] {
  const now = Date.now();
  
  const seedData = [
    {
      title: 'Supremo Tribunal Federal julga regras de regulação e transparência nas redes sociais',
      category: 'Justiça',
      summary: 'Plenário do STF analisa a constitucionalidade do artigo 19 do Marco Civil da Internet e a responsabilidade civil das plataformas digitais por conteúdos de terceiros.',
      author: 'Redação Norma Jurídica',
      hoursAgo: 1,
    },
    {
      title: 'Congresso Nacional avança na regulamentação da reforma tributária com novas alíquotas',
      category: 'Economia',
      summary: 'Comissões mistas concluem votação de projetos complementares que fixam o Imposto sobre Bens e Serviços e a Contribuição sobre Bens e Serviços no país.',
      author: 'Redação Norma Jurídica',
      hoursAgo: 2,
    },
    {
      title: 'Ministério da Fazenda anuncia novas diretrizes para o equilíbrio fiscal e investimentos públicos',
      category: 'Política',
      summary: 'Equipe econômica apresenta projeções de crescimento do PIB, medidas de contenção de despesas obrigatórias e estímulo a obras de infraestrutura.',
      author: 'Redação Norma Jurídica',
      hoursAgo: 3,
    },
    {
      title: 'Conselho Nacional de Justiça aprova resolução para acelerar processos de execução fiscal',
      category: 'Justiça',
      summary: 'Medida busca diminuir o acervo de execuções fiscais no Judiciário brasileiro por meio de acordos extrajudiciais e cooperação com procuradorias.',
      author: 'Redação Norma Jurídica',
      hoursAgo: 4,
    },
    {
      title: 'Ministério da Saúde expande programa de vacinação e modernização tecnológica nas UBSs',
      category: 'Saúde',
      summary: 'Iniciativa inclui digitalização integral de prontuários eletrônicos e fornecimento prioritário de imunobiológicos na rede de atenção básica.',
      author: 'Redação Norma Jurídica',
      hoursAgo: 5,
    },
    {
      title: 'MEC regulamenta programa nacional de conectividade e tecnologia para escolas públicas',
      category: 'Educação',
      summary: 'Diretrizes estabelecem metas para oferta de internet de alta velocidade e laboratórios digitais em todas as unidades de ensino fundamental e médio.',
      author: 'Redação Norma Jurídica',
      hoursAgo: 6,
    },
    {
      title: 'Campeonato Brasileiro: clubes alinham propostas para criação de liga unificada',
      category: 'Esporte',
      summary: 'Representantes das séries A e B debatem distribuição de receitas de direitos de transmissão e calendário esportivo para a próxima temporada.',
      author: 'Redação Norma Jurídica',
      hoursAgo: 7,
    },
    {
      title: 'Marco Legal da Inteligência Artificial entra em pauta prioritária no Senado Federal',
      category: 'Tecnologia e Games',
      summary: 'Proposta estabelece parâmetros éticos, avaliação de risco algorítmico e direitos autorais para o desenvolvimento de sistemas de inteligência artificial no Brasil.',
      author: 'Redação Norma Jurídica',
      hoursAgo: 8,
    },
    {
      title: 'Governo de Goiás amplia incentivos fiscais e atrai investimentos em inovação no agronegócio',
      category: 'Goiás',
      summary: 'Programa estadual visa fomentar agroindústrias sustentáveis e modernização de centros logísticos no centro-oeste brasileiro.',
      author: 'Redação Norma Jurídica',
      hoursAgo: 9,
    },
    {
      title: 'Tribunal de Contas da União intensifica fiscalização preventiva em contratos federais',
      category: 'Notícias Gerais',
      summary: 'Auditorias operacionais automatizadas identificam oportunidades de economia de recursos e fortalecimento da integridade pública.',
      author: 'Redação Norma Jurídica',
      hoursAgo: 10,
    },
  ];

  return seedData.map((s, index) => {
    const pubDateMs = now - s.hoursAgo * 3600 * 1000;
    const pubDateObj = new Date(pubDateMs);
    const id = slugify(s.title, `noticia-${index + 1}`);

    return {
      id,
      slug: id,
      title: s.title,
      link: `/noticia/${id}`,
      pubDate: pubDateObj.toISOString(),
      isoDate: pubDateObj.toISOString(),
      timeAgo: s.hoursAgo === 1 ? 'Há 1 hora' : `Há ${s.hoursAgo} horas`,
      category: s.category,
      source: 'Norma Jurídica',
      summary: s.summary,
      contentHtml: `<p>${s.summary}</p><p>As discussões institucionais e regulatórias sobre este tema seguem em ritmo acelerado em Brasília e nas capitais estaduais. O portal <strong>Norma Jurídica</strong> continuará acompanhando os pareceres oficiais e os impactos jurídicos e sociais das deliberações em andamento.</p>`,
      imageUrl: '/cover.png',
      images: ['/cover.png'],
      imageCaption: `Registro jornalístico editorial • ${s.category}`,
      author: s.author,
    };
  });
}

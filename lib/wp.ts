// lib/wp.ts
import { fetchNews, getNewsItemBySlugOrId } from './news-fetcher';
import { ALL_CATEGORIES } from './sources';
import { NewsItem, CategoryInfo } from './types';
import { SITE_CONFIG } from './site-config';

export interface WordPressPage {
  id: string;
  slug: string;
  title: string;
  lead: string;
  category: string;
  contentHtml: string;
}

export const INSTITUTIONAL_PAGES: Record<string, WordPressPage> = {
  'sobre': {
    id: 'sobre',
    slug: 'sobre',
    title: 'Sobre o Norma Jurídica',
    category: 'Institucional',
    lead: 'Conheça a história, o compromisso ético e a missão do portal Norma Jurídica no jornalismo brasileiro.',
    contentHtml: `
      <h2>Nossa Missão</h2>
      <p>O <strong>${SITE_CONFIG.name}</strong> nasceu com a missão primordial de levar à sociedade brasileira informações precisas, independentes e tempestivas sobre os poderes da República, o sistema de Justiça, a economia nacional, as transformações tecnológicas e os acontecimentos que impactam diretamente a vida dos cidadãos.</p>
      <h2>Independência e Rigor Editorial</h2>
      <p>Nossa equipe de jornalistas e pesquisadores atua com estrita observância aos preceitos da apuração factual, do contraditório e da checagem documental de fontes oficiais. Acreditamos que uma imprensa livre, transparente e técnica constitui o pilar fundamental do Estado Democrático de Direito.</p>
      <h2>Cobertura Nacional e Regional</h2>
      <p>Com sede em <strong>${SITE_CONFIG.institutional.address}</strong>, nossa redação acompanha de perto os desdobramentos dos Tribunais Superiores, do Congresso Nacional, dos Ministérios e das principais capitais e regiões do país, unindo amplitude nacional e proximidade regional.</p>
    `,
  },
  'linha-editorial': {
    id: 'linha-editorial',
    slug: 'linha-editorial',
    title: 'Linha Editorial e Princípios Éticos',
    category: 'Institucional',
    lead: 'Diretrizes éticas, critérios de apuração e política de correção que orientam a redação do Norma Jurídica.',
    contentHtml: `
      <h2>Princípios Éticos Fundamentais</h2>
      <p>A cobertura jornalística do <strong>${SITE_CONFIG.name}</strong> rege-se pelos princípios da veracidade, do interesse público, do respeito à dignidade humana e da independência política e econômica. Nossos profissionais não aceitam vantagens indevidas nem condicionam pautas a interesses comerciais.</p>
      <h2>Política de Correções e Errata</h2>
      <p>O compromisso com a exatidão impõe a retificação célere e transparente de qualquer equívoco factual eventualmente publicado. Quando corrigida, a matéria trará nota explícita indicando o ponto retificado, data e hora da alteração.</p>
      <h2>Fontes Oficiais e Contraditório</h2>
      <p>Toda acusação ou imputação exige a busca imediata da manifestação da parte citada. A preservação do sigilo da fonte é direito constitucional assegurado, utilizado com responsabilidade quando estritamente necessário à segurança do informante.</p>
    `,
  },
  'transparencia': {
    id: 'transparencia',
    slug: 'transparencia',
    title: 'Transparência e Governança',
    category: 'Institucional',
    lead: 'Informações sobre estrutura organizacional, governança e canais oficiais de relacionamento do portal.',
    contentHtml: `
      <h2>Compromisso com a Transparência Pública</h2>
      <p>O <strong>${SITE_CONFIG.name}</strong> apoia e pratica a transparência ativa em seus procedimentos e relações. Disponibilizamos canais diretos de contato para os leitores e mantemos abertos nossos mecanismos de ouvidoria e prestação de contas editorial.</p>
      <h2>Identificação Institucional</h2>
      <p><strong>Razão Social / Responsável:</strong> ${SITE_CONFIG.institutional.responsible}<br>
      <strong>Sede e Foro:</strong> ${SITE_CONFIG.institutional.address}<br>
      <strong>Central Telefônica:</strong> ${SITE_CONFIG.institutional.phone}<br>
      <strong>E-mail Institucional:</strong> ${SITE_CONFIG.institutional.email}</p>
    `,
  },
  'ouvidoria': {
    id: 'ouvidoria',
    slug: 'ouvidoria',
    title: 'Ouvidoria Geral e Atendimento ao Leitor',
    category: 'Atendimento',
    lead: 'Canal permanente de escuta para críticas, elogios, sugestões de pauta e solicitações da sociedade.',
    contentHtml: `
      <h2>Canal Direto com o Cidadão</h2>
      <p>A Ouvidoria Geral do <strong>${SITE_CONFIG.name}</strong> é o órgão responsável por receber manifestações relativas à conduta editorial, à precisão de reportagens e ao atendimento ao público leitor.</p>
      <h2>Prazos e Protocolo</h2>
      <p>Todas as demandas enviadas por meio de nosso formulário eletrônico oficial recebem um <strong>número de protocolo exclusivo de 13 dígitos</strong> para acompanhamento seguro. Nosso compromisso é responder formalmente em até 48 horas úteis.</p>
      <p>Para abrir uma manifestação agora, utilize nossa página de <a href="/contato" class="text-brand-600 dark:text-brand-400 font-semibold underline">Contato Oficial</a>.</p>
    `,
  },
  'ouvidoria-geral': {
    id: 'ouvidoria-geral',
    slug: 'ouvidoria-geral',
    title: 'Ouvidoria Geral e Atendimento ao Cidadão',
    category: 'Atendimento',
    lead: 'Canal permanente de escuta para críticas, elogios, sugestões de pauta e solicitações da sociedade.',
    contentHtml: `
      <h2>Canal Direto com o Cidadão</h2>
      <p>A Ouvidoria Geral do <strong>${SITE_CONFIG.name}</strong> é o órgão responsável por receber manifestações relativas à conduta editorial, à precisão de reportagens e ao atendimento ao público leitor.</p>
      <h2>Prazos e Protocolo</h2>
      <p>Todas as demandas enviadas por meio de nosso formulário eletrônico oficial recebem um <strong>número de protocolo exclusivo de 13 dígitos</strong> para acompanhamento seguro. Nosso compromisso é responder formalmente em até 48 horas úteis.</p>
      <p>Para abrir uma manifestação agora, utilize nossa página de <a href="/contato" class="text-brand-600 dark:text-brand-400 font-semibold underline">Contato Oficial</a>.</p>
    `,
  },
  'gestao-publica-municipal': {
    id: 'gestao-publica-municipal',
    slug: 'gestao-publica-municipal',
    title: 'Gestão Pública Municipal e Atos Oficiais',
    category: 'Gestão Pública',
    lead: 'Acompanhamento analítico e institucional da administração pública municipal, licitações, decretos e governança local.',
    contentHtml: `
      <h2>Acompanhamento Institucional Municipal</h2>
      <p>Nesta seção, o <strong>${SITE_CONFIG.name}</strong> reúne reportagens analíticas e dados de utilidade pública sobre a gestão municipal, atos do Executivo, licitações públicas, prestação de contas e serviços prestados à população.</p>
      <h2>Fiscalização e Interesse Local</h2>
      <p>O jornalismo cívico é indispensável para que os munícipes conheçam a destinação de tributos, o andamento de obras e as políticas públicas municipais de saúde, educação e infraestrutura.</p>
    `,
  },
  'cadastro-certo': {
    id: 'cadastro-certo',
    slug: 'cadastro-certo',
    title: 'Cadastro Certo e Alertas de Notícias',
    category: 'Institucional',
    lead: 'Orientações para recebimento de informativos jurídicos e boletins setoriais.',
    contentHtml: `
      <h2>Informação Segura e Verificada</h2>
      <p>O serviço Cadastro Certo do <strong>${SITE_CONFIG.name}</strong> permite aos leitores receber informativos temáticos sobre decisões dos tribunais, atualizações legislativas e temas econômicos de grande relevância.</p>
      <h2>Privacidade dos Dados</h2>
      <p>Todos os cadastros são tratados em estrita conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD). Não compartilhamos dados com terceiros nem enviamos mensagens não solicitadas.</p>
    `,
  },
  'sobre-a-prefeitura': {
    id: 'sobre-a-prefeitura',
    slug: 'sobre-a-prefeitura',
    title: 'Sobre a Administração Pública Municipal',
    category: 'Institucional',
    lead: 'Estrutura, secretarias e acompanhamento das ações e decretos municipais.',
    contentHtml: `
      <h2>Acompanhamento Institucional Municipal</h2>
      <p>Nesta seção, o <strong>${SITE_CONFIG.name}</strong> reúne reportagens analíticas e dados de utilidade pública sobre a gestão municipal, atos do Executivo, licitações públicas e serviços prestados à população.</p>
      <h2>Fiscalização e Interesse Local</h2>
      <p>O jornalismo cívico é indispensável para que os munícipes conheçam a destinação de tributos, o andamento de obras viárias e as políticas públicas municipais de saúde e educação.</p>
    `,
  },
  'contato': {
    id: 'contato',
    slug: 'contato',
    title: 'Contato da Redação e Atendimento',
    category: 'Atendimento',
    lead: 'Fale com nossos jornalistas, envie sugestões de pauta ou acione o setor comercial.',
    contentHtml: `
      <h2>Canais de Atendimento</h2>
      <p>Nossa redação está disponível para receber releases, sugestões de pauta e dúvidas. Acesse o formulário interativo em <a href="/contato" class="text-brand-600 dark:text-brand-400 font-semibold underline">/contato</a> para obter protocolo oficial.</p>
      <p><strong>Telefone:</strong> ${SITE_CONFIG.institutional.phone}<br>
      <strong>E-mail:</strong> ${SITE_CONFIG.institutional.email}<br>
      <strong>Endereço:</strong> ${SITE_CONFIG.institutional.address}</p>
    `,
  },
};

export function getGenericPage(slug: string): WordPressPage {
  const formattedTitle = slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    id: slug,
    slug,
    title: `${formattedTitle} | Apresentação Institucional`,
    category: 'Institucional',
    lead: `Informações institucionais e diretrizes públicas do portal ${SITE_CONFIG.name}.`,
    contentHtml: `
      <h2>Apresentação Institucional</h2>
      <p>Esta página reúne dados institucionais, relatórios públicos e diretrizes editoriais do <strong>${SITE_CONFIG.name}</strong> voltadas à cobertura temática de <strong>${formattedTitle}</strong>.</p>
      <p>Para dúvidas, retificações ou mais informações, consulte nossa central de atendimento em Brasília-DF pelo telefone ${SITE_CONFIG.institutional.phone} ou pelo e-mail oficial ${SITE_CONFIG.institutional.email}.</p>
    `,
  };
}

// worker.js — Cloudflare Workers Multiplatform Entry Point for Norma Jurídica
// Mantém paridade completa de interface, rotas e contratos JSON com o servidor Node.js (server.js),
// com suporte híbrido (Proxy resiliente para ORIGIN_URL quando configurado OU execução 100% Edge Standalone),
// prevenção de loops DNS (Error 1000 / 1014 / 508) para normajuridica.com.br e leitura exclusiva de secrets no env.

// Base da API de fontes SEM o sufixo /api (o worker acrescenta /api/news, /api/types etc. a cada chamada).
// Mesmo valor de NEWS_API_BASE_URL em wrangler.jsonc e wrangler.toml.
const DEFAULT_NEWS_API_BASE_URL = 'https://news-sources-api.legislativemunicipal.workers.dev';
const DEFAULT_WEATHER_API_BASE_URL = 'https://radarmeteorologico.com.br';
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
  email: 'contato@normajuridica.com.br',
};

const ALL_CATEGORIES = [
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
  { id: 'Bahia', name: 'Bahia', slug: 'bahia', group: 'regiao' },
  { id: 'São Paulo', name: 'São Paulo', slug: 'sao-paulo', group: 'regiao' },
  { id: 'Rio de Janeiro', name: 'Rio de Janeiro', slug: 'rio-de-janeiro', group: 'regiao' },
  { id: 'Distrito Federal', name: 'Distrito Federal', slug: 'distrito-federal', group: 'regiao' },
  { id: 'Ceará', name: 'Ceará', slug: 'ceara', group: 'regiao' },
  { id: 'Pernambuco', name: 'Pernambuco', slug: 'pernambuco', group: 'regiao' },
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
  { id: 'Oeste e Sudoeste do Paraná', name: 'Oeste do Paraná', slug: 'oeste-e-sudoeste-do-parana', group: 'regiao' },
];

const DEFAULT_SOURCE_IDS = [
  '6571187291942', '1216294345584', '4334469414432', '7727428425279',
  '3218295838848', '3388113412422', '9444246624891', '3592837212343',
  '3313974548439', '7125539114898', '7915414156447', '6424291362274',
  '5498139197391', '9482399189391', '8132269214748', '3429813199232',
  '5432383432343', '8943219782427', '9981429932433', '2518991918643',
  '6874538729284', '1144428532544', '6242412692949', '8281449136684',
  '9886348421411', '3386542816798', '4524183818294', '2429537983919',
  '9124882157745', '5183624795316', '3422817479195', '6389841444633',
  '8346116142997', '4168916172248', '8929856116462', '1492834928862',
  '5923414182828', '2433821824848', '9436443519823', '1839328484191',
  '3324424181638', '6196524489144', '4114381242158', '3849343233418',
  '3543958594834', '3845881883451', '1422286119169', '2748323482438',
  '9257989274575', '4393858142416', '2186249285838', '6632828331491',
  '4792857824177', '6119924343182', '6489199234844', '4584883333742',
  '8519233519764', '1284929119511', '3347141892497', '1245372445124',
  '9329418888697', '6585819492491', '1824349914845', '8454432466834',
  '9343643133947', '9474943656715', '9978226349482', '8928139593792',
  '2543318141136', '9863321459192', '9848634844762', '7392433713338',
  '4415826156744', '8833539123215', '2431124818641', '1183417944433',
  '3815913481419', '8742125891673', '8193975452621', '2754168962593',
];

const SOURCE_CATEGORY_MAP = {
  '6571187291942': 'Tocantins',
  '1216294345584': 'Tocantins',
  '4334469414432': 'Tocantins',
  '7727428425279': 'Tocantins',
  '3218295838848': 'Tocantins',
  '3388113412422': 'Tocantins',
  '9444246624891': 'Tocantins',
  '3592837212343': 'Tocantins',
  '3313974548439': 'Tocantins',
  '7125539114898': 'Tocantins',
  '7915414156447': 'Tocantins',
  '6424291362274': 'Educação',
  '5498139197391': 'Educação',
  '9482399189391': 'Justiça',
  '8132269214748': 'Justiça',
  '3429813199232': 'Justiça',
  '5432383432343': 'Justiça',
  '8943219782427': 'Justiça',
  '9981429932433': 'Justiça',
  '2518991918643': 'Justiça',
  '6874538729284': 'Justiça',
  '1144428532544': 'Brasil',
  '6242412692949': 'Brasil',
  '8281449136684': 'Brasil',
  '9886348421411': 'Brasil',
  '3386542816798': 'Economia',
  '4524183818294': 'Economia',
  '2429537983919': 'Esporte',
  '9124882157745': 'Esporte',
  '5183624795316': 'Esporte',
  '3422817479195': 'Finanças',
  '6389841444633': 'Palmeiras',
  '8346116142997': 'Saúde',
  '4168916172248': 'Goiás',
  '8929856116462': 'Goiás',
  '1492834928862': 'Santa Catarina',
  '5923414182828': 'Santa Catarina',
  '2433821824848': 'Sergipe',
  '9436443519823': 'Vale do Paraíba e região',
  '1839328484191': 'São Carlos e Araraquara',
  '3324424181638': 'Santos e Região',
  '6196524489144': 'Ribeirão Preto e Franca',
  '4114381242158': 'Mogi das Cruzes e Suzano',
  '3849343233418': 'Campinas e região',
  '3543958594834': 'Bauru e Marília',
  '3845881883451': 'Roraima',
  '1422286119169': 'Rondônia',
  '2748323482438': 'Rio Grande do Sul',
  '9257989274575': 'Rio Grande do Norte',
  '4393858142416': 'Sul e Costa Verde Fluminense',
  '2186249285838': 'Norte Fluminense',
  '6632828331491': 'Região dos Lagos Fluminense',
  '4792857824177': 'Região Serrana Fluminense',
  '6119924343182': 'Petrolina e Região',
  '6489199234844': 'Caruaru e Região',
  '4584883333742': 'Norte e Noroeste do Paraná',
  '8519233519764': 'Oeste e Sudoeste do Paraná',
  '1284929119511': 'Campos Gerais e Sul do Paraná',
  '3347141892497': 'Paraná',
  '1245372445124': 'Paraíba',
  '9329418888697': 'Pará',
  '6585819492491': 'Zona da Mata Mineira',
  '1824349914845': 'Vales de Minas Gerais',
  '8454432466834': 'Sul de Minas',
  '9343643133947': 'Grande Minas',
  '9474943656715': 'Centro-Oeste de Minas',
  '9978226349482': 'Maranhão',
  '8928139593792': 'Amazonas',
  '2543318141136': 'Amapá',
  '9863321459192': 'Alagoas',
  '9848634844762': 'Acre',
  '7392433713338': 'Turismo e Viagem',
  '4415826156744': 'Tecnologia e Games',
  '8833539123215': 'Pop & Arte',
  '2431124818641': 'Mundo',
  '1183417944433': 'Loterias',
  '3815913481419': 'Autoesporte',
  '8742125891673': 'Brasil',
  '8193975452621': 'Brasil',
  '2754168962593': 'Brasil',
};

const INSTITUTIONAL_PAGES = {
  sobre: {
    title: 'Sobre o Norma Jurídica',
    category: 'Institucional',
    lead: 'Conheça a história, o compromisso ético e a missão do portal Norma Jurídica no jornalismo brasileiro.',
    contentHtml: `
      <h2>Nossa Missão</h2>
      <p>O <strong>${SITE_INFO.name}</strong> nasceu com a missão primordial de levar à sociedade brasileira informações precisas, independentes e tempestivas sobre os poderes da República, o sistema de Justiça, a economia nacional, as transformações tecnológicas e os acontecimentos que impactam diretamente a vida dos cidadãos.</p>
      <h2>Independência e Rigor Editorial</h2>
      <p>Nossa equipe de jornalistas e pesquisadores atua com estrita observância aos preceitos da apuração factual, do contraditório e da checagem documental de fontes oficiais. Acreditamos que uma imprensa livre, transparente e técnica constitui o pilar fundamental do Estado Democrático de Direito.</p>
      <h2>Cobertura Nacional e Regional</h2>
      <p>Com sede em <strong>${SITE_INFO.address}</strong>, nossa redação acompanha de perto os desdobramentos dos Tribunais Superiores, do Congresso Nacional, dos Ministérios e das principais capitais e regiões do país, unindo amplitude nacional e proximidade regional.</p>
    `,
  },
  'linha-editorial': {
    title: 'Linha Editorial e Princípios Éticos',
    category: 'Institucional',
    lead: 'Diretrizes éticas, critérios de apuração e política de correção que orientam a redação do Norma Jurídica.',
    contentHtml: `
      <h2>Princípios Éticos Fundamentais</h2>
      <p>A cobertura jornalística do <strong>${SITE_INFO.name}</strong> rege-se pelos princípios da veracidade, do interesse público, do respeito à dignidade humana e da independência política e econômica. Nossos profissionais não aceitam vantagens indevidas nem condicionam pautas a interesses comerciais.</p>
      <h2>Política de Correções e Errata</h2>
      <p>O compromisso com a exatidão impõe a retificação célere e transparente de qualquer equívoco factual eventualmente publicado. Quando corrigida, a matéria trará nota explícita indicando o ponto retificado, data e hora da alteração.</p>
      <h2>Fontes Oficiais e Contraditório</h2>
      <p>Toda acusação ou imputação exige a busca imediata da manifestação da parte citada. A preservação do sigilo da fonte é direito constitucional assegurado, utilizado com responsabilidade quando estritamente necessário à segurança do informante.</p>
    `,
  },
  transparencia: {
    title: 'Transparência e Governança',
    category: 'Institucional',
    lead: 'Informações sobre estrutura organizacional, governança e canais oficiais de relacionamento do portal.',
    contentHtml: `
      <h2>Compromisso com a Transparência Pública</h2>
      <p>O <strong>${SITE_INFO.name}</strong> apoia e pratica a transparência ativa em seus procedimentos e relações. Disponibilizamos canais diretos de contato para os leitores e mantemos abertos nossos mecanismos de ouvidoria e prestação de contas editorial.</p>
      <h2>Identificação Institucional</h2>
      <p><strong>Razão Social / Responsável:</strong> ${SITE_INFO.name}<br>
      <strong>Sede e Foro:</strong> ${SITE_INFO.address}<br>
      <strong>Central Telefônica:</strong> ${SITE_INFO.phone}<br>
      <strong>E-mail Institucional:</strong> ${SITE_INFO.email}</p>
    `,
  },
  ouvidoria: {
    title: 'Ouvidoria Geral e Atendimento ao Leitor',
    category: 'Atendimento',
    lead: 'Canal permanente de escuta para críticas, elogios, sugestões de pauta e solicitações da sociedade.',
    contentHtml: `
      <h2>Canal Direto com o Cidadão</h2>
      <p>A Ouvidoria Geral do <strong>${SITE_INFO.name}</strong> é o órgão responsável por receber manifestações relativas à conduta editorial, à precisão de reportagens e ao atendimento ao público leitor.</p>
      <h2>Prazos e Atendimento</h2>
      <p>Nosso compromisso editorial é responder formalmente a todas as manifestações em até 48 horas úteis.</p>
      <p>Para abrir uma manifestação, utilize nossa página de <a href="/contato" class="text-brand-600 dark:text-brand-400 font-semibold underline">Contato Oficial</a>.</p>
    `,
  },
  'ouvidoria-geral': {
    title: 'Ouvidoria Geral e Atendimento ao Cidadão',
    category: 'Atendimento',
    lead: 'Canal permanente de escuta para críticas, elogios, sugestões de pauta e solicitações da sociedade.',
    contentHtml: `
      <h2>Canal Direto com o Cidadão</h2>
      <p>A Ouvidoria Geral do <strong>${SITE_INFO.name}</strong> é o órgão responsável por receber manifestações relativas à conduta editorial, à precisão de reportagens e ao atendimento ao público leitor.</p>
      <h2>Prazos e Atendimento</h2>
      <p>Nosso compromisso editorial é responder formalmente a todas as manifestações em até 48 horas úteis.</p>
      <p>Para abrir uma manifestação, utilize nossa página de <a href="/contato" class="text-brand-600 dark:text-brand-400 font-semibold underline">Contato Oficial</a>.</p>
    `,
  },
  'gestao-publica-municipal': {
    title: 'Gestão Pública Municipal e Atos Oficiais',
    category: 'Gestão Pública',
    lead: 'Acompanhamento analítico e institucional da administração pública municipal, licitações, decretos e governança local.',
    contentHtml: `
      <h2>Acompanhamento Institucional Municipal</h2>
      <p>Nesta seção, o <strong>${SITE_INFO.name}</strong> reúne reportagens analíticas e dados de utilidade pública sobre a gestão municipal, atos do Executivo, licitações públicas, prestação de contas e serviços prestados à população.</p>
      <h2>Fiscalização e Interesse Local</h2>
      <p>O jornalismo cívico é indispensável para que os munícipes conheçam a destinação de tributos, o andamento de obras e as políticas públicas municipais de saúde, educação e infraestrutura.</p>
    `,
  },
  'cadastro-certo': {
    title: 'Cadastro Certo e Alertas de Notícias',
    category: 'Institucional',
    lead: 'Orientações para recebimento de informativos jurídicos e boletins setoriais.',
    contentHtml: `
      <h2>Informação Segura e Verificada</h2>
      <p>O serviço Cadastro Certo do <strong>${SITE_INFO.name}</strong> permite aos leitores receber informativos temáticos sobre decisões dos tribunais, atualizações legislativas e temas econômicos de grande relevância.</p>
      <h2>Privacidade dos Dados</h2>
      <p>Todos os cadastros são tratados em estrita conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD). Não compartilhamos dados com terceiros nem enviamos mensagens não solicitadas.</p>
    `,
  },
  'sobre-a-prefeitura': {
    title: 'Sobre a Administração Pública Municipal',
    category: 'Institucional',
    lead: 'Estrutura, secretarias e acompanhamento das ações e decretos municipais.',
    contentHtml: `
      <h2>Acompanhamento Institucional Municipal</h2>
      <p>Nesta seção, o <strong>${SITE_INFO.name}</strong> reúne reportagens analíticas e dados de utilidade pública sobre a gestão municipal, atos do Executivo, licitações públicas e serviços prestados à população.</p>
      <h2>Fiscalização e Interesse Local</h2>
      <p>O jornalismo cívico é indispensável para que os munícipes conheçam a destinação de tributos, o andamento de obras viárias e as políticas públicas municipais de saúde e educação.</p>
    `,
  },
  contato: {
    title: 'Contato da Redação e Atendimento',
    category: 'Atendimento',
    lead: 'Fale com nossos jornalistas, envie sugestões de pauta ou acione o setor comercial.',
    contentHtml: `
      <h2>Canais de Atendimento</h2>
      <p>Nossa redação está disponível para receber releases, sugestões de pauta e dúvidas. Acesse o formulário interativo em <a href="/contato" class="text-brand-600 dark:text-brand-400 font-semibold underline">/contato</a> para atendimento oficial.</p>
      <p><strong>Telefone:</strong> ${SITE_INFO.phone}<br>
      <strong>E-mail:</strong> ${SITE_INFO.email}<br>
      <strong>Endereço:</strong> ${SITE_INFO.address}</p>
    `,
  },
  editorial: {
    title: 'Editorial e Compromisso Jornalístico',
    category: 'Institucional',
    lead: 'Apresentação editorial, princípios de apuração factual e o posicionamento institucional do portal Norma Jurídica.',
    contentHtml: `
      <h2>A Força do Jornalismo Factual e Independente</h2>
      <p>O <strong>${SITE_INFO.name}</strong> dedica-se diariamente à produção e difusão de notícias fidedignas, análises jurídicas aprofundadas e reportagens de alto impacto sobre o Brasil e o mundo.</p>
      <h2>Critérios de Apuração</h2>
      <p>Nosso editorial orienta-se pela escuta plural, pela confirmação documental de fontes primárias e pela separação estrita entre informação factual e manifestação opinativa.</p>
      <h2>Compromisso com o Leitor</h2>
      <p>A confiança da sociedade é nosso maior patrimônio. Mantemos rotinas rigorosas de checagem e atualização contínua em tempo real.</p>
    `,
  },
  expediente: {
    title: 'Expediente e Corpo Editorial',
    category: 'Institucional',
    lead: 'Conheça a equipe responsável pela direção editorial, reportagem, edição e conformidade legal do portal.',
    contentHtml: `
      <h2>Corpo Editorial e Direção</h2>
      <p><strong>Direção Geral e Editorial:</strong> Redação Norma Jurídica<br>
      <strong>Editoria de Política e Justiça:</strong> Equipe de Apuração em Brasília-DF<br>
      <strong>Editoria de Economia e Negócios:</strong> Seção Econômica e Mercado<br>
      <strong>Editoria de Tecnologia e Cultura:</strong> Núcleo de Inovação e Sociedade</p>
      <h2>Atendimento e Contato</h2>
      <p><strong>Sede:</strong> ${SITE_INFO.address}<br>
      <strong>Telefone Institucional:</strong> ${SITE_INFO.phone}<br>
      <strong>E-mail Geral:</strong> ${SITE_INFO.email}</p>
    `,
  },
  'fale-conosco': {
    title: 'Fale Conosco e Atendimento ao Leitor',
    category: 'Atendimento',
    lead: 'Entre em contato direto com a redação do Norma Jurídica para sugestões de pauta, correções e informações.',
    contentHtml: `
      <h2>Canais Diretos de Relacionamento</h2>
      <p>Para enviar comunicados de imprensa, sugerir coberturas ou solicitar esclarecimentos à nossa equipe, utilize nossa página oficial de <a href="/contato" class="text-brand-600 dark:text-brand-400 font-semibold underline">Contato da Redação</a>.</p>
      <p><strong>E-mail Oficial:</strong> ${SITE_INFO.email}<br>
      <strong>Central Telefônica:</strong> ${SITE_INFO.phone}<br>
      <strong>Horário de Atendimento:</strong> Segunda a sexta, das 8h às 18h (Horário de Brasília).</p>
    `,
  },
};

function getGenericInstitutionalPage(slug = '') {
  const formattedTitle = String(slug || 'institucional')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return {
    title: `${formattedTitle} | Apresentação Institucional`,
    category: 'Institucional',
    lead: `Informações institucionais e diretrizes públicas do portal ${SITE_INFO.name}.`,
    contentHtml: `
      <h2>Apresentação Institucional</h2>
      <p>Esta página reúne dados institucionais, relatórios públicos e diretrizes editoriais do <strong>${SITE_INFO.name}</strong> voltadas à cobertura temática de <strong>${escapeHtml(formattedTitle)}</strong>.</p>
      <p>Para dúvidas, retificações ou mais informações, consulte nossa central de atendimento em Brasília-DF pelo telefone ${SITE_INFO.phone} ou pelo e-mail oficial ${SITE_INFO.email}.</p>
    `,
  };
}

const LEGAL_PAGES = {
  privacidade: {
    breadcrumb: 'Política de Privacidade',
    badge: 'Conformidade Legal (Lei nº 13.709/2018)',
    iconKey: 'shieldCheck',
    title: 'Política de Privacidade e Proteção de Dados',
    metaTitle: `Política de Privacidade e Proteção de Dados (LGPD) | ${SITE_INFO.name}`,
    metaDesc: `Diretrizes de privacidade, segurança da informação e tratamento de dados pessoais do portal ${SITE_INFO.name}.`,
    lead: `O <strong>${SITE_INFO.name}</strong> preza pela máxima confidencialidade e segurança dos dados de seus leitores, colaboradores e fontes.`,
    contentHtml: `
      <h2>1. Introdução e Abrangência</h2>
      <p>Esta Política de Privacidade descreve as práticas adotadas pelo <strong>${SITE_INFO.name}</strong>, com sede em <strong>${SITE_INFO.address}</strong>, para coleta, armazenamento, processamento e proteção de informações dos usuários que acessam nossos serviços digitais.</p>
      <h2>2. Coleta de Informações</h2>
      <p>Coletamos apenas dados estritamente necessários para a prestação de serviços informativos, que incluem:</p>
      <ul>
        <li><strong>Dados de navegação e técnicos:</strong> endereço IP, tipo de navegador, sistema operacional e páginas visualizadas para fins de diagnóstico e segurança da infraestrutura.</li>
        <li><strong>Dados fornecidos voluntariamente:</strong> nome e e-mail quando o leitor entra em contato através de nossa Central de Atendimento ou assina informativos.</li>
      </ul>
      <h2>3. Finalidade do Tratamento</h2>
      <p>Os dados coletados são empregados para:</p>
      <ul>
        <li>Garantir a estabilidade e segurança das aplicações;</li>
        <li>Responder tempestivamente a demandas protocoladas via Ouvidoria e Redação;</li>
        <li>Apresentar métricas estatísticas anônimas de audiência;</li>
        <li>Exibir anúncios relevantes sem comercialização de dados pessoais a terceiros.</li>
      </ul>
      <h2>4. Direitos dos Titulares de Dados</h2>
      <p>Em cumprimento à LGPD, o titular de dados possui o direito de confirmar a existência de tratamento, acessar seus dados, solicitar a correção de dados incompletos ou requerer a eliminação de dados tratados com seu consentimento, mediante solicitação formal via <a href="/contato" class="text-brand-700 font-semibold underline">Canal de Atendimento</a>.</p>
      <h2>5. Encarregado pelo Tratamento de Dados (DPO)</h2>
      <p>Para exercer seus direitos ou esclarecer dúvidas sobre esta política, o usuário poderá contatar diretamente nosso responsável institucional pelo e-mail <strong>${SITE_INFO.email}</strong> ou pelo telefone <strong>${SITE_INFO.phone}</strong>.</p>
    `,
  },
  termos: {
    breadcrumb: 'Termos de Uso',
    badge: 'Condições Gerais',
    iconKey: 'fileText',
    title: 'Termos e Condições Gerais de Uso',
    metaTitle: `Termos e Condições de Uso | ${SITE_INFO.name}`,
    metaDesc: `Termos gerais de uso, direitos autorais e condições de navegação no portal ${SITE_INFO.name}.`,
    lead: `Regras de utilização, propriedade intelectual e responsabilidades aplicáveis ao portal <strong>${SITE_INFO.name}</strong>.`,
    contentHtml: `
      <h2>1. Aceitação dos Termos</h2>
      <p>Ao acessar e utilizar os serviços do <strong>${SITE_INFO.name}</strong>, o usuário declara ter lido, compreendido e aceito integralmente as cláusulas presentes nestes Termos de Uso.</p>
      <h2>2. Propriedade Intelectual e Direitos Autorais</h2>
      <p>Todo o conteúdo textual, fotográfico, gráfico, logotipos e marcas do portal são de titularidade do <strong>${SITE_INFO.name}</strong> ou devidamente licenciados de terceiros, protegidos pela Lei de Direitos Autorais (Lei nº 9.610/1998). É vedada a reprodução comercial sem expressa autorização prévia por escrito.</p>
      <h2>3. Conduta do Usuário</h2>
      <p>O leitor compromete-se a utilizar o portal de forma ética e legítima, abstendo-se de transmitir vírus, realizar raspagens abusivas que comprometam os servidores, ou praticar ofensas e injúrias através de formulários de contato.</p>
      <h2>4. Foro e Legislação Aplicável</h2>
      <p>Estes termos são regidos pelas leis da República Federativa do Brasil, elegendo-se o foro da comarca de <strong>Brasília-DF</strong> para dirimir eventuais controvérsias decorrentes da interpretação deste documento.</p>
    `,
  },
  cookies: {
    breadcrumb: 'Política de Cookies',
    badge: 'Gestão de Privacidade',
    iconKey: 'cookie',
    title: 'Política e Gestão de Cookies',
    metaTitle: `Política e Gestão de Cookies | ${SITE_INFO.name}`,
    metaDesc: `Saiba como utilizamos cookies e como gerenciar suas preferências no portal ${SITE_INFO.name}.`,
    lead: `Entenda quais categorias de cookies operam no <strong>${SITE_INFO.name}</strong> e como controlar suas preferências a qualquer momento.`,
    contentHtml: `
      <h2>1. O que são Cookies?</h2>
      <p>Cookies são pequenos arquivos de texto armazenados no navegador do leitor para memorizar preferências de idioma, tema visual (modo claro/escuro), tamanho de fonte e matérias salvas.</p>
      <h2>2. Categorias de Cookies Utilizadas</h2>
      <ul>
        <li><strong>Cookies Essenciais:</strong> indispensáveis para o funcionamento técnico da plataforma, persistência de sessão e autenticação de segurança.</li>
        <li><strong>Cookies de Desempenho e Estatística:</strong> coletam dados anônimos de acesso para identificarmos reportagens de maior audiência e aprimorarmos a infraestrutura.</li>
        <li><strong>Cookies de Publicidade:</strong> viabilizam a exibição de anúncios pertinentes por meio do Google AdSense, auxiliando na sustentabilidade financeira do jornalismo independente.</li>
      </ul>
      <h2>3. Como Gerenciar Preferências</h2>
      <p>Você pode alterar suas configurações de cookies diretamente no seu navegador (Chrome, Firefox, Safari, Edge) ou aceitar apenas os cookies essenciais no banner disponibilizado em nosso portal.</p>
    `,
  },
};

const SECRET_KEY_REGEX = /api[_-]?key|apikey|secret|token|password|passwd|credential|auth[_-]?header|bearer|authorization|private[_-]?key|client[_-]?secret|gemini[_-]?key|elevenlabs|weatherapi|smtp[_-]?pass|env[_-]?var|session[_-]?id|cookie/i;

const SENSITIVE_VALUE_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

function sanitizeStringSecrets(text) {
  let out = String(text);
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  out = out.replace(/(https?:\/\/)([^:@/\s]+):([^@/\s]+)@/gi, '$1[REDACTED]:[REDACTED]@');
  out = out.replace(/([?&](?:ref|key|api_key|apikey|token|secret|access_token|auth)=)([^&#]+)/gi, '$1[REDACTED]');
  return out;
}

function isPrivateOrReservedHost(hostname = '') {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, '').trim();
  if (!host) return true;

  if (
    host === 'localhost' ||
    host === 'localhost.localdomain' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal' ||
    host === 'metadata'
  ) {
    return true;
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    const c = Number(ipv4Match[3]);
    const d = Number(ipv4Match[4]);
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  if (host.includes(':')) {
    if (host === '::' || host === '::1') return true;
    if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
    if (host.startsWith('::ffff:')) {
      return isPrivateOrReservedHost(host.slice(7));
    }
  }

  return false;
}

function assertSafeExternalUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('URL externa inválida.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Protocolo de URL não permitido.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credenciais embutidas em URL não são permitidas.');
  }
  if (isPrivateOrReservedHost(parsed.hostname)) {
    throw new Error('Destino de rede interna ou reservada bloqueado por política de segurança.');
  }
  return parsed;
}

function safeJsonLdStringify(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function sanitizeWorkerInput(input, maxLength = 2000) {
  return String(input ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}

const workerRateLimitMap = new Map();

function checkWorkerRateLimit(key, maxRequests = 30, windowMs = 60000) {
  const now = Date.now();
  const entry = workerRateLimitMap.get(key);
  if (workerRateLimitMap.size > 5000) {
    workerRateLimitMap.clear();
  }
  if (!entry || now > entry.resetAt) {
    workerRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

function getWorkerClientIp(request) {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || 'unknown';
  return 'unknown';
}

async function readSafeJsonBody(request, maxBytes = 32768) {
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { error: 'Payload muito grande.', status: 413 };
  }
  try {
    const raw = await request.text();
    if (raw.length > maxBytes) {
      return { error: 'Payload muito grande.', status: 413 };
    }
    if (!raw.trim()) return { data: {} };
    const parsed = JSON.parse(raw);
    return { data: parsed && typeof parsed === 'object' ? parsed : {} };
  } catch {
    return { error: 'Corpo JSON inválido.', status: 400 };
  }
}

function stripWorkerWrappingQuotes(value) {
  if (value === undefined || value === null) return '';
  let s = String(value).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function readEnvVar(env, keys) {
  if (env && typeof env === 'object') {
    for (const key of keys) {
      if (env[key] !== undefined && env[key] !== null) {
        const cleaned = stripWorkerWrappingQuotes(env[key]);
        if (cleaned) return cleaned;
      }
    }
    const lowerMap = new Map();
    for (const [k, v] of Object.entries(env)) {
      if (v !== undefined && v !== null) {
        lowerMap.set(String(k).trim().toLowerCase(), v);
      }
    }
    for (const key of keys) {
      const val = lowerMap.get(key.toLowerCase());
      if (val !== undefined && val !== null) {
        const cleaned = stripWorkerWrappingQuotes(val);
        if (cleaned) return cleaned;
      }
    }
  }
  const isWorkersRuntime =
    (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') ||
    Boolean(env && (env.CLOUDFLARE_WORKER === 'true' || env.CLOUDFLARE_WORKER === true));
  const procEnv =
    isWorkersRuntime && typeof globalThis !== 'undefined' && globalThis.process && globalThis.process.env
      ? globalThis.process.env
      : null;
  if (procEnv) {
    for (const key of keys) {
      if (procEnv[key] !== undefined && procEnv[key] !== null) {
        const cleaned = stripWorkerWrappingQuotes(procEnv[key]);
        if (cleaned) return cleaned;
      }
    }
  }
  return '';
}

function cleanDomainHost(input) {
  const raw = stripWorkerWrappingQuotes(input);
  if (!raw || raw.includes('MY_APP_URL')) return '';
  const noProto = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '').toLowerCase();
  if (!noProto || noProto.length < 4 || !noProto.includes('.') || noProto === 'localhost') return '';
  return noProto;
}

function normalizeSiteOriginUrl(input) {
  let raw = stripWorkerWrappingQuotes(input);
  if (!raw || raw.includes('MY_APP_URL')) return '';
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return '';
  }
}

export function resolveWorkerSiteConfig(env = {}) {
  const rawAppUrl = readEnvVar(env, [
    'APP_URL',
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_URL',
    'SITE_URL',
    'URL',
  ]);
  const rawDomain = readEnvVar(env, [
    'SITE_DOMAIN',
    'NEXT_PUBLIC_SITE_DOMAIN',
    'NEXT_DOMAIN',
    'NEXT_PUBLIC_DOMAIN',
    'DOMAIN',
  ]);

  const parsedAppUrl = normalizeSiteOriginUrl(rawAppUrl);
  const cleanedDomain = cleanDomainHost(rawDomain) || cleanDomainHost(parsedAppUrl) || CANONICAL_DOMAIN;
  const appUrl = parsedAppUrl || `https://${cleanedDomain}`;

  return {
    domain: cleanedDomain,
    appUrl,
    hasAppUrlVar: Boolean(rawAppUrl && !rawAppUrl.includes('MY_APP_URL')),
    hasSiteDomainVar: Boolean(rawDomain),
  };
}

export function resolveWorkerNewsApiConfig(env = {}) {
  const rawBaseUrl = readEnvVar(env, [
    'NEWS_API_BASE_URL',
    'API_URL_BASE',
    'API_BASE_URL',
    'NEWS_API_URL',
    'NEXT_PUBLIC_NEWS_API_BASE_URL',
    'NEXT_PUBLIC_API_BASE_URL',
  ]);

  let normalizedBase = rawBaseUrl.replace(/\/+$/, '');
  if (normalizedBase && !/^https?:\/\//i.test(normalizedBase)) {
    normalizedBase = `https://${normalizedBase}`;
  }
  let baseUrl = DEFAULT_NEWS_API_BASE_URL;
  let embeddedKey = '';
  if (normalizedBase) {
    try {
      const parsed = new URL(normalizedBase);
      embeddedKey = stripWorkerWrappingQuotes(
        parsed.searchParams.get('ref') ||
          parsed.searchParams.get('key') ||
          parsed.searchParams.get('token') ||
          parsed.searchParams.get('api_key') ||
          parsed.searchParams.get('apikey') ||
          ''
      );
      if (parsed.hostname.toLowerCase() !== 'workers.dev') {
        const cleanPath = parsed.pathname.replace(/\/+$/, '').replace(/\/api$/i, '').replace(/\/+$/, '');
        baseUrl = (parsed.origin + cleanPath).replace(/\/+$/, '');
      }
    } catch {}
  }

  let apiKey =
    readEnvVar(env, [
      'API_KEY',
      'NEWS_API_KEY',
      'APIKEY',
      'NEWS_SOURCES_API_KEY',
      'X_API_KEY',
      'API_SECRET_KEY',
      'API_TOKEN',
      'NEWS_API_TOKEN',
      'NEWS_SOURCES_API_TOKEN',
      'API_SECRET',
      'NEWS_API_SECRET',
      'ACCESS_TOKEN',
      'BEARER_TOKEN',
      'NEWS_KEY',
      'KEY_API',
      'CHAVE_API',
      'NEWS_SOURCES_KEY',
      'AUTHORIZATION_TOKEN',
      'AUTH_TOKEN',
    ]) || embeddedKey;
  if (/^bearer\s+/i.test(apiKey)) {
    apiKey = apiKey.replace(/^bearer\s+/i, '').trim();
  }

  return { baseUrl, apiKey };
}

export function resolveWorkerWeatherConfig(env = {}) {
  const rawWeatherUrl = readEnvVar(env, [
    'WEATHER_API_BASE_URL',
    'WEATHER_BASE_URL',
    'NEXT_PUBLIC_WEATHER_API_BASE_URL',
    'api_url_clima_base',
  ]);
  if (rawWeatherUrl) {
    try {
      const parsed = assertSafeExternalUrl(rawWeatherUrl);
      if (parsed.protocol === 'https:') {
        return { baseUrl: parsed.origin, requiresAuth: false };
      }
    } catch {}
  }
  return { baseUrl: DEFAULT_WEATHER_API_BASE_URL, requiresAuth: false };
}

export function resolveWorkerAdsenseConfig(env = {}) {
  const clientId =
    readEnvVar(env, ['NEXT_PUBLIC_ADSENSE_ID', 'GOOGLE_ADSENSE_CLIENT_ID']) || 'ca-pub-7059730627018047';
  return {
    clientId,
    slots: {
      header: readEnvVar(env, ['NEXT_PUBLIC_ADSENSE_SLOT_HEADER', 'GOOGLE_ADSENSE_SLOT_HEADER']),
      sidebar: readEnvVar(env, ['NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR', 'GOOGLE_ADSENSE_SLOT_SIDEBAR']),
      sidebarBottom: readEnvVar(env, ['NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR_BOTTOM', 'GOOGLE_ADSENSE_SLOT_SIDEBAR_BOTTOM']),
      inArticle: readEnvVar(env, ['NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE', 'GOOGLE_ADSENSE_SLOT_IN_ARTICLE']),
      footer: readEnvVar(env, ['NEXT_PUBLIC_ADSENSE_SLOT_FOOTER', 'GOOGLE_ADSENSE_SLOT_FOOTER']),
    },
  };
}

export function buildWorkerNewsApiHeaders(apiKey, env = {}) {
  const site = resolveWorkerSiteConfig(env);
  const headers = {
    Accept: 'application/json',
    'User-Agent': `NormaJuridica/1.0 (+${site.appUrl})`,
    Origin: site.appUrl,
    Referer: `${site.appUrl}/`,
    'X-Site-Domain': site.domain,
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }
  return headers;
}

/**
 * Resolve redirecionamentos canônicos e correções de protocolo/DNS para o domínio configurado no env.
 * Não redireciona localhost, 127.0.0.1 ou ambientes de preview temporários.
 */
export function resolveDnsAndCanonical(request, env = {}) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const { domain: canonicalDomain } = resolveWorkerSiteConfig(env);

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

  const isProductionApex = host === canonicalDomain;
  const isProductionWww = host === `www.${canonicalDomain}`;

  if (isProductionWww || (isProductionApex && effectiveProto === 'http')) {
    const canonical = new URL(url.toString());
    canonical.protocol = 'https:';
    canonical.hostname = canonicalDomain;
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
  const rawOrigin = readEnvVar(env, ['ORIGIN_URL']);
  if (!rawOrigin) return null;

  const hop = parseInt(requestHeaders.get('x-nj-worker-hop') || '0', 10);
  if (hop >= 1) return null;

  try {
    const parsed = new URL(rawOrigin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;

    const originHost = parsed.hostname.toLowerCase();
    if (isPrivateOrReservedHost(originHost)) return null;

    const currentHost = currentUrl.hostname.toLowerCase();
    const { domain: configuredDomain } = resolveWorkerSiteConfig(env);

    if (
      originHost === CANONICAL_DOMAIN ||
      originHost === `www.${CANONICAL_DOMAIN}` ||
      originHost === configuredDomain ||
      originHost === `www.${configuredDomain}` ||
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
  if (typeof data === 'string') return sanitizeStringSecrets(data);
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

const WORKER_CATEGORY_PARENT_MAP = {
  brasil: ['brasil', 'noticias-gerais'],
  'noticias-gerais': ['brasil', 'noticias-gerais'],
  cultura: ['cultura', 'pop-e-arte'],
  'pop-e-arte': ['pop-e-arte', 'cultura'],
  economia: ['economia', 'financas'],
  financas: ['financas', 'economia'],
  esporte: ['esporte', 'palmeiras', 'autoesporte'],
  saude: ['saude'],
  'sao-paulo': ['sao-paulo', 'campinas-e-regiao', 'bauru-e-marilia', 'santos-e-regiao', 'sao-carlos-e-araraquara', 'ribeirao-preto-e-franca', 'mogi-das-cruzes-e-suzano', 'vale-do-paraiba-e-regiao'],
  'rio-de-janeiro': ['rio-de-janeiro', 'norte-fluminense', 'regiao-dos-lagos-fluminense', 'regiao-serrana-fluminense', 'sul-e-costa-verde-fluminense'],
  pernambuco: ['pernambuco', 'caruaru-e-regiao', 'petrolina-e-regiao'],
  'grande-minas': ['grande-minas', 'minas-gerais', 'sul-de-minas', 'centro-oeste-de-minas', 'vales-de-minas-gerais', 'zona-da-mata-mineira'],
  'minas-gerais': ['grande-minas', 'minas-gerais', 'sul-de-minas', 'centro-oeste-de-minas', 'vales-de-minas-gerais', 'zona-da-mata-mineira'],
};

const WORKER_CATEGORY_KEYWORD_MAP = {
  bahia: ['bahia', 'salvador', 'feira de santana', 'ilhéus', 'vitória da conquista', 'porto seguro', 'baiano'],
  ceara: ['ceará', 'ceara', 'fortaleza', 'cariri', 'juazeiro do norte', 'sobral', 'cearense'],
  'distrito-federal': ['distrito federal', 'brasília', 'brasilia', 'df', 'esplanada', 'stf', 'congresso', 'gdf'],
  'sao-paulo': ['são paulo', 'sao paulo', 'campinas', 'santos', 'ribeirão preto', 'paulista'],
  'rio-de-janeiro': ['rio de janeiro', 'fluminense', 'niterói', 'petrópolis', 'cabo frio', 'macaé'],
  pernambuco: ['pernambuco', 'recife', 'caruaru', 'petrolina', 'olinda', 'pernambucano'],
  acre: ['acre', 'rio branco', 'acriano'],
  alagoas: ['alagoas', 'maceió', 'alagoano'],
  amapa: ['amapá', 'amapa', 'macapá'],
  amazonas: ['amazonas', 'manaus', 'amazonense'],
  maranhao: ['maranhão', 'maranhao', 'são luís'],
  para: ['pará', 'para ', 'belém', 'santarém', 'marabá', 'paraense'],
  paraiba: ['paraíba', 'paraiba', 'joão pessoa', 'campina grande'],
  parana: ['paraná', 'parana', 'curitiba', 'londrina', 'maringá', 'cascavel'],
  'rio-grande-do-norte': ['rio grande do norte', 'natal', 'mossoró', 'potiguar'],
  'rio-grande-do-sul': ['rio grande do sul', 'porto alegre', 'caxias do sul', 'gaúcho'],
  rondonia: ['rondônia', 'rondonia', 'porto velho'],
  roraima: ['roraima', 'boa vista'],
  sergipe: ['sergipe', 'aracaju', 'sergipano'],
  tocantins: ['tocantins', 'palmas', 'araguaína', 'gurupi'],
  goias: ['goiás', 'goias', 'goiânia', 'anápolis'],
  'santa-catarina': ['santa catarina', 'florianópolis', 'joinville', 'blumenau', 'chapecó'],
  loterias: ['mega-sena', 'lotofácil', 'loteria', 'quina', 'timemania', 'caixa'],
  palmeiras: ['palmeiras', 'verdão', 'allianz parque', 'abel ferreira'],
  autoesporte: ['carro', 'veículo', 'automóvel', 'detran', 'ipva', 'motorista', 'trânsito'],
  financas: ['banco central', 'selic', 'dólar', 'ibovespa', 'inflação', 'receita federal', 'imposto', 'juros'],
  cultura: ['cultura', 'cinema', 'teatro', 'música', 'festival', 'livro', 'exposição', 'museu'],
  justica: ['stf', 'stj', 'tribunal', 'lei', 'juiz', 'direito', 'ministério público', 'processo', 'oab'],
  politica: ['governo', 'congresso', 'senado', 'câmara', 'ministro', 'presidente', 'eleição', 'projeto de lei'],
  saude: ['saúde', 'sus', 'hospital', 'vacina', 'anvisa', 'médico', 'doença'],
  educacao: ['educação', 'enem', 'universidade', 'mec', 'escola', 'professor', 'vestibular'],
  'tecnologia-e-games': ['tecnologia', 'inteligência artificial', 'aplicativo', 'digital', 'cibersegurança', 'game'],
  'turismo-e-viagem': ['turismo', 'viagem', 'aeroporto', 'passagem', 'hotel', 'destino'],
};

function getCategoryAliasSlugs(slugOrId = '') {
  const norm = normalizeCategoryText(slugOrId);
  if (!norm) return [];
  const parentAliases = WORKER_CATEGORY_PARENT_MAP[norm] || [];
  return Array.from(new Set([norm, ...parentAliases]));
}

function getCategoryKeywords(categoryOrSlug = '') {
  const norm = normalizeCategoryText(categoryOrSlug);
  const mapped = WORKER_CATEGORY_KEYWORD_MAP[norm];
  if (mapped && mapped.length > 0) return mapped;
  const parts = norm.split('-').filter((w) => w.length >= 3 && !['regiao', 'sul', 'norte', 'oeste'].includes(w));
  return parts.length > 0 ? parts : [resolveCategoryDisplayName(norm).toLowerCase()];
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

const WORKER_CSP_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://adservice.google.com https://fundingchoicesmessages.google.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://www.googletagservices.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' https: http: blob:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google",
  'upgrade-insecure-requests',
].join('; ');

export function applySecurityHeaders(response, pathname = '') {
  const headers = new Headers(response.headers);
  headers.delete('X-Powered-By');
  headers.delete('Server');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-DNS-Prefetch-Control', 'on');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()');
  headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  headers.set('X-XSS-Protection', '0');
  headers.set('Content-Security-Policy', WORKER_CSP_POLICY);
  headers.set('X-Norma-Runtime', 'cloudflare-worker');

  if (pathname.startsWith('/api/')) {
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
  } else if (/\.(xml|txt|webmanifest)$/i.test(pathname) && !headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
  } else if (!headers.has('Cache-Control') && response.status >= 200 && response.status < 300) {
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=600');
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
  const site = resolveWorkerSiteConfig(env);
  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return url.origin;
  }
  if (site.hasAppUrlVar) {
    return site.appUrl;
  }
  if (url.hostname.endsWith('.workers.dev')) {
    return url.origin;
  }
  if (site.hasSiteDomainVar) {
    return `https://${site.domain}`;
  }
  return site.appUrl || CANONICAL_ORIGIN;
}

const IMAGE_WIDTH_KEYS = new Set(['w', 'width', 'mw', 'maxwidth', 'minwidth', 'imwidth', 'sw', 'w_px']);
const IMAGE_HEIGHT_KEYS = new Set(['h', 'height', 'mh', 'maxheight', 'minheight', 'h_px']);
const IMAGE_RESIZE_KEYS = new Set(['resize', 'fit', 'crop', 'sz', 'size', 's', 'zoom', 'scale']);
const SIGNED_IMAGE_URL_REGEX =
  /(?:^|[?&])(?:x-amz-[a-z0-9-]+|x-goog-[a-z0-9-]+|signature|expires|sig|sv|se|sp|hmac|checksum|token|auth)=/i;

export function isLowResThumbnailUrl(url = '') {
  if (!url) return false;
  const lower = String(url).toLowerCase();
  const qMatch = lower.match(/[?&](?:w|width|mw|maxwidth|imwidth|sw|s|size)=(\d+)\b/);
  if (qMatch && parseInt(qMatch[1], 10) < 600) return true;
  const rMatch = lower.match(/[?&](?:resize|fit)=(\d+)[,x](\d+)\b/);
  if (rMatch && parseInt(rMatch[1], 10) < 600) return true;
  const fileMatch = lower.split('?')[0].match(/-(\d+)x(\d+)\.(?:jpe?g|png|webp|gif|avif)$/i);
  if (fileMatch && parseInt(fileMatch[1], 10) < 600) return true;
  return false;
}

function unwrapNextImageProxy(rawUrl = '') {
  try {
    if (/\/_next\/image\b/i.test(rawUrl)) {
      const parsed = new URL(rawUrl, 'https://localhost');
      const inner = parsed.searchParams.get('url');
      if (inner && /^https?:\/\//i.test(inner)) {
        return inner;
      }
    }
  } catch {}
  return rawUrl;
}

export function upgradeImageResolution(rawUrl = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let clean = rawUrl.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo').replace(/&amp;/g, '&').trim();
  if (!clean || clean === 'undefined' || clean === 'null') return '';
  clean = unwrapNextImageProxy(clean);
  if (!/^https?:\/\//i.test(clean)) return clean;
  if (SIGNED_IMAGE_URL_REGEX.test(clean)) return clean;

  let parsed;
  try {
    parsed = new URL(clean);
  } catch {
    return clean;
  }

  let mutated = false;
  let strippedDimensionParam = false;
  const keysToDelete = [];

  for (const [key, val] of Array.from(parsed.searchParams.entries())) {
    const kLower = key.toLowerCase();
    const vTrim = val.trim();

    if (IMAGE_WIDTH_KEYS.has(kLower) || IMAGE_HEIGHT_KEYS.has(kLower)) {
      keysToDelete.push(key);
      strippedDimensionParam = true;
      mutated = true;
      continue;
    }

    if (kLower === 'resize' || kLower === 'fit' || kLower === 'crop') {
      keysToDelete.push(key);
      strippedDimensionParam = true;
      mutated = true;
      continue;
    }

    if (kLower === 'sz' && /^(?:w\d+(?:-h\d+)?|\d+)$/i.test(vTrim)) {
      keysToDelete.push(key);
      strippedDimensionParam = true;
      mutated = true;
      continue;
    }

    if (
      (kLower === 's' || kLower === 'size' || kLower === 'zoom' || kLower === 'scale') &&
      (/^\d+$/.test(vTrim) || /^(?:thumb|thumbnail|small|medium)$/i.test(vTrim)) &&
      (/\.(?:jpe?g|png|webp|gif|avif)$/i.test(parsed.pathname) ||
        /(?:wp\.com|wordpress\.com|gravatar\.com|wp-content|uploads|cdn|img)/i.test(parsed.href))
    ) {
      keysToDelete.push(key);
      strippedDimensionParam = true;
      mutated = true;
      continue;
    }

    if (IMAGE_RESIZE_KEYS.has(kLower) && /^\d+(?:[,xX]\d+)?$/.test(vTrim)) {
      keysToDelete.push(key);
      strippedDimensionParam = true;
      mutated = true;
    }
  }

  for (const k of keysToDelete) {
    parsed.searchParams.delete(k);
  }

  if (strippedDimensionParam) {
    for (const key of Array.from(parsed.searchParams.keys())) {
      const kLower = key.toLowerCase();
      if (kLower === 'q' || kLower === 'quality' || kLower === 'strip') {
        parsed.searchParams.delete(key);
      }
    }
  }

  if (/(?:googleusercontent\.com|ggpht\.com|blogspot\.com)/i.test(parsed.hostname)) {
    const newPath = parsed.pathname
      .replace(/\/([sw])(\d+)(?:-[ch][a-z0-9-]*)?\//gi, (m, _p, digits) =>
        parseInt(digits, 10) > 0 ? '/s0/' : m
      )
      .replace(/=([sw])(\d+)(?:-[a-z0-9-]+)*$/i, (m, _p, digits) =>
        parseInt(digits, 10) > 0 ? '=s0' : m
      );
    if (newPath !== parsed.pathname) {
      parsed.pathname = newPath;
      mutated = true;
    }
  }

  if (!/glbimg\.com/i.test(parsed.hostname)) {
    const nextPath = parsed.pathname.replace(
      /-(\d{2,3})x(\d{2,3})(\.(?:jpe?g|png|webp|gif|avif))$/i,
      (full, wStr, _hStr, ext) => (parseInt(wStr, 10) < 500 ? ext : full)
    );
    if (nextPath !== parsed.pathname) {
      parsed.pathname = nextPath;
      mutated = true;
    }
  }

  return mutated ? parsed.toString() : clean;
}

function normalizeImageKeyForWorker(url = '') {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim().replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo');
  clean = clean.split('#')[0].split('?')[0];
  const glbIdx = clean.indexOf('/internal_photos/');
  if (glbIdx !== -1) {
    clean = clean.slice(glbIdx);
  } else {
    clean = clean.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  }
  clean = clean.replace(/(?:-\d+x\d+|-scaled)(\.(?:jpe?g|png|webp|gif|avif))$/i, '$1');
  return clean.toLowerCase();
}

function pickBestImgSrcFromAttrs(attrs = '') {
  if (!attrs) return '';
  const isUsable = (u) =>
    /^https?:\/\//i.test(u) && !/placeholder|pixel|1x1|blank\.gif|data:image/i.test(u);

  const candidates = [];
  const srcsetMatch = attrs.match(/\b(?:data-srcset|srcset)=["']([^"']+)["']/i);
  if (srcsetMatch && srcsetMatch[1]) {
    for (const entry of srcsetMatch[1].split(',')) {
      const parts = entry.trim().split(/\s+/);
      const raw = parts[0] ? parts[0].replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo').replace(/&amp;/g, '&').trim() : '';
      if (!isUsable(raw)) continue;
      let score = 500;
      const desc = parts[1] || '';
      const wMatch = desc.match(/^(\d+)w$/i);
      const xMatch = desc.match(/^(\d+(?:\.\d+)?)x$/i);
      if (wMatch) score = parseInt(wMatch[1], 10);
      else if (xMatch) score = Math.round(parseFloat(xMatch[1]) * 800);
      candidates.push({ url: upgradeImageResolution(raw), score });
    }
  }

  const attrSources = [
    attrs.match(/\bdata-original=["']([^"']+)["']/i)?.[1],
    attrs.match(/\bdata-lazy-src=["']([^"']+)["']/i)?.[1],
    attrs.match(/\bdata-src=["']([^"']+)["']/i)?.[1],
    attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1],
  ];
  for (const rawSrc of attrSources) {
    if (!rawSrc) continue;
    const raw = rawSrc.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo').replace(/&amp;/g, '&').trim();
    if (!isUsable(raw)) continue;
    const upgraded = upgradeImageResolution(raw);
    candidates.push({ url: upgraded, score: isLowResThumbnailUrl(upgraded) ? 200 : 800 });
  }

  if (candidates.length === 0) return '';
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}

export function extractImageFromItem(item) {
  const candidates = [item.imageUrl, item.mediaUrl, item.image, item.urlToImage, item.featured_image, item.enclosure?.url];
  if (Array.isArray(item.images)) candidates.push(...item.images);
  const rawHtml = `${item.description || ''} ${item.content || ''}`;
  const imgTagRegex = /<img\b([^>]*)>/gi;
  let imgMatch;
  while ((imgMatch = imgTagRegex.exec(rawHtml)) !== null) {
    const best = pickBestImgSrcFromAttrs(imgMatch[1] || '');
    if (best) candidates.push(best);
  }
  if (item.thumbnail) candidates.push(item.thumbnail);

  const validUpgraded = [];
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const upgraded = upgradeImageResolution(c);
    if (/^https?:\/\//i.test(upgraded) && !/placeholder|pixel|1x1|blank\.gif|data:image/i.test(upgraded)) {
      validUpgraded.push(upgraded);
    }
  }
  if (validUpgraded.length === 0) return '';
  const highRes = validUpgraded.find((u) => !isLowResThumbnailUrl(u));
  return highRes || validUpgraded[0];
}

const WORKER_ABBREVIATIONS = [
  'Sr.', 'Sra.', 'Srs.', 'Sras.', 'Dr.', 'Dra.', 'Drs.', 'Dras.',
  'Prof.', 'Profa.', 'Exmo.', 'Exma.', 'Ilmo.', 'Ilma.',
  'Art.', 'Inc.', 'Par.', 'Al.', 'p.ex.', 'etc.', 'vs.', 'n.º', 'No.',
  'Ltda.', 'S.A.', 'S/A.', 'CIA.', 'Cia.', 'Tel.', 'Av.', 'R.',
  'Min.', 'Des.', 'Dep.', 'Sen.', 'Gov.', 'Pres.', 'Pref.', 'Ver.',
  'Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.',
];

const WORKER_NOISE_LINE_REGEX = /^(?:leia mais|leia também|veja também|veja mais|saiba mais|confira também|assine a newsletter|siga nossas redes|participe do canal|entre no grupo|publicidade|anúncio|continue lendo)\b/i;

function splitPortugueseSentencesForWorker(text = '') {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  let guarded = clean;
  for (let i = 0; i < WORKER_ABBREVIATIONS.length; i++) {
    const abbr = WORKER_ABBREVIATIONS[i];
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    guarded = guarded.replace(new RegExp(`\\b${escaped}`, 'g'), abbr.replace(/\./g, '@@DOT@@'));
  }
  guarded = guarded
    .replace(/\b([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])\./g, '$1@@DOT@@')
    .replace(/(\d)\.(\d)/g, '$1@@DOT@@$2')
    .replace(/\b(com|gov|org|edu|net)\.br\b/gi, '$1@@DOT@@br')
    .replace(/\.(com|org|net|br|io|dev)\b/gi, '@@DOT@@$1');
  const raw = guarded
    .split(/(?<=[.!?]["'”’)]?)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ“"'(\d])/)
    .map((s) => s.replace(/@@DOT@@/g, '.').trim())
    .filter(Boolean);
  return raw.length > 0 ? raw : [clean];
}

function splitLongParagraphTextForWorker(text = '', targetChars = 360) {
  const trimmed = String(text || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return [];
  if (trimmed.length <= 420) return [trimmed];
  const sentences = splitPortugueseSentencesForWorker(trimmed);
  if (sentences.length <= 1) return [trimmed];
  const paragraphs = [];
  let bucket = [];
  let bucketLen = 0;
  for (const s of sentences) {
    if (bucket.length >= 2 && (bucketLen + s.length > targetChars || bucket.length >= 3)) {
      paragraphs.push(bucket.join(' ').trim());
      bucket = [s];
      bucketLen = s.length;
    } else {
      bucket.push(s);
      bucketLen += s.length + 1;
    }
  }
  if (bucket.length > 0) paragraphs.push(bucket.join(' ').trim());
  return paragraphs.filter(Boolean);
}

export function formatArticleParagraphsHtml(rawHtmlOrText = '') {
  if (!rawHtmlOrText) return '';
  let input = String(rawHtmlOrText).replace(/\r\n/g, '\n').trim();
  if (!input) return '';

  for (let i = 0; i < 3; i++) {
    const next = input
      .replace(/<p\b[^>]*>\s*<p\b([^>]*)>/gi, '<p$1>')
      .replace(/<\/p>\s*<\/p>/gi, '</p>');
    if (next === input) break;
    input = next;
  }

  input = input.replace(/(?:<br\s*\/?>\s*){2,}/gi, '</p><p>');
  const hasBlockTags = /<(?:p|h[1-6]|ul|ol|blockquote|figure|video|audio|table)\b/i.test(input);
  if (!hasBlockTags) {
    const plainLines = input
      .replace(/<br\s*\/?>/gi, '\n')
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !WORKER_NOISE_LINE_REGEX.test(l));
    const expanded = [];
    for (const line of plainLines) {
      for (const chunk of splitLongParagraphTextForWorker(line)) {
        expanded.push(`<p>${chunk}</p>`);
      }
    }
    return expanded.join('\n');
  }

  const out = input.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (_full, attrs, inner) => {
    const trimmedInner = (inner || '').trim();
    if (!trimmedInner) return '';
    if (/<(?:img|video|audio|iframe|figure|table|ul|ol|blockquote)\b/i.test(trimmedInner)) {
      return `<p${attrs}>${trimmedInner}</p>`;
    }
    const subParts = trimmedInner
      .split(/<br\s*\/?>|\n+/gi)
      .map((s) => s.trim())
      .filter(Boolean);
    const hasInlineLinksOrFormat = /<(?:a|strong|em|b|i)\b/i.test(trimmedInner);
    if (hasInlineLinksOrFormat && trimmedInner.length <= 750 && subParts.length <= 1) {
      if (WORKER_NOISE_LINE_REGEX.test(stripHtmlTags(trimmedInner))) return '';
      return `<p${attrs}>${trimmedInner}</p>`;
    }
    const resultBlocks = [];
    for (const part of subParts.length > 0 ? subParts : [trimmedInner]) {
      const plainPart = stripHtmlTags(part);
      if (!plainPart || WORKER_NOISE_LINE_REGEX.test(plainPart)) continue;
      if (/<(?:a|strong|em|b|i)\b/i.test(part) && plainPart.length <= 450) {
        resultBlocks.push(`<p>${part}</p>`);
      } else {
        const textToSplit = hasInlineLinksOrFormat ? plainPart : part.replace(/<[^>]+>/g, ' ').trim();
        for (const chunk of splitLongParagraphTextForWorker(textToSplit)) {
          resultBlocks.push(`<p>${chunk}</p>`);
        }
      }
    }
    return resultBlocks.join('\n');
  });

  if (!/<p\b/i.test(out)) {
    const plain = stripHtmlTags(out);
    if (!plain) return '';
    return splitLongParagraphTextForWorker(plain).map((c) => `<p>${c}</p>`).join('\n');
  }
  return out.replace(/<p[^>]*>\s*(?:&nbsp;|\s)*<\/p>/gi, '').trim();
}

function extractArticleFromHtmlForWorker(html = '') {
  if (!html) return '';
  let cleaned = String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch && articleMatch[1] && articleMatch[1].length > 300) {
    cleaned = articleMatch[1];
  } else {
    const containerPatterns = [
      /<[^>]+(?:itemprop=["']articleBody["']|class=["'][^"']*(?:entry-content|article-body|post-content|materia-conteudo|content-text|td-post-content|mc-article-body)[^"']*["'])[^>]*>/i,
      /<main\b[^>]*>/i,
    ];
    for (const rx of containerPatterns) {
      const m = rx.exec(cleaned);
      if (m) {
        const startIdx = m.index + m[0].length;
        const endMain = cleaned.indexOf('</main>', startIdx);
        const endFooter = cleaned.indexOf('<footer', startIdx);
        const sliceEnd =
          endMain !== -1
            ? endMain
            : endFooter !== -1
              ? endFooter
              : Math.min(cleaned.length, startIdx + 48000);
        const slice = cleaned.slice(startIdx, sliceEnd);
        if (slice.length > 250) {
          cleaned = slice;
          break;
        }
      }
    }
  }

  const blockMatches = cleaned.match(/<(h[2-4]|p|blockquote)\b[^>]*>[\s\S]*?<\/\1>|<figure\b[^>]*>[\s\S]*?<\/figure>/gi);
  if (blockMatches && blockMatches.length > 0) {
    const blocks = [];
    for (const rawBlock of blockMatches) {
      const tagMatch = rawBlock.match(/^<([a-z0-9]+)/i);
      const tag = (tagMatch?.[1] || 'p').toLowerCase();
      if (tag === 'figure') {
        const imgSrcMatch = rawBlock.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
        if (imgSrcMatch?.[1]) {
          const upgraded = upgradeImageResolution(imgSrcMatch[1]);
          if (/^https?:\/\//i.test(upgraded)) {
            blocks.push(`<p><img src="${escapeHtml(upgraded)}" alt="Imagem da reportagem" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></p>`);
          }
        }
        continue;
      }
      const plain = stripHtmlTags(rawBlock).trim();
      if (plain.length < 20) continue;
      if (WORKER_NOISE_LINE_REGEX.test(plain)) continue;
      if (/^(?:©|todos os direitos|atualizado em \d|por redação$)/i.test(plain) && plain.length < 70) continue;
      if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
        blocks.push(`<${tag}>${escapeHtml(plain)}</${tag}>`);
      } else if (tag === 'blockquote') {
        blocks.push(`<blockquote><p>${escapeHtml(plain)}</p></blockquote>`);
      } else {
        blocks.push(`<p>${escapeHtml(plain)}</p>`);
      }
    }
    if (blocks.length > 0) {
      return formatArticleParagraphsHtml(blocks.join('\n'));
    }
  }
  return formatArticleParagraphsHtml(escapeHtml(stripHtmlTags(cleaned)));
}

async function fetchFullArticleBodyForWorker(url, limit = 50000) {
  let safeUrl;
  try {
    safeUrl = assertSafeExternalUrl(url);
  } catch {
    return '';
  }
  try {
    const res = await fetch(safeUrl.toString(), {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NormaJuridica/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    return extractArticleFromHtmlForWorker(html).slice(0, limit);
  } catch {
    return '';
  }
}

function normalizeUpstreamItem(raw, fallbackCategory = 'Brasil', sourceId = '') {
  if (!raw || !raw.title) return null;
  const title = stripHtmlTags(raw.title).replace(/\s+/g, ' ').trim();
  if (title.length < 5) return null;

  const rawCategory = cleanCategoryName(raw.category || fallbackCategory || 'Brasil');
  const category = rawCategory === 'Notícias Gerais' ? 'Brasil' : rawCategory;
  const categoryId = normalizeCategoryText(category) || 'brasil';
  const itemIdStr = String(raw.id || raw.slug || title);
  const slug = raw.slug ? normalizeCategoryText(raw.slug) : slugify(title, itemIdStr);
  const pubDate = raw.pubDate || raw.publishedAt || raw.createdAt || raw.date || new Date().toISOString();
  const imageUrl = extractImageFromItem(raw);

  let summary = stripHtmlTags(raw.description || raw.summary || raw.content || '');
  if (summary.length > 260) {
    summary = summary.slice(0, 260).replace(/\s+[^\s]*$/, '') + '…';
  }
  if (!summary) {
    summary = `Acompanhe os detalhes completos sobre ${title} na editoria de ${category} do portal Norma Jurídica.`;
  }

  let contentHtml =
    raw.contentHtml ||
    raw.content_encoded ||
    raw.contentEncoded ||
    raw.fullContent ||
    raw.content ||
    raw.body ||
    raw.text ||
    raw.description ||
    `<p>${escapeHtml(summary)}</p>`;
  contentHtml = sanitizeArticleHtmlForWorker(contentHtml, imageUrl);

  return {
    id: slug,
    slug,
    title,
    summary,
    contentHtml,
    category,
    categoryId,
    sourceId: String(sourceId || raw.sourceId || ''),
    author: raw.author && !/^\d+$/.test(String(raw.author)) ? String(raw.author).trim() : 'Norma Jurídica',
    pubDate,
    isoDate: pubDate,
    timeAgo: formatTimeAgo(pubDate),
    imageUrl,
    images: imageUrl ? [imageUrl] : [],
    link: `/noticia/${slug}`,
    sourceUrl: raw.link || raw.url || raw.sourceUrl || '',
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
  if (featuredImage) {
    const featKey = normalizeImageKeyForWorker(upgradeImageResolution(featuredImage));
    if (featKey) seenImgs.add(featKey);
  }
  out = out.replace(/<img\b([^>]*)>/gi, (_full, attrs) => {
    const clean = pickBestImgSrcFromAttrs(attrs || '');
    const key = normalizeImageKeyForWorker(clean);
    if (!clean || !key || seenImgs.has(key)) return '';
    seenImgs.add(key);
    const altMatch = attrs.match(/\balt=["']([^"']*)["']/i);
    const altText = altMatch && altMatch[1] ? altMatch[1].trim() : '';
    const caption =
      altText && altText !== 'Imagem da matéria' && altText !== 'Imagem da reportagem'
        ? `<figcaption class="text-xs text-slate-500 dark:text-zinc-400 mt-2 italic px-1">${escapeHtml(altText)}</figcaption>`
        : '';
    return `<figure class="my-6 not-prose"><div class="zoom-frame relative w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"><img src="${escapeHtml(clean)}" alt="${escapeHtml(altText || 'Imagem da reportagem')}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="w-full h-auto object-cover rounded-xl" /></div>${caption}</figure>`;
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

  out = formatArticleParagraphsHtml(out);
  return out;
}

async function fetchUpstreamJsonDetailed(env, endpoint, timeoutMs = 5500) {
  const { baseUrl, apiKey } = resolveWorkerNewsApiConfig(env);
  const headers = buildWorkerNewsApiHeaders(apiKey, env);
  const attemptFetch = async (targetUrl) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(targetUrl, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  let res = await attemptFetch(`${baseUrl}${endpoint}`);
  if (res && res.status === 401 && apiKey) {
    const sep = endpoint.includes('?') ? '&' : '?';
    res = await attemptFetch(`${baseUrl}${endpoint}${sep}ref=${encodeURIComponent(apiKey)}`);
  }
  if (!res) return { data: null, status: 0 };
  if (!res.ok) return { data: null, status: res.status };
  try {
    return { data: await res.json(), status: res.status };
  } catch {
    return { data: null, status: res.status };
  }
}

export function diagnoseWorkerUpstream({ ok = false, httpStatus = 0, hasApiKey = false, baseUrl = '', siteDomain = '', currentHost = '' } = {}) {
  let upstreamHost = '';
  try {
    upstreamHost = new URL(baseUrl).hostname.toLowerCase();
  } catch {}
  const ownHosts = [siteDomain, siteDomain ? `www.${siteDomain}` : '', currentHost]
    .map((h) => String(h || '').toLowerCase())
    .filter(Boolean);
  const selfReference = Boolean(upstreamHost && ownHosts.includes(upstreamHost));

  if (selfReference) {
    return {
      selfReference,
      message: `A URL base da API (${upstreamHost}) é o próprio site. O worker estaria consultando a si mesmo e nunca receberia notícias. Aponte NEWS_API_BASE_URL para o serviço que entrega as fontes.`,
    };
  }
  if (ok) return { selfReference, message: '' };
  if (!httpStatus) {
    return {
      selfReference,
      message: `Sem resposta de ${upstreamHost || 'a API'}. Verifique se o domínio existe no DNS, se está vinculado a um worker ativo e se responde em /api/types.`,
    };
  }
  if (httpStatus === 401) {
    return {
      selfReference,
      message: hasApiKey
        ? 'A API recusou a chave (HTTP 401). Confirme que API_KEY é a chave emitida para este serviço e que o painel da Cloudflare não a sobrescreveu com outro valor.'
        : 'A API exige chave (HTTP 401) e nenhuma foi encontrada no ambiente do worker.',
    };
  }
  if (httpStatus === 403) {
    return {
      selfReference,
      message: `A API bloqueou a origem (HTTP 403). O worker envia Origin, Referer e X-Site-Domain com ${siteDomain || 'o domínio configurado'}. Se a chave está vinculada a outro domínio, autorize este na API.`,
    };
  }
  if (httpStatus === 404) {
    return {
      selfReference,
      message: 'Endpoint não encontrado (HTTP 404). A URL base precisa servir /api/types e /api/news. Confira o endereço e o sufixo /api em NEWS_API_BASE_URL.',
    };
  }
  if (httpStatus >= 520 && httpStatus <= 527) {
    return {
      selfReference,
      message: `A Cloudflare não conseguiu alcançar o servidor por trás de ${upstreamHost || 'a API'} (HTTP ${httpStatus}). O registro DNS existe, mas aponta para um destino que não responde. Vincule o domínio a um worker ativo (Domains & Routes) ou corrija o registro DNS.`,
    };
  }
  if (httpStatus === 429) {
    return { selfReference, message: 'A API limitou as requisições (HTTP 429). Aguarde alguns minutos antes de sincronizar de novo.' };
  }
  if (httpStatus >= 500) {
    return { selfReference, message: `A API respondeu com erro interno (HTTP ${httpStatus}). O problema está no serviço de origem.` };
  }
  return { selfReference, message: `Resposta inesperada da API (HTTP ${httpStatus}).` };
}

async function fetchUpstreamJson(env, endpoint, timeoutMs = 5500) {
  const { data } = await fetchUpstreamJsonDetailed(env, endpoint, timeoutMs);
  return data;
}

function isSourceDescriptor(raw) {
  return Boolean(raw && !raw.title && raw.id && (raw.endpoint || raw.type || raw.category));
}

const EDGE_CACHE_VERSION = 'v3';
const SHARD_SIZE = 25;
const SHARD_FRESH_TTL_MS = 60 * 1000;
const MAX_TOTAL_ITEMS = 15000;
const MAX_PER_SHARD_ITEMS = 6000;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function getSourceShards() {
  const shards = [];
  for (let i = 0; i < DEFAULT_SOURCE_IDS.length; i += SHARD_SIZE) {
    shards.push(DEFAULT_SOURCE_IDS.slice(i, i + SHARD_SIZE));
  }
  return shards;
}

function normalizeCachedItemImages(it) {
  if (!it || typeof it !== 'object') return it;
  const nextImg = it.imageUrl ? upgradeImageResolution(it.imageUrl) : '';
  const nextImages = Array.isArray(it.images)
    ? it.images.map((u) => upgradeImageResolution(u)).filter(Boolean)
    : nextImg
      ? [nextImg]
      : [];
  const nextTimeAgo = it.pubDate ? formatTimeAgo(it.pubDate) : it.timeAgo;
  return { ...it, imageUrl: nextImg, images: nextImages, timeAgo: nextTimeAgo };
}

function toShardIndexItem(item) {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    category: item.category,
    categoryId: item.categoryId,
    sourceId: item.sourceId || '',
    author: item.author || 'Norma Jurídica',
    pubDate: item.pubDate,
    isoDate: item.isoDate || item.pubDate,
    timeAgo: item.timeAgo,
    imageUrl: item.imageUrl || '',
    images: Array.isArray(item.images) ? item.images : item.imageUrl ? [item.imageUrl] : [],
    link: item.link || `/noticia/${item.slug}`,
    sourceUrl: item.sourceUrl || '',
  };
}

function mergeAndPrunePool(primaryItems = [], secondaryItems = [], maxCount = MAX_PER_SHARD_ITEMS) {
  const cutoffMs = Date.now() - RETENTION_MS;
  const bySlug = new Map();
  for (const raw of [...secondaryItems, ...primaryItems]) {
    if (!raw || !raw.slug) continue;
    const item = normalizeCachedItemImages(raw);
    const ts = new Date(item.pubDate || 0).getTime();
    if (!Number.isNaN(ts) && ts > 0 && ts < cutoffMs) continue;
    const existing = bySlug.get(item.slug);
    if (!existing) {
      bySlug.set(item.slug, item);
    } else {
      bySlug.set(item.slug, {
        ...existing,
        ...item,
        sourceId: item.sourceId || existing.sourceId || '',
        imageUrl: item.imageUrl || existing.imageUrl || '',
        images: item.images && item.images.length ? item.images : existing.images || [],
        contentHtml: item.contentHtml || existing.contentHtml,
      });
    }
  }
  const merged = Array.from(bySlug.values());
  merged.sort((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime());
  return merged.slice(0, maxCount);
}

function ingestUpstreamPayload(res, fallbackCat, sourceId = '', collected = [], seenSlugs = new Set()) {
  const arr = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
  const discoveredSources = [];
  for (const raw of arr) {
    if (isSourceDescriptor(raw)) {
      discoveredSources.push({ id: String(raw.id), category: raw.category || fallbackCat || 'Brasil' });
      continue;
    }
    const item = normalizeUpstreamItem(raw, fallbackCat, sourceId);
    if (item && !seenSlugs.has(item.slug)) {
      seenSlugs.add(item.slug);
      collected.push(item);
    }
  }
  return discoveredSources;
}

async function fetchShardFromUpstream(env, shardIdx, shardSources, existingItems = [], { stripContent = true } = {}) {
  const collected = [];
  const seenSlugs = new Set();
  const discoveredMap = new Map();
  let batch = [...shardSources];

  if (shardIdx === 0) {
    const rootFeed = await fetchUpstreamJson(env, '/api/news?active=true&limit=250');
    const discovered = ingestUpstreamPayload(rootFeed, 'Brasil', '', collected, seenSlugs);
    for (const d of discovered) {
      discoveredMap.set(d.id, d.category);
    }
    if (discovered.length > 0) {
      batch = Array.from(new Set([...discovered.map((d) => d.id), ...shardSources])).slice(0, SHARD_SIZE + 3);
    }
  }

  const results = await Promise.all(
    batch.map((sid) => fetchUpstreamJson(env, `/api/news/${encodeURIComponent(sid)}?limit=250`))
  );
  const fullSources = [];
  results.forEach((res, idx) => {
    const sid = batch[idx];
    const fallbackCat = discoveredMap.get(sid) || SOURCE_CATEGORY_MAP[sid] || 'Brasil';
    ingestUpstreamPayload(res, fallbackCat, sid, collected, seenSlugs);
    const arr = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    if (arr.length >= 80 && fullSources.length < 6) {
      fullSources.push(sid);
    }
  });

  if (fullSources.length > 0) {
    const page2Results = await Promise.all(
      fullSources.map((sid) => fetchUpstreamJson(env, `/api/news/${encodeURIComponent(sid)}?limit=250&page=2`))
    );
    page2Results.forEach((res, idx) => {
      const sid = fullSources[idx];
      const fallbackCat = discoveredMap.get(sid) || SOURCE_CATEGORY_MAP[sid] || 'Brasil';
      ingestUpstreamPayload(res, fallbackCat, sid, collected, seenSlugs);
    });
  }

  // Pagina o feed geral /api/news entre os lotes (até 12 páginas = 3.000+ matérias além das 80 fontes individuais)
  const startPage = shardIdx * 3 + 1;
  const feedPages = [startPage, startPage + 1, startPage + 2];
  const extraPages = await Promise.all(
    feedPages.map((p) => fetchUpstreamJson(env, `/api/news?limit=250&page=${p}`))
  );
  for (const pageRes of extraPages) {
    ingestUpstreamPayload(pageRes, 'Brasil', '', collected, seenSlugs);
  }

  const normalizedNew = stripContent ? collected.map(toShardIndexItem) : collected;
  return mergeAndPrunePool(normalizedNew, existingItems, MAX_PER_SHARD_ITEMS);
}

async function readShardCache(cache, cacheUrl) {
  if (!cache) return null;
  try {
    const hit = await cache.match(cacheUrl);
    if (!hit) return null;
    const data = await hit.json();
    if (Array.isArray(data)) {
      return { updatedAt: 0, items: data };
    }
    if (data && Array.isArray(data.items)) {
      return { updatedAt: Number(data.updatedAt) || 0, items: data.items };
    }
  } catch {}
  return null;
}

async function writeShardCache(cache, cacheUrl, items) {
  if (!cache || !Array.isArray(items) || items.length === 0) return;
  try {
    await cache.put(
      cacheUrl,
      new Response(JSON.stringify({ updatedAt: Date.now(), items }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=604800',
        },
      })
    );
  } catch {}
}

async function fetchAggregatedNews(
  env,
  { category = 'all', q = '', page = 1, limit = 24, sourceId = '', refresh = false, hydrate = false, shard = -1 } = {}
) {
  const normCat = normalizeCategoryText(category);
  const { domain: siteDomain } = resolveWorkerSiteConfig(env);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const shards = getSourceShards();
  const totalShards = shards.length;
  const shardUrl = (idx) => `https://edge-cache.${siteDomain}/${EDGE_CACHE_VERSION}/shard-${idx}`;

  if (sourceId) {
    const sidCacheUrl = `https://edge-cache.${siteDomain}/${EDGE_CACHE_VERSION}/source-${encodeURIComponent(sourceId)}`;
    const existing = await readShardCache(cache, sidCacheUrl);
    let pool = existing && !refresh && Date.now() - existing.updatedAt < SHARD_FRESH_TTL_MS ? existing.items : null;
    if (!pool) {
      const collected = [];
      const data = await fetchUpstreamJson(env, `/api/news/${encodeURIComponent(sourceId)}?limit=250`);
      ingestUpstreamPayload(data, SOURCE_CATEGORY_MAP[sourceId] || 'Brasil', sourceId, collected, new Set());
      const nextItems = cache ? collected.map(toShardIndexItem) : collected;
      pool = mergeAndPrunePool(nextItems, existing?.items || [], MAX_PER_SHARD_ITEMS);
      await writeShardCache(cache, sidCacheUrl, pool);
    } else {
      pool = pool.map(normalizeCachedItemImages);
    }
    let filtered = pool;
    if (q && q.trim()) {
      const qLower = q.toLowerCase().trim();
      filtered = filtered.filter(
        (i) => i.title.toLowerCase().includes(qLower) || i.summary.toLowerCase().includes(qLower) || i.category.toLowerCase().includes(qLower)
      );
    }
    const total = filtered.length;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 20000);
    const offset = (safePage - 1) * safeLimit;
    return {
      items: filtered.slice(offset, offset + safeLimit),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      hydration: { hydratedShards: 1, totalShards: 1, pendingShards: 0, activeSourcesCount: DEFAULT_SOURCE_IDS.length },
    };
  }

  const shardRecords = cache
    ? await Promise.all(shards.map((_, idx) => readShardCache(cache, shardUrl(idx))))
    : shards.map(() => null);

  let pool = [];
  if (cache) {
    const missingIdx = shardRecords.findIndex((r) => !r || r.items.length === 0);
    let targetIdx = -1;

    if (shard >= 0 && shard < totalShards) {
      targetIdx = shard;
    } else if (hydrate) {
      if (missingIdx !== -1) {
        targetIdx = missingIdx;
      } else {
        let oldestIdx = 0;
        let oldestAt = shardRecords[0]?.updatedAt || 0;
        for (let i = 1; i < totalShards; i++) {
          const ts = shardRecords[i]?.updatedAt || 0;
          if (ts < oldestAt) {
            oldestAt = ts;
            oldestIdx = i;
          }
        }
        targetIdx = oldestIdx;
      }
    } else if (missingIdx === 0 || refresh) {
      targetIdx = missingIdx !== -1 ? missingIdx : 0;
      if (refresh && missingIdx === -1) {
        let oldestIdx = 0;
        let oldestAt = shardRecords[0]?.updatedAt || 0;
        for (let i = 1; i < totalShards; i++) {
          const ts = shardRecords[i]?.updatedAt || 0;
          if (ts < oldestAt) {
            oldestAt = ts;
            oldestIdx = i;
          }
        }
        targetIdx = oldestIdx;
      }
    } else {
      const anyStale = shardRecords.findIndex((r) => r && Date.now() - r.updatedAt > SHARD_FRESH_TTL_MS);
      if (anyStale !== -1 && (normCat === 'all' || normCat === 'todas' || !normCat)) {
        targetIdx = anyStale;
      }
    }

    if (targetIdx !== -1) {
      const existingItems = shardRecords[targetIdx]?.items || [];
      const updatedShard = await fetchShardFromUpstream(env, targetIdx, shards[targetIdx], existingItems, { stripContent: true });
      if (updatedShard.length > 0) {
        shardRecords[targetIdx] = { updatedAt: Date.now(), items: updatedShard };
        await writeShardCache(cache, shardUrl(targetIdx), updatedShard);
      }
    }

    const hydratedItems = shardRecords.flatMap((r) => (r && Array.isArray(r.items) ? r.items : []));
    pool = mergeAndPrunePool(hydratedItems, [], MAX_TOTAL_ITEMS);
  } else {
    // Ambiente sem Cache API (ex: testes unitários em Node.js): consulta Lote 0 mantendo contentHtml em memória
    const collected = await fetchShardFromUpstream(env, 0, shards[0], [], { stripContent: false });
    pool = collected;
  }

  const isCategoryFilter = Boolean(normCat && normCat !== 'all' && normCat !== 'todas');
  if (isCategoryFilter) {
    const displayCat = resolveCategoryDisplayName(normCat);
    const aliasSlugs = getCategoryAliasSlugs(normCat);
    const aliasSet = new Set(aliasSlugs);
    const catCacheUrl = `https://edge-cache.${siteDomain}/${EDGE_CACHE_VERSION}/cat-${encodeURIComponent(normCat)}`;
    const existingCat = await readShardCache(cache, catCacheUrl);
    const matchesFromShards = pool.filter((item) => {
      const cNorm = normalizeCategoryText(item.category || item.categoryId);
      return aliasSet.has(cNorm);
    });
    let catItems = mergeAndPrunePool(matchesFromShards, existingCat?.items || [], MAX_PER_SHARD_ITEMS);

    const catNeedsFetch =
      !cache ||
      refresh ||
      !existingCat ||
      Date.now() - existingCat.updatedAt > SHARD_FRESH_TTL_MS ||
      catItems.length < limit;

    if (catNeedsFetch) {
      const matchingSources = Object.entries(SOURCE_CATEGORY_MAP)
        .filter(([, cat]) => aliasSet.has(normalizeCategoryText(cat)))
        .map(([id]) => id);
      const catCatalog = await fetchUpstreamJson(env, `/api/news?category=${encodeURIComponent(displayCat)}&active=true&limit=50`);
      const collected = [];
      const seenSlugs = new Set();
      const discovered = ingestUpstreamPayload(catCatalog, displayCat, '', collected, seenSlugs);
      const sourceIds = Array.from(new Set([...discovered.map((d) => d.id), ...matchingSources])).slice(0, 12);
      const results = await Promise.all([
        fetchUpstreamJson(env, `/api/news/category/${encodeURIComponent(normCat)}?limit=250`),
        ...sourceIds.map((id) => fetchUpstreamJson(env, `/api/news/${encodeURIComponent(id)}?limit=250`)),
      ]);
      results.forEach((res, idx) => {
        const sid = idx === 0 ? '' : sourceIds[idx - 1];
        ingestUpstreamPayload(res, displayCat, sid, collected, seenSlugs);
      });
      const nextCat = cache ? collected.map(toShardIndexItem) : collected;
      catItems = mergeAndPrunePool(nextCat, catItems, MAX_PER_SHARD_ITEMS);
      await writeShardCache(cache, catCacheUrl, catItems);
    }

    // Fallback por palavras-chave e acervo nacional para garantir zero editorias vazias
    if (catItems.length < 6 && pool.length > 0) {
      const kws = getCategoryKeywords(normCat);
      const seen = new Set(catItems.map((i) => i.slug));
      const kwMatches = pool.filter((it) => {
        if (seen.has(it.slug)) return false;
        const hay = `${it.title || ''} ${it.summary || ''} ${it.category || ''}`.toLowerCase();
        return kws.some((k) => hay.includes(k));
      });
      if (kwMatches.length > 0) {
        catItems = mergeAndPrunePool(catItems, kwMatches.slice(0, 24), MAX_PER_SHARD_ITEMS);
      }
      if (catItems.length === 0) {
        catItems = pool.slice(0, Math.max(limit, 12));
      }
    }

    pool = catItems;
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

  const hydratedShards = cache ? shardRecords.filter((r) => r && r.items && r.items.length > 0).length : 1;
  const pendingShards = Math.max(0, totalShards - hydratedShards);
  const total = filtered.length;
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 20000);
  const offset = (safePage - 1) * safeLimit;
  const items = filtered.slice(offset, offset + safeLimit);

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    hydration: {
      hydratedShards,
      totalShards,
      pendingShards,
      activeSourcesCount: DEFAULT_SOURCE_IDS.length,
    },
  };
}

function refreshContentHtmlImages(html = '', featuredImage = '') {
  if (!html) return '';
  return formatArticleParagraphsHtml(
    String(html).replace(/<img\b([^>]*)>/gi, (full, attrs) => {
      const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
      if (!srcMatch || !srcMatch[1]) return full;
      const upgraded = upgradeImageResolution(srcMatch[1]);
      if (!upgraded || upgraded === srcMatch[1]) return full;
      return full.replace(srcMatch[0], `src="${escapeHtml(upgraded)}"`);
    }) || (featuredImage ? `<p>${escapeHtml(featuredImage)}</p>` : '')
  );
}

function isArticleBodyComplete(html = '') {
  const plainLen = stripHtmlTags(html).length;
  const pCount = (String(html).match(/<p\b/gi) || []).length;
  return plainLen >= 450 && pCount > 1;
}

async function enrichAndCacheArticle(article, cache, articleCacheUrl) {
  if (!article) return null;
  let enriched = normalizeCachedItemImages(article);
  enriched.contentHtml = refreshContentHtmlImages(enriched.contentHtml || '', enriched.imageUrl);

  if (!isArticleBodyComplete(enriched.contentHtml) && enriched.sourceUrl) {
    const extracted = await fetchFullArticleBodyForWorker(enriched.sourceUrl, 50000);
    if (stripHtmlTags(extracted).length > stripHtmlTags(enriched.contentHtml).length + 80) {
      enriched = {
        ...enriched,
        contentHtml: sanitizeArticleHtmlForWorker(extracted, enriched.imageUrl),
      };
    }
  }

  if (cache && enriched.title) {
    try {
      await cache.put(
        articleCacheUrl,
        new Response(JSON.stringify(enriched), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
        })
      );
    } catch {}
  }
  return enriched;
}

async function findArticleBySlug(env, slug) {
  if (!slug) return null;
  const decoded = decodeURIComponent(slug).toLowerCase().trim();
  const { domain: siteDomain } = resolveWorkerSiteConfig(env);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const articleCacheUrl = `https://edge-cache.${siteDomain}/${EDGE_CACHE_VERSION}/article/${encodeURIComponent(decoded)}`;

  if (cache) {
    try {
      const hit = await cache.match(articleCacheUrl);
      if (hit) {
        const cachedArticle = await hit.json();
        if (cachedArticle && cachedArticle.title) {
          if (isArticleBodyComplete(cachedArticle.contentHtml) || !cachedArticle.sourceUrl) {
            const normalized = normalizeCachedItemImages(cachedArticle);
            normalized.contentHtml = refreshContentHtmlImages(normalized.contentHtml || '', normalized.imageUrl);
            return normalized;
          }
          return await enrichAndCacheArticle(cachedArticle, cache, articleCacheUrl);
        }
      }
    } catch {}
  }

  const { items } = await fetchAggregatedNews(env, { category: 'all', limit: 20000, page: 1 });
  const match = items.find((i) => i.slug.toLowerCase() === decoded || i.id.toLowerCase() === decoded);

  if (match && isArticleBodyComplete(match.contentHtml)) {
    return await enrichAndCacheArticle(match, cache, articleCacheUrl);
  }

  if (match && match.sourceId) {
    for (const pg of [1, 2]) {
      const srcRes = await fetchUpstreamJson(env, `/api/news/${encodeURIComponent(match.sourceId)}?limit=250&page=${pg}`);
      const arr = Array.isArray(srcRes?.items) ? srcRes.items : Array.isArray(srcRes) ? srcRes : [];
      for (const raw of arr) {
        const norm = normalizeUpstreamItem(raw, match.category, match.sourceId);
        if (norm && (norm.slug.toLowerCase() === decoded || norm.id.toLowerCase() === decoded)) {
          return await enrichAndCacheArticle(norm, cache, articleCacheUrl);
        }
      }
      if (arr.length < 50) break;
    }
  }

  const queryText = match
    ? match.title.split(/\s+/).slice(0, 6).join(' ')
    : decoded.split('-').slice(0, 6).join(' ');
  const direct = await fetchUpstreamJson(env, `/api/news?q=${encodeURIComponent(queryText)}&limit=30`);
  const arr = Array.isArray(direct?.items) ? direct.items : Array.isArray(direct) ? direct : [];
  for (const raw of arr) {
    const norm = normalizeUpstreamItem(raw, match?.category || 'Brasil', match?.sourceId || '');
    if (norm && (norm.slug.toLowerCase() === decoded || decoded.includes(norm.slug.slice(0, 40)))) {
      return await enrichAndCacheArticle(norm, cache, articleCacheUrl);
    }
  }

  if (match) {
    if (match.sourceUrl) {
      return await enrichAndCacheArticle(match, cache, articleCacheUrl);
    }
    return {
      ...match,
      contentHtml: formatArticleParagraphsHtml(
        match.contentHtml ||
          `<p>${escapeHtml(match.summary)}</p><p>Reportagem publicada na editoria de <strong>${escapeHtml(match.category)}</strong>. Consulte os destaques e pontos principais acima para acompanhar o conteúdo consolidado pela redação do Norma Jurídica.</p>`
      ),
    };
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
export function renderWorkerSitemapHtml({ title, description, entries = [], type = 'index', totalCount }) {
  const listedTotal = typeof totalCount === 'number' ? totalCount : entries.length;
  const visibleEntries = entries.length > 1500 ? entries.slice(0, 1500) : entries;
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
          ${visibleEntries
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
      <div>Total de URLs listadas: <strong>${listedTotal}</strong></div>
      <div>${SITE_INFO.name} • Sistema Oficial de Distribuição XML</div>
    </div>
  </div>
</body>
</html>`;
}

const WORKER_COMPILED_CSS = "/*! tailwindcss v4.1.11 | MIT License | https://tailwindcss.com */\n@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-translate-x:0;--tw-translate-y:0;--tw-translate-z:0;--tw-scale-x:1;--tw-scale-y:1;--tw-scale-z:1;--tw-space-y-reverse:0;--tw-border-style:solid;--tw-gradient-position:initial;--tw-gradient-from:#0000;--tw-gradient-via:#0000;--tw-gradient-to:#0000;--tw-gradient-stops:initial;--tw-gradient-via-stops:initial;--tw-gradient-from-position:0%;--tw-gradient-via-position:50%;--tw-gradient-to-position:100%;--tw-leading:initial;--tw-font-weight:initial;--tw-tracking:initial;--tw-shadow:0 0 #0000;--tw-shadow-color:initial;--tw-shadow-alpha:100%;--tw-inset-shadow:0 0 #0000;--tw-inset-shadow-color:initial;--tw-inset-shadow-alpha:100%;--tw-ring-color:initial;--tw-ring-shadow:0 0 #0000;--tw-inset-ring-color:initial;--tw-inset-ring-shadow:0 0 #0000;--tw-ring-inset:initial;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-offset-shadow:0 0 #0000;--tw-blur:initial;--tw-brightness:initial;--tw-contrast:initial;--tw-grayscale:initial;--tw-hue-rotate:initial;--tw-invert:initial;--tw-opacity:initial;--tw-saturate:initial;--tw-sepia:initial;--tw-drop-shadow:initial;--tw-drop-shadow-color:initial;--tw-drop-shadow-alpha:100%;--tw-drop-shadow-size:initial;--tw-backdrop-blur:initial;--tw-backdrop-brightness:initial;--tw-backdrop-contrast:initial;--tw-backdrop-grayscale:initial;--tw-backdrop-hue-rotate:initial;--tw-backdrop-invert:initial;--tw-backdrop-opacity:initial;--tw-backdrop-saturate:initial;--tw-backdrop-sepia:initial;--tw-duration:initial;--tw-ease:initial}}}@layer theme{:root,:host{--font-sans:\"Inter\",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;--font-serif:\"Source Serif 4\",ui-serif,Georgia,Cambria,\"Times New Roman\",Times,serif;--font-mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace;--color-red-600:oklch(57.7% .245 27.325);--color-orange-600:oklch(64.6% .222 41.116);--color-amber-50:oklch(98.7% .022 95.277);--color-amber-300:oklch(87.9% .169 91.605);--color-amber-400:oklch(82.8% .189 84.429);--color-amber-500:oklch(76.9% .188 70.08);--color-amber-600:oklch(66.6% .179 58.318);--color-emerald-50:oklch(97.9% .021 166.113);--color-emerald-100:oklch(95% .052 163.051);--color-emerald-200:oklch(90.5% .093 164.15);--color-emerald-400:oklch(76.5% .177 163.223);--color-emerald-600:oklch(59.6% .145 163.225);--color-emerald-800:oklch(43.2% .095 166.913);--color-emerald-950:oklch(26.2% .051 172.552);--color-sky-400:oklch(74.6% .16 232.661);--color-sky-700:oklch(50% .134 242.749);--color-blue-50:oklch(97% .014 254.604);--color-blue-600:oklch(54.6% .245 262.881);--color-blue-900:oklch(37.9% .146 265.522);--color-indigo-700:oklch(45.7% .24 277.023);--color-indigo-900:oklch(35.9% .144 278.697);--color-indigo-950:oklch(25.7% .09 281.288);--color-purple-800:oklch(43.8% .218 303.724);--color-rose-50:oklch(96.9% .015 12.422);--color-rose-200:oklch(89.2% .058 10.001);--color-rose-300:oklch(81% .117 11.638);--color-rose-700:oklch(51.4% .222 16.935);--color-rose-900:oklch(41% .159 10.272);--color-rose-950:oklch(27.1% .105 12.094);--color-slate-50:oklch(98.4% .003 247.858);--color-slate-100:oklch(96.8% .007 247.896);--color-slate-200:oklch(92.9% .013 255.508);--color-slate-300:oklch(86.9% .022 252.894);--color-slate-400:oklch(70.4% .04 256.788);--color-slate-500:oklch(55.4% .046 257.417);--color-slate-600:oklch(44.6% .043 257.281);--color-slate-700:oklch(37.2% .044 257.287);--color-slate-800:oklch(27.9% .041 260.031);--color-slate-900:oklch(20.8% .042 265.755);--color-slate-950:oklch(12.9% .042 264.695);--color-zinc-50:oklch(98.5% 0 0);--color-zinc-100:oklch(96.7% .001 286.375);--color-zinc-200:oklch(92% .004 286.32);--color-zinc-300:oklch(87.1% .006 286.286);--color-zinc-400:oklch(70.5% .015 286.067);--color-zinc-500:oklch(55.2% .016 285.938);--color-zinc-600:oklch(44.2% .017 285.786);--color-zinc-700:oklch(37% .013 285.805);--color-zinc-800:oklch(27.4% .006 286.033);--color-zinc-900:oklch(21% .006 285.885);--color-zinc-950:oklch(14.1% .005 285.823);--color-black:#000;--color-white:#fff;--spacing:.25rem;--container-sm:24rem;--container-md:28rem;--container-lg:32rem;--container-2xl:42rem;--container-3xl:48rem;--container-4xl:56rem;--container-5xl:64rem;--container-7xl:80rem;--text-xs:.75rem;--text-xs--line-height:calc(1/.75);--text-sm:.875rem;--text-sm--line-height:calc(1.25/.875);--text-base:1rem;--text-base--line-height:calc(1.5/1);--text-lg:1.125rem;--text-lg--line-height:calc(1.75/1.125);--text-xl:1.25rem;--text-xl--line-height:calc(1.75/1.25);--text-2xl:1.5rem;--text-2xl--line-height:calc(2/1.5);--text-3xl:1.875rem;--text-3xl--line-height:calc(2.25/1.875);--text-4xl:2.25rem;--text-4xl--line-height:calc(2.5/2.25);--text-5xl:3rem;--text-5xl--line-height:1;--font-weight-normal:400;--font-weight-medium:500;--font-weight-semibold:600;--font-weight-bold:700;--font-weight-extrabold:800;--font-weight-black:900;--tracking-tighter:-.05em;--tracking-tight:-.025em;--tracking-wider:.05em;--tracking-widest:.1em;--leading-tight:1.25;--leading-snug:1.375;--leading-relaxed:1.625;--radius-md:.375rem;--radius-lg:.5rem;--radius-xl:.75rem;--radius-2xl:1rem;--radius-3xl:1.5rem;--ease-out:cubic-bezier(0,0,.2,1);--animate-pulse:pulse 2s cubic-bezier(.4,0,.6,1)infinite;--blur-xs:4px;--blur-sm:8px;--blur-md:12px;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4,0,.2,1);--default-font-family:var(--font-sans);--default-mono-font-family:var(--font-mono);--color-brand-50:#eff6ff;--color-brand-100:#dbeafe;--color-brand-200:#bfdbfe;--color-brand-300:#93c5fd;--color-brand-400:#60a5fa;--color-brand-500:#3b82f6;--color-brand-600:#2563eb;--color-brand-700:#1d4ed8;--color-brand-800:#1e40af;--color-brand-900:#1e3a8a;--color-brand-950:#172554}}@layer base{*,:after,:before,::backdrop,::file-selector-button{box-sizing:border-box;border:0 solid;margin:0;padding:0}html,:host{-webkit-text-size-adjust:100%;tab-size:4;line-height:1.5;font-family:var(--default-font-family,ui-sans-serif,system-ui,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",\"Segoe UI Symbol\",\"Noto Color Emoji\");font-feature-settings:var(--default-font-feature-settings,normal);font-variation-settings:var(--default-font-variation-settings,normal);-webkit-tap-highlight-color:transparent}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;-webkit-text-decoration:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,samp,pre{font-family:var(--default-mono-font-family,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace);font-feature-settings:var(--default-mono-font-feature-settings,normal);font-variation-settings:var(--default-mono-font-variation-settings,normal);font-size:1em}small{font-size:80%}sub,sup{vertical-align:baseline;font-size:75%;line-height:0;position:relative}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}:-moz-focusring{outline:auto}progress{vertical-align:baseline}summary{display:list-item}ol,ul,menu{list-style:none}img,svg,video,canvas,audio,iframe,embed,object{vertical-align:middle;display:block}img,video{max-width:100%;height:auto}button,input,select,optgroup,textarea,::file-selector-button{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;opacity:1;background-color:#0000;border-radius:0}:where(select:is([multiple],[size])) optgroup{font-weight:bolder}:where(select:is([multiple],[size])) optgroup option{padding-inline-start:20px}::file-selector-button{margin-inline-end:4px}::placeholder{opacity:1}@supports (not ((-webkit-appearance:-apple-pay-button))) or (contain-intrinsic-size:1px){::placeholder{color:currentColor;@supports (color:color-mix(in lab, red, red)){color:color-mix(in oklab,currentcolor 50%,transparent)}}}textarea{resize:vertical}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-date-and-time-value{min-height:1lh;text-align:inherit}::-webkit-datetime-edit{display:inline-flex}::-webkit-datetime-edit-fields-wrapper{padding:0}::-webkit-datetime-edit,::-webkit-datetime-edit-year-field,::-webkit-datetime-edit-month-field,::-webkit-datetime-edit-day-field,::-webkit-datetime-edit-hour-field,::-webkit-datetime-edit-minute-field,::-webkit-datetime-edit-second-field,::-webkit-datetime-edit-millisecond-field,::-webkit-datetime-edit-meridiem-field{padding-block:0}:-moz-ui-invalid{box-shadow:none}button,input:where([type=button],[type=reset],[type=submit]),::file-selector-button{appearance:button}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[hidden]:where(:not([hidden=until-found])){display:none!important}}@layer components;@layer utilities{.pointer-events-auto{pointer-events:auto}.pointer-events-none{pointer-events:none}.sr-only{clip:rect(0,0,0,0);white-space:nowrap;border-width:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.absolute{position:absolute}.fixed{position:fixed}.relative{position:relative}.sticky{position:sticky}.inset-0{inset:calc(var(--spacing)*0)}.top-0{top:calc(var(--spacing)*0)}.top-1\\/2{top:50%}.top-2\\.5{top:calc(var(--spacing)*2.5)}.top-4{top:calc(var(--spacing)*4)}.top-20{top:calc(var(--spacing)*20)}.top-full{top:100%}.right-0{right:calc(var(--spacing)*0)}.right-2{right:calc(var(--spacing)*2)}.right-2\\.5{right:calc(var(--spacing)*2.5)}.right-6{right:calc(var(--spacing)*6)}.bottom-0{bottom:calc(var(--spacing)*0)}.bottom-6{bottom:calc(var(--spacing)*6)}.left-0{left:calc(var(--spacing)*0)}.left-2{left:calc(var(--spacing)*2)}.left-3{left:calc(var(--spacing)*3)}.left-4{left:calc(var(--spacing)*4)}.z-0{z-index:0}.z-10{z-index:10}.z-20{z-index:20}.z-40{z-index:40}.z-50{z-index:50}.container{width:100%;@media (width>=40rem){max-width:40rem}@media (width>=48rem){max-width:48rem}@media (width>=64rem){max-width:64rem}@media (width>=80rem){max-width:80rem}@media (width>=96rem){max-width:96rem}}.mx-auto{margin-inline:auto}.my-4{margin-block:calc(var(--spacing)*4)}.my-6{margin-block:calc(var(--spacing)*6)}.my-8{margin-block:calc(var(--spacing)*8)}.mt-0\\.5{margin-top:calc(var(--spacing)*.5)}.mt-1{margin-top:calc(var(--spacing)*1)}.mt-2{margin-top:calc(var(--spacing)*2)}.mt-3{margin-top:calc(var(--spacing)*3)}.mt-4{margin-top:calc(var(--spacing)*4)}.mt-8{margin-top:calc(var(--spacing)*8)}.mt-12{margin-top:calc(var(--spacing)*12)}.mt-16{margin-top:calc(var(--spacing)*16)}.mr-1{margin-right:calc(var(--spacing)*1)}.mb-0\\.5{margin-bottom:calc(var(--spacing)*.5)}.mb-1{margin-bottom:calc(var(--spacing)*1)}.mb-1\\.5{margin-bottom:calc(var(--spacing)*1.5)}.mb-2{margin-bottom:calc(var(--spacing)*2)}.mb-2\\.5{margin-bottom:calc(var(--spacing)*2.5)}.mb-3{margin-bottom:calc(var(--spacing)*3)}.mb-3\\.5{margin-bottom:calc(var(--spacing)*3.5)}.mb-4{margin-bottom:calc(var(--spacing)*4)}.mb-6{margin-bottom:calc(var(--spacing)*6)}.mb-8{margin-bottom:calc(var(--spacing)*8)}.mb-10{margin-bottom:calc(var(--spacing)*10)}.mb-12{margin-bottom:calc(var(--spacing)*12)}.ml-2{margin-left:calc(var(--spacing)*2)}.ml-4{margin-left:calc(var(--spacing)*4)}.line-clamp-1{-webkit-line-clamp:1;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.line-clamp-2{-webkit-line-clamp:2;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.line-clamp-3{-webkit-line-clamp:3;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.block{display:block}.flex{display:flex}.grid{display:grid}.hidden{display:none}.inline-flex{display:inline-flex}.aspect-\\[16\\/9\\]{aspect-ratio:16/9}.h-0\\.5{height:calc(var(--spacing)*.5)}.h-1{height:calc(var(--spacing)*1)}.h-3{height:calc(var(--spacing)*3)}.h-3\\.5{height:calc(var(--spacing)*3.5)}.h-4{height:calc(var(--spacing)*4)}.h-5{height:calc(var(--spacing)*5)}.h-6{height:calc(var(--spacing)*6)}.h-7{height:calc(var(--spacing)*7)}.h-8{height:calc(var(--spacing)*8)}.h-9{height:calc(var(--spacing)*9)}.h-10{height:calc(var(--spacing)*10)}.h-12{height:calc(var(--spacing)*12)}.h-14{height:calc(var(--spacing)*14)}.h-16{height:calc(var(--spacing)*16)}.h-20{height:calc(var(--spacing)*20)}.h-\\[1px\\]{height:1px}.h-auto{height:auto}.h-full{height:100%}.max-h-\\[75vh\\]{max-height:75vh}.max-h-\\[85vh\\]{max-height:85vh}.max-h-\\[540px\\]{max-height:540px}.min-h-\\[90px\\]{min-height:90px}.min-h-screen{min-height:100vh}.w-1\\.5{width:calc(var(--spacing)*1.5)}.w-3{width:calc(var(--spacing)*3)}.w-3\\.5{width:calc(var(--spacing)*3.5)}.w-4{width:calc(var(--spacing)*4)}.w-5{width:calc(var(--spacing)*5)}.w-6{width:calc(var(--spacing)*6)}.w-7{width:calc(var(--spacing)*7)}.w-8{width:calc(var(--spacing)*8)}.w-9{width:calc(var(--spacing)*9)}.w-10{width:calc(var(--spacing)*10)}.w-12{width:calc(var(--spacing)*12)}.w-14{width:calc(var(--spacing)*14)}.w-16{width:calc(var(--spacing)*16)}.w-28{width:calc(var(--spacing)*28)}.w-\\[340px\\]{width:340px}.w-full{width:100%}.max-w-2xl{max-width:var(--container-2xl)}.max-w-3xl{max-width:var(--container-3xl)}.max-w-4xl{max-width:var(--container-4xl)}.max-w-5xl{max-width:var(--container-5xl)}.max-w-7xl{max-width:var(--container-7xl)}.max-w-\\[150px\\]{max-width:150px}.max-w-\\[320px\\]{max-width:320px}.max-w-lg{max-width:var(--container-lg)}.max-w-md{max-width:var(--container-md)}.max-w-none{max-width:none}.max-w-sm{max-width:var(--container-sm)}.min-w-0{min-width:calc(var(--spacing)*0)}.min-w-\\[18px\\]{min-width:18px}.flex-1{flex:1}.flex-shrink-0{flex-shrink:0}.origin-left{transform-origin:0}.-translate-y-1\\/2{--tw-translate-y:calc(calc(1/2*100%)*-1);translate:var(--tw-translate-x)var(--tw-translate-y)}.scale-95{--tw-scale-x:95%;--tw-scale-y:95%;--tw-scale-z:95%;scale:var(--tw-scale-x)var(--tw-scale-y)}.scale-100{--tw-scale-x:100%;--tw-scale-y:100%;--tw-scale-z:100%;scale:var(--tw-scale-x)var(--tw-scale-y)}.animate-pulse{animation:var(--animate-pulse)}.cursor-pointer{cursor:pointer}.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.items-baseline{align-items:baseline}.items-center{align-items:center}.items-start{align-items:flex-start}.items-stretch{align-items:stretch}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.justify-end{justify-content:flex-end}.gap-0\\.5{gap:calc(var(--spacing)*.5)}.gap-1{gap:calc(var(--spacing)*1)}.gap-1\\.5{gap:calc(var(--spacing)*1.5)}.gap-2{gap:calc(var(--spacing)*2)}.gap-2\\.5{gap:calc(var(--spacing)*2.5)}.gap-3{gap:calc(var(--spacing)*3)}.gap-3\\.5{gap:calc(var(--spacing)*3.5)}.gap-4{gap:calc(var(--spacing)*4)}.gap-5{gap:calc(var(--spacing)*5)}.gap-6{gap:calc(var(--spacing)*6)}.gap-8{gap:calc(var(--spacing)*8)}.space-y-1{:where(&>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing)*1)*var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing)*1)*calc(1 - var(--tw-space-y-reverse)))}}.space-y-1\\.5{:where(&>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing)*1.5)*var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing)*1.5)*calc(1 - var(--tw-space-y-reverse)))}}.space-y-2{:where(&>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing)*2)*var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing)*2)*calc(1 - var(--tw-space-y-reverse)))}}.space-y-3{:where(&>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing)*3)*var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing)*3)*calc(1 - var(--tw-space-y-reverse)))}}.space-y-4{:where(&>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing)*4)*var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing)*4)*calc(1 - var(--tw-space-y-reverse)))}}.space-y-5{:where(&>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing)*5)*var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing)*5)*calc(1 - var(--tw-space-y-reverse)))}}.space-y-6{:where(&>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing)*6)*var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing)*6)*calc(1 - var(--tw-space-y-reverse)))}}.space-y-8{:where(&>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing)*8)*var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing)*8)*calc(1 - var(--tw-space-y-reverse)))}}.space-y-10{:where(&>:not(:last-child)){--tw-space-y-reverse:0;margin-block-start:calc(calc(var(--spacing)*10)*var(--tw-space-y-reverse));margin-block-end:calc(calc(var(--spacing)*10)*calc(1 - var(--tw-space-y-reverse)))}}.self-end{align-self:flex-end}.truncate{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.overflow-hidden{overflow:hidden}.overflow-y-auto{overflow-y:auto}.rounded{border-radius:.25rem}.rounded-2xl{border-radius:var(--radius-2xl)}.rounded-3xl{border-radius:var(--radius-3xl)}.rounded-full{border-radius:3.40282e38px}.rounded-lg{border-radius:var(--radius-lg)}.rounded-md{border-radius:var(--radius-md)}.rounded-xl{border-radius:var(--radius-xl)}.border{border-style:var(--tw-border-style);border-width:1px}.border-y{border-block-style:var(--tw-border-style);border-block-width:1px}.border-t{border-top-style:var(--tw-border-style);border-top-width:1px}.border-b{border-bottom-style:var(--tw-border-style);border-bottom-width:1px}.border-l{border-left-style:var(--tw-border-style);border-left-width:1px}.border-l-4{border-left-style:var(--tw-border-style);border-left-width:4px}.border-amber-300\\/40{border-color:#ffd23666;@supports (color:color-mix(in lab, red, red)){border-color:color-mix(in oklab,var(--color-amber-300)40%,transparent)}}.border-brand-200{border-color:var(--color-brand-200)}.border-brand-700{border-color:var(--color-brand-700)}.border-brand-900\\/60{border-color:#1e3a8a99;@supports (color:color-mix(in lab, red, red)){border-color:color-mix(in oklab,var(--color-brand-900)60%,transparent)}}.border-emerald-200{border-color:var(--color-emerald-200)}.border-rose-200{border-color:var(--color-rose-200)}.border-slate-100{border-color:var(--color-slate-100)}.border-slate-200{border-color:var(--color-slate-200)}.border-slate-300{border-color:var(--color-slate-300)}.border-slate-700\\/60{border-color:#31415899;@supports (color:color-mix(in lab, red, red)){border-color:color-mix(in oklab,var(--color-slate-700)60%,transparent)}}.border-slate-800{border-color:var(--color-slate-800)}.border-white\\/10{border-color:#ffffff1a;@supports (color:color-mix(in lab, red, red)){border-color:color-mix(in oklab,var(--color-white)10%,transparent)}}.border-white\\/20{border-color:#fff3;@supports (color:color-mix(in lab, red, red)){border-color:color-mix(in oklab,var(--color-white)20%,transparent)}}.border-zinc-800{border-color:var(--color-zinc-800)}.border-zinc-800\\/80{border-color:#27272acc;@supports (color:color-mix(in lab, red, red)){border-color:color-mix(in oklab,var(--color-zinc-800)80%,transparent)}}.bg-\\[\\#25D366\\]{background-color:#25d366}.bg-\\[\\#1877F2\\]{background-color:#1877f2}.bg-amber-500{background-color:var(--color-amber-500)}.bg-amber-500\\/25{background-color:#f99c0040;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-amber-500)25%,transparent)}}.bg-black{background-color:var(--color-black)}.bg-black\\/40{background-color:#0006;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-black)40%,transparent)}}.bg-black\\/60{background-color:#0009;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-black)60%,transparent)}}.bg-brand-50{background-color:var(--color-brand-50)}.bg-brand-50\\/70{background-color:#eff6ffb3;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-brand-50)70%,transparent)}}.bg-brand-100{background-color:var(--color-brand-100)}.bg-brand-700{background-color:var(--color-brand-700)}.bg-brand-800{background-color:var(--color-brand-800)}.bg-brand-900\\/80{background-color:#1e3a8acc;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-brand-900)80%,transparent)}}.bg-brand-950{background-color:var(--color-brand-950)}.bg-emerald-50{background-color:var(--color-emerald-50)}.bg-emerald-100{background-color:var(--color-emerald-100)}.bg-emerald-600{background-color:var(--color-emerald-600)}.bg-orange-600{background-color:var(--color-orange-600)}.bg-red-600{background-color:var(--color-red-600)}.bg-rose-50{background-color:var(--color-rose-50)}.bg-rose-700{background-color:var(--color-rose-700)}.bg-slate-50{background-color:var(--color-slate-50)}.bg-slate-50\\/50{background-color:#f8fafc80;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-slate-50)50%,transparent)}}.bg-slate-100{background-color:var(--color-slate-100)}.bg-slate-200{background-color:var(--color-slate-200)}.bg-slate-200\\/80{background-color:#e2e8f0cc;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-slate-200)80%,transparent)}}.bg-slate-800\\/80{background-color:#1d293dcc;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-slate-800)80%,transparent)}}.bg-slate-900{background-color:var(--color-slate-900)}.bg-white{background-color:var(--color-white)}.bg-white\\/20{background-color:#fff3;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-white)20%,transparent)}}.bg-white\\/95{background-color:#fffffff2;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-white)95%,transparent)}}.bg-zinc-900{background-color:var(--color-zinc-900)}.bg-zinc-950{background-color:var(--color-zinc-950)}.bg-gradient-to-br{--tw-gradient-position:to bottom right in oklab;background-image:linear-gradient(var(--tw-gradient-stops))}.bg-gradient-to-r{--tw-gradient-position:to right in oklab;background-image:linear-gradient(var(--tw-gradient-stops))}.bg-gradient-to-t{--tw-gradient-position:to top in oklab;background-image:linear-gradient(var(--tw-gradient-stops))}.bg-gradient-to-tr{--tw-gradient-position:to top right in oklab;background-image:linear-gradient(var(--tw-gradient-stops))}.from-\\[\\#f09433\\]{--tw-gradient-from:#f09433;--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.from-amber-500{--tw-gradient-from:var(--color-amber-500);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.from-blue-600{--tw-gradient-from:var(--color-blue-600);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.from-brand-50{--tw-gradient-from:var(--color-brand-50);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.from-brand-600{--tw-gradient-from:var(--color-brand-600);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.from-indigo-900{--tw-gradient-from:var(--color-indigo-900);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.from-purple-800{--tw-gradient-from:var(--color-purple-800);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.from-sky-700{--tw-gradient-from:var(--color-sky-700);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.from-slate-600{--tw-gradient-from:var(--color-slate-600);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.from-slate-950{--tw-gradient-from:var(--color-slate-950);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.from-slate-950\\/80{--tw-gradient-from:#020618cc;@supports (color:color-mix(in lab, red, red)){--tw-gradient-from:color-mix(in oklab,var(--color-slate-950)80%,transparent)}--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.via-\\[\\#dc2743\\]{--tw-gradient-via:#dc2743;--tw-gradient-via-stops:var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-via)var(--tw-gradient-via-position),var(--tw-gradient-to)var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-via-stops)}.via-brand-500{--tw-gradient-via:var(--color-brand-500);--tw-gradient-via-stops:var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-via)var(--tw-gradient-via-position),var(--tw-gradient-to)var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-via-stops)}.via-slate-950\\/60{--tw-gradient-via:#02061899;@supports (color:color-mix(in lab, red, red)){--tw-gradient-via:color-mix(in oklab,var(--color-slate-950)60%,transparent)}--tw-gradient-via-stops:var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-via)var(--tw-gradient-via-position),var(--tw-gradient-to)var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-via-stops)}.via-transparent{--tw-gradient-via:transparent;--tw-gradient-via-stops:var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-via)var(--tw-gradient-via-position),var(--tw-gradient-to)var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-via-stops)}.to-\\[\\#bc1888\\]{--tw-gradient-to:#bc1888;--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.to-blue-50\\/50{--tw-gradient-to:#eff6ff80;@supports (color:color-mix(in lab, red, red)){--tw-gradient-to:color-mix(in oklab,var(--color-blue-50)50%,transparent)}--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.to-blue-900{--tw-gradient-to:var(--color-blue-900);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.to-indigo-700{--tw-gradient-to:var(--color-indigo-700);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.to-indigo-950{--tw-gradient-to:var(--color-indigo-950);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.to-orange-600{--tw-gradient-to:var(--color-orange-600);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.to-sky-400{--tw-gradient-to:var(--color-sky-400);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.to-slate-800{--tw-gradient-to:var(--color-slate-800);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.to-transparent{--tw-gradient-to:transparent;--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.to-zinc-950{--tw-gradient-to:var(--color-zinc-950);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}.fill-amber-400{fill:var(--color-amber-400)}.fill-current{fill:currentColor}.object-cover{object-fit:cover}.p-1{padding:calc(var(--spacing)*1)}.p-1\\.5{padding:calc(var(--spacing)*1.5)}.p-2{padding:calc(var(--spacing)*2)}.p-2\\.5{padding:calc(var(--spacing)*2.5)}.p-3{padding:calc(var(--spacing)*3)}.p-3\\.5{padding:calc(var(--spacing)*3.5)}.p-4{padding:calc(var(--spacing)*4)}.p-5{padding:calc(var(--spacing)*5)}.p-6{padding:calc(var(--spacing)*6)}.p-8{padding:calc(var(--spacing)*8)}.px-1{padding-inline:calc(var(--spacing)*1)}.px-1\\.5{padding-inline:calc(var(--spacing)*1.5)}.px-2{padding-inline:calc(var(--spacing)*2)}.px-2\\.5{padding-inline:calc(var(--spacing)*2.5)}.px-3{padding-inline:calc(var(--spacing)*3)}.px-3\\.5{padding-inline:calc(var(--spacing)*3.5)}.px-4{padding-inline:calc(var(--spacing)*4)}.px-5{padding-inline:calc(var(--spacing)*5)}.py-0\\.5{padding-block:calc(var(--spacing)*.5)}.py-1{padding-block:calc(var(--spacing)*1)}.py-1\\.5{padding-block:calc(var(--spacing)*1.5)}.py-2{padding-block:calc(var(--spacing)*2)}.py-2\\.5{padding-block:calc(var(--spacing)*2.5)}.py-3{padding-block:calc(var(--spacing)*3)}.py-3\\.5{padding-block:calc(var(--spacing)*3.5)}.py-4{padding-block:calc(var(--spacing)*4)}.py-6{padding-block:calc(var(--spacing)*6)}.py-8{padding-block:calc(var(--spacing)*8)}.py-10{padding-block:calc(var(--spacing)*10)}.py-12{padding-block:calc(var(--spacing)*12)}.py-16{padding-block:calc(var(--spacing)*16)}.pt-0\\.5{padding-top:calc(var(--spacing)*.5)}.pt-1\\.5{padding-top:calc(var(--spacing)*1.5)}.pt-2{padding-top:calc(var(--spacing)*2)}.pt-3{padding-top:calc(var(--spacing)*3)}.pt-4{padding-top:calc(var(--spacing)*4)}.pt-6{padding-top:calc(var(--spacing)*6)}.pt-8{padding-top:calc(var(--spacing)*8)}.pr-4{padding-right:calc(var(--spacing)*4)}.pb-3{padding-bottom:calc(var(--spacing)*3)}.pb-4{padding-bottom:calc(var(--spacing)*4)}.pb-6{padding-bottom:calc(var(--spacing)*6)}.pl-2{padding-left:calc(var(--spacing)*2)}.pl-3{padding-left:calc(var(--spacing)*3)}.pl-4{padding-left:calc(var(--spacing)*4)}.pl-9{padding-left:calc(var(--spacing)*9)}.pl-11{padding-left:calc(var(--spacing)*11)}.text-center{text-align:center}.text-justify{text-align:justify}.text-left{text-align:left}.text-right{text-align:right}.font-mono{font-family:var(--font-mono)}.font-sans{font-family:var(--font-sans)}.font-serif{font-family:var(--font-serif)}.text-2xl{font-size:var(--text-2xl);line-height:var(--tw-leading,var(--text-2xl--line-height))}.text-3xl{font-size:var(--text-3xl);line-height:var(--tw-leading,var(--text-3xl--line-height))}.text-base{font-size:var(--text-base);line-height:var(--tw-leading,var(--text-base--line-height))}.text-lg{font-size:var(--text-lg);line-height:var(--tw-leading,var(--text-lg--line-height))}.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}.text-xl{font-size:var(--text-xl);line-height:var(--tw-leading,var(--text-xl--line-height))}.text-xs{font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}.text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}.leading-8{--tw-leading:calc(var(--spacing)*8);line-height:calc(var(--spacing)*8)}.leading-\\[1\\.12\\]{--tw-leading:1.12;line-height:1.12}.leading-none{--tw-leading:1;line-height:1}.leading-relaxed{--tw-leading:var(--leading-relaxed);line-height:var(--leading-relaxed)}.leading-snug{--tw-leading:var(--leading-snug);line-height:var(--leading-snug)}.leading-tight{--tw-leading:var(--leading-tight);line-height:var(--leading-tight)}.font-black{--tw-font-weight:var(--font-weight-black);font-weight:var(--font-weight-black)}.font-bold{--tw-font-weight:var(--font-weight-bold);font-weight:var(--font-weight-bold)}.font-extrabold{--tw-font-weight:var(--font-weight-extrabold);font-weight:var(--font-weight-extrabold)}.font-medium{--tw-font-weight:var(--font-weight-medium);font-weight:var(--font-weight-medium)}.font-normal{--tw-font-weight:var(--font-weight-normal);font-weight:var(--font-weight-normal)}.font-semibold{--tw-font-weight:var(--font-weight-semibold);font-weight:var(--font-weight-semibold)}.tracking-tight{--tw-tracking:var(--tracking-tight);letter-spacing:var(--tracking-tight)}.tracking-tighter{--tw-tracking:var(--tracking-tighter);letter-spacing:var(--tracking-tighter)}.tracking-wider{--tw-tracking:var(--tracking-wider);letter-spacing:var(--tracking-wider)}.tracking-widest{--tw-tracking:var(--tracking-widest);letter-spacing:var(--tracking-widest)}.hyphens-none{-webkit-hyphens:none;hyphens:none}.whitespace-nowrap{white-space:nowrap}.text-amber-50{color:var(--color-amber-50)}.text-amber-300{color:var(--color-amber-300)}.text-amber-400{color:var(--color-amber-400)}.text-amber-600{color:var(--color-amber-600)}.text-brand-300{color:var(--color-brand-300)}.text-brand-400{color:var(--color-brand-400)}.text-brand-600{color:var(--color-brand-600)}.text-brand-700{color:var(--color-brand-700)}.text-brand-800{color:var(--color-brand-800)}.text-brand-900{color:var(--color-brand-900)}.text-emerald-600{color:var(--color-emerald-600)}.text-rose-700{color:var(--color-rose-700)}.text-slate-100{color:var(--color-slate-100)}.text-slate-200{color:var(--color-slate-200)}.text-slate-300{color:var(--color-slate-300)}.text-slate-400{color:var(--color-slate-400)}.text-slate-500{color:var(--color-slate-500)}.text-slate-600{color:var(--color-slate-600)}.text-slate-700{color:var(--color-slate-700)}.text-slate-800{color:var(--color-slate-800)}.text-slate-900{color:var(--color-slate-900)}.text-white{color:var(--color-white)}.text-white\\/75{color:#ffffffbf;@supports (color:color-mix(in lab, red, red)){color:color-mix(in oklab,var(--color-white)75%,transparent)}}.text-white\\/90{color:#ffffffe6;@supports (color:color-mix(in lab, red, red)){color:color-mix(in oklab,var(--color-white)90%,transparent)}}.text-zinc-600{color:var(--color-zinc-600)}.text-zinc-700{color:var(--color-zinc-700)}.capitalize{text-transform:capitalize}.uppercase{text-transform:uppercase}.italic{font-style:italic}.underline{text-decoration-line:underline}.decoration-white\\/40{text-decoration-color:#fff6;@supports (color:color-mix(in lab, red, red)){text-decoration-color:color-mix(in oklab,var(--color-white)40%,transparent)}}.antialiased{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}.opacity-0{opacity:0}.opacity-90{opacity:.9}.opacity-100{opacity:1}.shadow-2xl{--tw-shadow:0 25px 50px -12px var(--tw-shadow-color,#00000040);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-inner{--tw-shadow:inset 0 2px 4px 0 var(--tw-shadow-color,#0000000d);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-lg{--tw-shadow:0 10px 15px -3px var(--tw-shadow-color,#0000001a),0 4px 6px -4px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-md{--tw-shadow:0 4px 6px -1px var(--tw-shadow-color,#0000001a),0 2px 4px -2px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-sm{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a),0 1px 2px -1px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-xl{--tw-shadow:0 20px 25px -5px var(--tw-shadow-color,#0000001a),0 8px 10px -6px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.shadow-xs{--tw-shadow:0 1px 2px 0 var(--tw-shadow-color,#0000000d);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.ring-1{--tw-ring-shadow:var(--tw-ring-inset,)0 0 0 calc(1px + var(--tw-ring-offset-width))var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.ring-4{--tw-ring-shadow:var(--tw-ring-inset,)0 0 0 calc(4px + var(--tw-ring-offset-width))var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}.ring-brand-100{--tw-ring-color:var(--color-brand-100)}.ring-brand-200{--tw-ring-color:var(--color-brand-200)}.ring-brand-500{--tw-ring-color:var(--color-brand-500)}.drop-shadow{--tw-drop-shadow-size:drop-shadow(0 1px 2px var(--tw-drop-shadow-color,#0000001a))drop-shadow(0 1px 1px var(--tw-drop-shadow-color,#0000000f));--tw-drop-shadow:drop-shadow(0 1px 2px #0000001a)drop-shadow(0 1px 1px #0000000f);filter:var(--tw-blur,)var(--tw-brightness,)var(--tw-contrast,)var(--tw-grayscale,)var(--tw-hue-rotate,)var(--tw-invert,)var(--tw-saturate,)var(--tw-sepia,)var(--tw-drop-shadow,)}.backdrop-blur-md{--tw-backdrop-blur:blur(var(--blur-md));backdrop-filter:var(--tw-backdrop-blur,)var(--tw-backdrop-brightness,)var(--tw-backdrop-contrast,)var(--tw-backdrop-grayscale,)var(--tw-backdrop-hue-rotate,)var(--tw-backdrop-invert,)var(--tw-backdrop-opacity,)var(--tw-backdrop-saturate,)var(--tw-backdrop-sepia,)}.backdrop-blur-sm{--tw-backdrop-blur:blur(var(--blur-sm));backdrop-filter:var(--tw-backdrop-blur,)var(--tw-backdrop-brightness,)var(--tw-backdrop-contrast,)var(--tw-backdrop-grayscale,)var(--tw-backdrop-hue-rotate,)var(--tw-backdrop-invert,)var(--tw-backdrop-opacity,)var(--tw-backdrop-saturate,)var(--tw-backdrop-sepia,)}.backdrop-blur-xs{--tw-backdrop-blur:blur(var(--blur-xs));backdrop-filter:var(--tw-backdrop-blur,)var(--tw-backdrop-brightness,)var(--tw-backdrop-contrast,)var(--tw-backdrop-grayscale,)var(--tw-backdrop-hue-rotate,)var(--tw-backdrop-invert,)var(--tw-backdrop-opacity,)var(--tw-backdrop-saturate,)var(--tw-backdrop-sepia,)}.transition-all{transition-property:all;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-colors{transition-property:color,background-color,border-color,outline-color,text-decoration-color,fill,stroke,--tw-gradient-from,--tw-gradient-via,--tw-gradient-to;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-opacity{transition-property:opacity;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.transition-transform{transition-property:transform,translate,scale,rotate;transition-timing-function:var(--tw-ease,var(--default-transition-timing-function));transition-duration:var(--tw-duration,var(--default-transition-duration))}.duration-200{--tw-duration:.2s;transition-duration:.2s}.duration-300{--tw-duration:.3s;transition-duration:.3s}.duration-500{--tw-duration:.5s;transition-duration:.5s}.duration-700{--tw-duration:.7s;transition-duration:.7s}.ease-out{--tw-ease:var(--ease-out);transition-timing-function:var(--ease-out)}.select-none{-webkit-user-select:none;user-select:none}.group-hover\\:translate-x-1{&:is(:where(.group):hover *){@media (hover:hover){--tw-translate-x:calc(var(--spacing)*1);translate:var(--tw-translate-x)var(--tw-translate-y)}}}.group-hover\\:scale-105{&:is(:where(.group):hover *){@media (hover:hover){--tw-scale-x:105%;--tw-scale-y:105%;--tw-scale-z:105%;scale:var(--tw-scale-x)var(--tw-scale-y)}}}.group-hover\\:scale-110{&:is(:where(.group):hover *){@media (hover:hover){--tw-scale-x:110%;--tw-scale-y:110%;--tw-scale-z:110%;scale:var(--tw-scale-x)var(--tw-scale-y)}}}.group-hover\\:bg-brand-800{&:is(:where(.group):hover *){@media (hover:hover){background-color:var(--color-brand-800)}}}.group-hover\\:text-brand-700{&:is(:where(.group):hover *){@media (hover:hover){color:var(--color-brand-700)}}}.group-hover\\:underline{&:is(:where(.group):hover *){@media (hover:hover){text-decoration-line:underline}}}.group-hover\\:opacity-100{&:is(:where(.group):hover *){@media (hover:hover){opacity:1}}}.group-hover\\/btn\\:translate-x-1{&:is(:where(.group\\/btn):hover *){@media (hover:hover){--tw-translate-x:calc(var(--spacing)*1);translate:var(--tw-translate-x)var(--tw-translate-y)}}}.group-hover\\/link\\:text-brand-300{&:is(:where(.group\\/link):hover *){@media (hover:hover){color:var(--color-brand-300)}}}.placeholder\\:text-slate-400{&::placeholder{color:var(--color-slate-400)}}.hover\\:-translate-y-0\\.5{&:hover{@media (hover:hover){--tw-translate-y:calc(var(--spacing)*-.5);translate:var(--tw-translate-x)var(--tw-translate-y)}}}.hover\\:-translate-y-1{&:hover{@media (hover:hover){--tw-translate-y:calc(var(--spacing)*-1);translate:var(--tw-translate-x)var(--tw-translate-y)}}}.hover\\:scale-105{&:hover{@media (hover:hover){--tw-scale-x:105%;--tw-scale-y:105%;--tw-scale-z:105%;scale:var(--tw-scale-x)var(--tw-scale-y)}}}.hover\\:scale-110{&:hover{@media (hover:hover){--tw-scale-x:110%;--tw-scale-y:110%;--tw-scale-z:110%;scale:var(--tw-scale-x)var(--tw-scale-y)}}}.hover\\:border-brand-600{&:hover{@media (hover:hover){border-color:var(--color-brand-600)}}}.hover\\:border-zinc-700{&:hover{@media (hover:hover){border-color:var(--color-zinc-700)}}}.hover\\:bg-\\[\\#20ba59\\]{&:hover{@media (hover:hover){background-color:#20ba59}}}.hover\\:bg-\\[\\#166fe5\\]{&:hover{@media (hover:hover){background-color:#166fe5}}}.hover\\:bg-black{&:hover{@media (hover:hover){background-color:var(--color-black)}}}.hover\\:bg-brand-50{&:hover{@media (hover:hover){background-color:var(--color-brand-50)}}}.hover\\:bg-brand-600{&:hover{@media (hover:hover){background-color:var(--color-brand-600)}}}.hover\\:bg-brand-700{&:hover{@media (hover:hover){background-color:var(--color-brand-700)}}}.hover\\:bg-brand-800{&:hover{@media (hover:hover){background-color:var(--color-brand-800)}}}.hover\\:bg-slate-100{&:hover{@media (hover:hover){background-color:var(--color-slate-100)}}}.hover\\:bg-slate-100\\/80{&:hover{@media (hover:hover){background-color:#f1f5f9cc@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-slate-100)80%,transparent)}}}}.hover\\:bg-slate-200{&:hover{@media (hover:hover){background-color:var(--color-slate-200)}}}.hover\\:bg-slate-300{&:hover{@media (hover:hover){background-color:var(--color-slate-300)}}}.hover\\:text-brand-600{&:hover{@media (hover:hover){color:var(--color-brand-600)}}}.hover\\:text-brand-700{&:hover{@media (hover:hover){color:var(--color-brand-700)}}}.hover\\:text-slate-600{&:hover{@media (hover:hover){color:var(--color-slate-600)}}}.hover\\:text-slate-900{&:hover{@media (hover:hover){color:var(--color-slate-900)}}}.hover\\:text-white{&:hover{@media (hover:hover){color:var(--color-white)}}}.hover\\:underline{&:hover{@media (hover:hover){text-decoration-line:underline}}}.hover\\:opacity-90{&:hover{@media (hover:hover){opacity:.9}}}.hover\\:shadow-lg{&:hover{@media (hover:hover){--tw-shadow:0 10px 15px -3px var(--tw-shadow-color,#0000001a),0 4px 6px -4px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}}}.hover\\:shadow-md{&:hover{@media (hover:hover){--tw-shadow:0 4px 6px -1px var(--tw-shadow-color,#0000001a),0 2px 4px -2px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}}}.hover\\:shadow-xl{&:hover{@media (hover:hover){--tw-shadow:0 20px 25px -5px var(--tw-shadow-color,#0000001a),0 8px 10px -6px var(--tw-shadow-color,#0000001a);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}}}.focus\\:not-sr-only{&:focus{clip:auto;white-space:normal;width:auto;height:auto;margin:0;padding:0;position:static;overflow:visible}}.focus\\:absolute{&:focus{position:absolute}}.focus\\:top-2{&:focus{top:calc(var(--spacing)*2)}}.focus\\:left-2{&:focus{left:calc(var(--spacing)*2)}}.focus\\:z-50{&:focus{z-index:50}}.focus\\:rounded-xl{&:focus{border-radius:var(--radius-xl)}}.focus\\:border-transparent{&:focus{border-color:#0000}}.focus\\:bg-brand-700{&:focus{background-color:var(--color-brand-700)}}.focus\\:px-4{&:focus{padding-inline:calc(var(--spacing)*4)}}.focus\\:py-2{&:focus{padding-block:calc(var(--spacing)*2)}}.focus\\:text-white{&:focus{color:var(--color-white)}}.focus\\:ring-2{&:focus{--tw-ring-shadow:var(--tw-ring-inset,)0 0 0 calc(2px + var(--tw-ring-offset-width))var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}}.focus\\:ring-brand-500{&:focus{--tw-ring-color:var(--color-brand-500)}}.focus\\:outline-none{&:focus{--tw-outline-style:none;outline-style:none}}.focus-visible\\:ring-2{&:focus-visible{--tw-ring-shadow:var(--tw-ring-inset,)0 0 0 calc(2px + var(--tw-ring-offset-width))var(--tw-ring-color,currentcolor);box-shadow:var(--tw-inset-shadow),var(--tw-inset-ring-shadow),var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)}}.sm\\:top-6{@media (width>=40rem){top:calc(var(--spacing)*6)}}.sm\\:left-6{@media (width>=40rem){left:calc(var(--spacing)*6)}}.sm\\:block{@media (width>=40rem){display:block}}.sm\\:hidden{@media (width>=40rem){display:none}}.sm\\:inline{@media (width>=40rem){display:inline}}.sm\\:h-24{@media (width>=40rem){height:calc(var(--spacing)*24)}}.sm\\:w-36{@media (width>=40rem){width:calc(var(--spacing)*36)}}.sm\\:w-\\[480px\\]{@media (width>=40rem){width:480px}}.sm\\:grid-cols-2{@media (width>=40rem){grid-template-columns:repeat(2,minmax(0,1fr))}}.sm\\:flex-row{@media (width>=40rem){flex-direction:row}}.sm\\:items-center{@media (width>=40rem){align-items:center}}.sm\\:gap-2{@media (width>=40rem){gap:calc(var(--spacing)*2)}}.sm\\:self-auto{@media (width>=40rem){align-self:auto}}.sm\\:p-8{@media (width>=40rem){padding:calc(var(--spacing)*8)}}.sm\\:text-2xl{@media (width>=40rem){font-size:var(--text-2xl);line-height:var(--tw-leading,var(--text-2xl--line-height))}}.sm\\:text-3xl{@media (width>=40rem){font-size:var(--text-3xl);line-height:var(--tw-leading,var(--text-3xl--line-height))}}.sm\\:text-4xl{@media (width>=40rem){font-size:var(--text-4xl);line-height:var(--tw-leading,var(--text-4xl--line-height))}}.sm\\:text-5xl{@media (width>=40rem){font-size:var(--text-5xl);line-height:var(--tw-leading,var(--text-5xl--line-height))}}.sm\\:text-base{@media (width>=40rem){font-size:var(--text-base);line-height:var(--tw-leading,var(--text-base--line-height))}}.sm\\:text-lg{@media (width>=40rem){font-size:var(--text-lg);line-height:var(--tw-leading,var(--text-lg--line-height))}}.sm\\:text-sm{@media (width>=40rem){font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}}.md\\:line-clamp-3{@media (width>=48rem){-webkit-line-clamp:3;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}}.md\\:block{@media (width>=48rem){display:block}}.md\\:h-14{@media (width>=48rem){height:calc(var(--spacing)*14)}}.md\\:w-14{@media (width>=48rem){width:calc(var(--spacing)*14)}}.md\\:w-72{@media (width>=48rem){width:calc(var(--spacing)*72)}}.md\\:w-\\[23rem\\]{@media (width>=48rem){width:23rem}}.md\\:w-auto{@media (width>=48rem){width:auto}}.md\\:max-w-\\[450px\\]{@media (width>=48rem){max-width:450px}}.md\\:flex-initial{@media (width>=48rem){flex:0 auto}}.md\\:grid-cols-2{@media (width>=48rem){grid-template-columns:repeat(2,minmax(0,1fr))}}.md\\:grid-cols-3{@media (width>=48rem){grid-template-columns:repeat(3,minmax(0,1fr))}}.md\\:flex-row{@media (width>=48rem){flex-direction:row}}.md\\:p-5{@media (width>=48rem){padding:calc(var(--spacing)*5)}}.md\\:p-6{@media (width>=48rem){padding:calc(var(--spacing)*6)}}.md\\:p-10{@media (width>=48rem){padding:calc(var(--spacing)*10)}}.md\\:py-6{@media (width>=48rem){padding-block:calc(var(--spacing)*6)}}.md\\:py-12{@media (width>=48rem){padding-block:calc(var(--spacing)*12)}}.md\\:py-16{@media (width>=48rem){padding-block:calc(var(--spacing)*16)}}.md\\:text-2xl{@media (width>=48rem){font-size:var(--text-2xl);line-height:var(--tw-leading,var(--text-2xl--line-height))}}.md\\:text-3xl{@media (width>=48rem){font-size:var(--text-3xl);line-height:var(--tw-leading,var(--text-3xl--line-height))}}.md\\:text-5xl{@media (width>=48rem){font-size:var(--text-5xl);line-height:var(--tw-leading,var(--text-5xl--line-height))}}.md\\:text-base{@media (width>=48rem){font-size:var(--text-base);line-height:var(--tw-leading,var(--text-base--line-height))}}.md\\:text-lg{@media (width>=48rem){font-size:var(--text-lg);line-height:var(--tw-leading,var(--text-lg--line-height))}}.md\\:text-sm{@media (width>=48rem){font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}}.md\\:text-xs{@media (width>=48rem){font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}}.lg\\:col-span-2{@media (width>=64rem){grid-column:span 2/span 2}}.lg\\:col-span-3{@media (width>=64rem){grid-column:span 3/span 3}}.lg\\:col-span-4{@media (width>=64rem){grid-column:span 4/span 4}}.lg\\:col-span-5{@media (width>=64rem){grid-column:span 5/span 5}}.lg\\:col-span-7{@media (width>=64rem){grid-column:span 7/span 7}}.lg\\:col-span-8{@media (width>=64rem){grid-column:span 8/span 8}}.lg\\:inline{@media (width>=64rem){display:inline}}.lg\\:grid-cols-3{@media (width>=64rem){grid-template-columns:repeat(3,minmax(0,1fr))}}.lg\\:grid-cols-12{@media (width>=64rem){grid-template-columns:repeat(12,minmax(0,1fr))}}.lg\\:flex-row{@media (width>=64rem){flex-direction:row}}.lg\\:items-center{@media (width>=64rem){align-items:center}}.lg\\:gap-12{@media (width>=64rem){gap:calc(var(--spacing)*12)}}.lg\\:text-4xl{@media (width>=64rem){font-size:var(--text-4xl);line-height:var(--tw-leading,var(--text-4xl--line-height))}}.lg\\:text-5xl{@media (width>=64rem){font-size:var(--text-5xl);line-height:var(--tw-leading,var(--text-5xl--line-height))}}.dark\\:border-brand-800{&:where(.dark,.dark *){border-color:var(--color-brand-800)}}.dark\\:border-brand-900\\/50{&:where(.dark,.dark *){border-color:#1e3a8a80;@supports (color:color-mix(in lab, red, red)){border-color:color-mix(in oklab,var(--color-brand-900)50%,transparent)}}}.dark\\:border-brand-900\\/60{&:where(.dark,.dark *){border-color:#1e3a8a99;@supports (color:color-mix(in lab, red, red)){border-color:color-mix(in oklab,var(--color-brand-900)60%,transparent)}}}.dark\\:border-emerald-800{&:where(.dark,.dark *){border-color:var(--color-emerald-800)}}.dark\\:border-rose-900{&:where(.dark,.dark *){border-color:var(--color-rose-900)}}.dark\\:border-zinc-700{&:where(.dark,.dark *){border-color:var(--color-zinc-700)}}.dark\\:border-zinc-800{&:where(.dark,.dark *){border-color:var(--color-zinc-800)}}.dark\\:border-zinc-800\\/60{&:where(.dark,.dark *){border-color:#27272a99;@supports (color:color-mix(in lab, red, red)){border-color:color-mix(in oklab,var(--color-zinc-800)60%,transparent)}}}.dark\\:bg-brand-500{&:where(.dark,.dark *){background-color:var(--color-brand-500)}}.dark\\:bg-brand-950{&:where(.dark,.dark *){background-color:var(--color-brand-950)}}.dark\\:bg-brand-950\\/40{&:where(.dark,.dark *){background-color:#17255466;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-brand-950)40%,transparent)}}}.dark\\:bg-brand-950\\/60{&:where(.dark,.dark *){background-color:#17255499;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-brand-950)60%,transparent)}}}.dark\\:bg-emerald-950{&:where(.dark,.dark *){background-color:var(--color-emerald-950)}}.dark\\:bg-emerald-950\\/60{&:where(.dark,.dark *){background-color:#002c2299;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-emerald-950)60%,transparent)}}}.dark\\:bg-rose-950\\/40{&:where(.dark,.dark *){background-color:#4d021866;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-rose-950)40%,transparent)}}}.dark\\:bg-zinc-800{&:where(.dark,.dark *){background-color:var(--color-zinc-800)}}.dark\\:bg-zinc-800\\/60{&:where(.dark,.dark *){background-color:#27272a99;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-zinc-800)60%,transparent)}}}.dark\\:bg-zinc-800\\/80{&:where(.dark,.dark *){background-color:#27272acc;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-zinc-800)80%,transparent)}}}.dark\\:bg-zinc-900{&:where(.dark,.dark *){background-color:var(--color-zinc-900)}}.dark\\:bg-zinc-900\\/70{&:where(.dark,.dark *){background-color:#18181bb3;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-zinc-900)70%,transparent)}}}.dark\\:bg-zinc-900\\/95{&:where(.dark,.dark *){background-color:#18181bf2;@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-zinc-900)95%,transparent)}}}.dark\\:bg-zinc-950{&:where(.dark,.dark *){background-color:var(--color-zinc-950)}}.dark\\:from-zinc-900{&:where(.dark,.dark *){--tw-gradient-from:var(--color-zinc-900);--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}}.dark\\:to-brand-950\\/30{&:where(.dark,.dark *){--tw-gradient-to:#1725544d;@supports (color:color-mix(in lab, red, red)){--tw-gradient-to:color-mix(in oklab,var(--color-brand-950)30%,transparent)}--tw-gradient-stops:var(--tw-gradient-via-stops,var(--tw-gradient-position),var(--tw-gradient-from)var(--tw-gradient-from-position),var(--tw-gradient-to)var(--tw-gradient-to-position))}}.dark\\:text-amber-400{&:where(.dark,.dark *){color:var(--color-amber-400)}}.dark\\:text-brand-300{&:where(.dark,.dark *){color:var(--color-brand-300)}}.dark\\:text-brand-400{&:where(.dark,.dark *){color:var(--color-brand-400)}}.dark\\:text-emerald-400{&:where(.dark,.dark *){color:var(--color-emerald-400)}}.dark\\:text-rose-300{&:where(.dark,.dark *){color:var(--color-rose-300)}}.dark\\:text-zinc-50{&:where(.dark,.dark *){color:var(--color-zinc-50)}}.dark\\:text-zinc-100{&:where(.dark,.dark *){color:var(--color-zinc-100)}}.dark\\:text-zinc-200{&:where(.dark,.dark *){color:var(--color-zinc-200)}}.dark\\:text-zinc-300{&:where(.dark,.dark *){color:var(--color-zinc-300)}}.dark\\:text-zinc-400{&:where(.dark,.dark *){color:var(--color-zinc-400)}}.dark\\:text-zinc-500{&:where(.dark,.dark *){color:var(--color-zinc-500)}}.dark\\:ring-brand-800{&:where(.dark,.dark *){--tw-ring-color:var(--color-brand-800)}}.dark\\:ring-brand-950{&:where(.dark,.dark *){--tw-ring-color:var(--color-brand-950)}}.dark\\:ring-brand-950\\/50{&:where(.dark,.dark *){--tw-ring-color:#17255480;@supports (color:color-mix(in lab, red, red)){--tw-ring-color:color-mix(in oklab,var(--color-brand-950)50%,transparent)}}}.dark\\:group-hover\\:text-brand-400{&:where(.dark,.dark *){&:is(:where(.group):hover *){@media (hover:hover){color:var(--color-brand-400)}}}}.dark\\:hover\\:bg-brand-950\\/60{&:where(.dark,.dark *){&:hover{@media (hover:hover){background-color:#17255499@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-brand-950)60%,transparent)}}}}}.dark\\:hover\\:bg-zinc-700{&:where(.dark,.dark *){&:hover{@media (hover:hover){background-color:var(--color-zinc-700)}}}}.dark\\:hover\\:bg-zinc-800{&:where(.dark,.dark *){&:hover{@media (hover:hover){background-color:var(--color-zinc-800)}}}}.dark\\:hover\\:bg-zinc-800\\/60{&:where(.dark,.dark *){&:hover{@media (hover:hover){background-color:#27272a99@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-zinc-800)60%,transparent)}}}}}.dark\\:hover\\:bg-zinc-800\\/80{&:where(.dark,.dark *){&:hover{@media (hover:hover){background-color:#27272acc@supports (color:color-mix(in lab, red, red)){background-color:color-mix(in oklab,var(--color-zinc-800)80%,transparent)}}}}}.dark\\:hover\\:text-brand-400{&:where(.dark,.dark *){&:hover{@media (hover:hover){color:var(--color-brand-400)}}}}.dark\\:hover\\:text-zinc-100{&:where(.dark,.dark *){&:hover{@media (hover:hover){color:var(--color-zinc-100)}}}}.dark\\:hover\\:text-zinc-200{&:where(.dark,.dark *){&:hover{@media (hover:hover){color:var(--color-zinc-200)}}}}}.prose{max-width:65ch;color:inherit}.prose.max-w-none{max-width:none}.prose h2{margin-top:1.6em;margin-bottom:.7em;font-size:1.5em;font-weight:800;line-height:1.3}.prose h3{margin-top:1.4em;margin-bottom:.55em;font-size:1.25em;font-weight:700;line-height:1.4}.prose blockquote{opacity:.9;border-left:4px solid #1d4ed8;margin:1.25rem 0;padding-left:1rem;font-style:italic}.prose strong{font-weight:700}@property --tw-translate-x{syntax:\"*\";inherits:false;initial-value:0}@property --tw-translate-y{syntax:\"*\";inherits:false;initial-value:0}@property --tw-translate-z{syntax:\"*\";inherits:false;initial-value:0}@property --tw-scale-x{syntax:\"*\";inherits:false;initial-value:1}@property --tw-scale-y{syntax:\"*\";inherits:false;initial-value:1}@property --tw-scale-z{syntax:\"*\";inherits:false;initial-value:1}@property --tw-space-y-reverse{syntax:\"*\";inherits:false;initial-value:0}@property --tw-border-style{syntax:\"*\";inherits:false;initial-value:solid}@property --tw-gradient-position{syntax:\"*\";inherits:false}@property --tw-gradient-from{syntax:\"<color>\";inherits:false;initial-value:#0000}@property --tw-gradient-via{syntax:\"<color>\";inherits:false;initial-value:#0000}@property --tw-gradient-to{syntax:\"<color>\";inherits:false;initial-value:#0000}@property --tw-gradient-stops{syntax:\"*\";inherits:false}@property --tw-gradient-via-stops{syntax:\"*\";inherits:false}@property --tw-gradient-from-position{syntax:\"<length-percentage>\";inherits:false;initial-value:0%}@property --tw-gradient-via-position{syntax:\"<length-percentage>\";inherits:false;initial-value:50%}@property --tw-gradient-to-position{syntax:\"<length-percentage>\";inherits:false;initial-value:100%}@property --tw-leading{syntax:\"*\";inherits:false}@property --tw-font-weight{syntax:\"*\";inherits:false}@property --tw-tracking{syntax:\"*\";inherits:false}@property --tw-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-shadow-color{syntax:\"*\";inherits:false}@property --tw-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-inset-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-inset-shadow-color{syntax:\"*\";inherits:false}@property --tw-inset-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-ring-color{syntax:\"*\";inherits:false}@property --tw-ring-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-inset-ring-color{syntax:\"*\";inherits:false}@property --tw-inset-ring-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-ring-inset{syntax:\"*\";inherits:false}@property --tw-ring-offset-width{syntax:\"<length>\";inherits:false;initial-value:0}@property --tw-ring-offset-color{syntax:\"*\";inherits:false;initial-value:#fff}@property --tw-ring-offset-shadow{syntax:\"*\";inherits:false;initial-value:0 0 #0000}@property --tw-blur{syntax:\"*\";inherits:false}@property --tw-brightness{syntax:\"*\";inherits:false}@property --tw-contrast{syntax:\"*\";inherits:false}@property --tw-grayscale{syntax:\"*\";inherits:false}@property --tw-hue-rotate{syntax:\"*\";inherits:false}@property --tw-invert{syntax:\"*\";inherits:false}@property --tw-opacity{syntax:\"*\";inherits:false}@property --tw-saturate{syntax:\"*\";inherits:false}@property --tw-sepia{syntax:\"*\";inherits:false}@property --tw-drop-shadow{syntax:\"*\";inherits:false}@property --tw-drop-shadow-color{syntax:\"*\";inherits:false}@property --tw-drop-shadow-alpha{syntax:\"<percentage>\";inherits:false;initial-value:100%}@property --tw-drop-shadow-size{syntax:\"*\";inherits:false}@property --tw-backdrop-blur{syntax:\"*\";inherits:false}@property --tw-backdrop-brightness{syntax:\"*\";inherits:false}@property --tw-backdrop-contrast{syntax:\"*\";inherits:false}@property --tw-backdrop-grayscale{syntax:\"*\";inherits:false}@property --tw-backdrop-hue-rotate{syntax:\"*\";inherits:false}@property --tw-backdrop-invert{syntax:\"*\";inherits:false}@property --tw-backdrop-opacity{syntax:\"*\";inherits:false}@property --tw-backdrop-saturate{syntax:\"*\";inherits:false}@property --tw-backdrop-sepia{syntax:\"*\";inherits:false}@property --tw-duration{syntax:\"*\";inherits:false}@property --tw-ease{syntax:\"*\";inherits:false}@keyframes pulse{50%{opacity:.5}}";

function renderSharedHead({ title, description, canonicalUrl, ogImageUrl, newsApiOrigin, adsenseId, jsonLdSchemas = [] }) {
  const ldScripts = (Array.isArray(jsonLdSchemas) ? jsonLdSchemas : [])
    .filter(Boolean)
    .map((schema) => `<script type="application/ld+json">${safeJsonLdStringify(schema)}</script>`)
    .join('\n  ');
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
  <link rel="dns-prefetch" href="${DEFAULT_WEATHER_API_BASE_URL}" />
  <link rel="preconnect" href="${DEFAULT_WEATHER_API_BASE_URL}" crossorigin="anonymous" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Source+Serif+4:wght@400;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'" />
  <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Source+Serif+4:wght@400;600;700&display=swap" rel="stylesheet" /></noscript>
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
  ${ldScripts}
  ${adsenseId ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapeHtml(adsenseId)}" crossorigin="anonymous"></script>` : ''}
  <style>${WORKER_COMPILED_CSS}</style>
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
  arrowLeft: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  volume2: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  shieldCheck: '<svg class="w-4 h-4 text-brand-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
  phone: '<svg class="w-3.5 h-3.5 text-brand-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  thermometer: '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>',
  droplets: '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>',
  shieldAlert: '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
  cloud: '<svg class="w-8 h-8 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
  cloudRain: '<svg class="w-8 h-8 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>',
  cloudLightning: '<svg class="w-8 h-8 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>',
  compass: '<svg class="w-4 h-4 text-brand-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  home: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  send: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  checkCircle: '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
  copy: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  alertCircle: '<svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
  fileText: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
  cookie: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg>',
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
  const imgSrc = upgradeImageResolution(item.imageUrl || '') || '/cover.png';
  const slug = item.slug || item.id || '';
  if (variant === 'compact') {
    return `
  <article data-news-slug="${escapeHtml(slug)}" class="nj-news-card content-auto group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex gap-4 items-center">
    <div class="zoom-frame relative w-28 h-20 sm:w-36 sm:h-24 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-800">
      <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.title)}" width="144" height="96" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
      <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.title)}" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="w-full h-full object-cover group-hover:scale-110 hover:scale-110 transition-transform duration-500 ease-out" />
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

function renderAdSenseBannerHtml(clientId, slot, format = 'auto') {
  if (!clientId || !slot) {
    return '<div class="h-[1px] w-full" aria-hidden="true"></div>';
  }
  return `
  <aside class="my-4 overflow-hidden text-center min-h-[90px]" aria-label="Publicidade">
    <div class="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Publicidade</div>
    <ins class="adsbygoogle block" data-ad-client="${escapeHtml(clientId)}" data-ad-slot="${escapeHtml(slot)}" data-ad-format="${escapeHtml(format)}" data-full-width-responsive="true"></ins>
    <script>(window.adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </aside>`;
}

function renderFooterAndScripts(adsenseConfig = { clientId: '', slots: {} }) {
  return `
  <footer class="bg-slate-900 text-slate-300 border-t border-slate-800 mt-16">
    <div class="max-w-7xl mx-auto px-4 pt-6">${renderAdSenseBannerHtml(adsenseConfig?.clientId, adsenseConfig?.slots?.footer)}</div>
    <div class="max-w-7xl mx-auto px-4 py-12 md:py-16">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
        <div class="lg:col-span-4 space-y-4">
          <a href="/" class="inline-flex items-center gap-2.5 focus:outline-none">
            <div class="w-9 h-9 bg-brand-700 rounded-xl flex items-center justify-center text-white font-black text-xl tracking-tighter">NJ</div>
            <span class="text-xl font-black tracking-tight text-white">NORMA <span class="text-brand-400">JURÍDICA</span></span>
          </a>
          <p class="text-xs md:text-sm text-slate-400 leading-relaxed">Cobertura jornalística independente, transparente e contínua sobre política, economia, justiça, educação, esportes, tecnologia e os estados brasileiros.</p>
          <div class="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 text-xs space-y-2 text-slate-300">
            <div class="flex items-center gap-2 font-semibold text-white">${SVG_ICONS.shieldCheck}<span>Dados Institucionais Oficiais</span></div>
            <div class="flex items-start gap-2 text-slate-400"><span class="text-slate-200 font-medium">Responsável:</span><span>${SITE_INFO.name}</span></div>
            <div class="flex items-center gap-2 text-slate-400">${SVG_ICONS.mapPin.replace('w-3.5 h-3.5 flex-shrink-0', 'w-3.5 h-3.5 text-brand-400 flex-shrink-0')}<span>${SITE_INFO.address}</span></div>
            <div class="flex items-center gap-2 text-slate-400">${SVG_ICONS.phone}<span>${SITE_INFO.phone}</span></div>
            <div class="flex items-center gap-2 text-slate-400">${SVG_ICONS.mail}<span>${SITE_INFO.email}</span></div>
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

const WORKER_WEATHER_MEM_CACHE = new Map();

function haversineKmWorker(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function findNearestCityWorker(lat, lon, cities = []) {
  let best = null;
  let bestDist = Infinity;
  for (const c of cities) {
    if (typeof c.latitude !== 'number' || typeof c.longitude !== 'number') continue;
    const d = haversineKmWorker(lat, lon, c.latitude, c.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function normalizeCityNameWorker(text = '') {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function fetchRadarEndpointCached(env, targetUrl, ttlSeconds) {
  const safeParsed = assertSafeExternalUrl(targetUrl);
  if (!safeParsed) return null;
  const safeUrl = safeParsed.toString();
  const mem = WORKER_WEATHER_MEM_CACHE.get(safeUrl);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.data;
  }
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) {
    try {
      const hit = await cache.match(safeUrl);
      if (hit) {
        const json = await hit.json();
        WORKER_WEATHER_MEM_CACHE.set(safeUrl, { data: json, expiresAt: Date.now() + ttlSeconds * 1000 });
        return json;
      }
    } catch {}
  }
  try {
    const res = await fetch(safeUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': `NormaJuridica/1.0 (+${CANONICAL_ORIGIN})`,
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (WORKER_WEATHER_MEM_CACHE.size > 150) WORKER_WEATHER_MEM_CACHE.clear();
    WORKER_WEATHER_MEM_CACHE.set(safeUrl, { data: json, expiresAt: Date.now() + ttlSeconds * 1000 });
    if (cache) {
      try {
        await cache.put(
          safeUrl,
          new Response(JSON.stringify(json), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttlSeconds}` },
          })
        );
      } catch {}
    }
    return json;
  } catch {
    return null;
  }
}

export async function getWeatherRadarDataForWorker(query, env = {}, request = null) {
  const { baseUrl } = resolveWorkerWeatherConfig(env);
  let rawQuery = sanitizeWorkerInput(query || '', 80);

  if (!rawQuery && request) {
    const cf = request.cf || {};
    if (cf.latitude && cf.longitude) {
      rawQuery = `${cf.latitude},${cf.longitude}`;
    } else if (cf.city) {
      rawQuery = String(cf.city);
    } else {
      const eLat = request.headers.get('x-vercel-ip-latitude') || request.headers.get('cf-iplatitude');
      const eLon = request.headers.get('x-vercel-ip-longitude') || request.headers.get('cf-iplongitude');
      const eCity = request.headers.get('x-vercel-ip-city') || request.headers.get('cf-ipcity');
      if (eLat && eLon) rawQuery = `${eLat},${eLon}`;
      else if (eCity) rawQuery = decodeURIComponent(eCity);
    }
  }
  if (!rawQuery) rawQuery = 'Brasília';

  const coordsMatch = rawQuery.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  const coords = coordsMatch ? { lat: Number(coordsMatch[1]), lon: Number(coordsMatch[2]) } : null;

  const capitalsJson = await fetchRadarEndpointCached(env, `${baseUrl}/api/v1/cidades`, 86400);
  const capitals = Array.isArray(capitalsJson?.cidades) ? capitalsJson.cidades : [];
  let resolvedCity = null;

  if (coords) {
    const nearestCap = findNearestCityWorker(coords.lat, coords.lon, capitals);
    if (nearestCap) {
      const ufJson = await fetchRadarEndpointCached(env, `${baseUrl}/api/v1/cidades?uf=${encodeURIComponent(nearestCap.uf)}`, 86400);
      const ufCities = Array.isArray(ufJson?.cidades) ? ufJson.cidades : [];
      resolvedCity = findNearestCityWorker(coords.lat, coords.lon, ufCities) || nearestCap;
    }
  } else {
    const normQ = normalizeCityNameWorker(rawQuery);
    const searchJson = await fetchRadarEndpointCached(env, `${baseUrl}/api/v1/cidades?q=${encodeURIComponent(rawQuery)}`, 86400);
    const matches = Array.isArray(searchJson?.cidades) ? searchJson.cidades : [];
    if (matches.length > 0) {
      resolvedCity =
        matches.find((c) => c.capital && normalizeCityNameWorker(c.nome) === normQ) ||
        matches.find((c) => normalizeCityNameWorker(c.nome) === normQ) ||
        matches[0];
    } else {
      resolvedCity =
        capitals.find((c) => normalizeCityNameWorker(c.nome) === normQ) ||
        capitals.find((c) => normalizeCityNameWorker(c.nome).includes(normQ)) ||
        capitals.find((c) => c.uf === 'DF') ||
        null;
    }
  }

  if (!resolvedCity) {
    resolvedCity = { nome: 'Brasília', uf: 'DF', ibge: 5300108, slug: 'brasilia', latitude: -15.7795, longitude: -47.9297, capital: true };
  }

  const [tempsJson, alertsJson, ufJson] = await Promise.all([
    fetchRadarEndpointCached(env, `${baseUrl}/api/v1/temperaturas?limite=50`, 3600),
    fetchRadarEndpointCached(env, `${baseUrl}/api/v1/alertas?uf=${encodeURIComponent(resolvedCity.uf)}`, 600),
    fetchRadarEndpointCached(env, `${baseUrl}/api/v1/cidades?uf=${encodeURIComponent(resolvedCity.uf)}`, 86400),
  ]);

  const stations = [];
  const seenSt = new Set();
  for (const st of [...(tempsJson?.mais_quentes || []), ...(tempsJson?.mais_frias || [])]) {
    if (!st || typeof st.temperatura !== 'number') continue;
    const key = st.ibge || st.cidade;
    if (!seenSt.has(key)) {
      seenSt.add(key);
      stations.push(st);
    }
  }

  let matchedStation =
    stations.find((s) => s.ibge === resolvedCity.ibge) ||
    stations.find((s) => s.uf === resolvedCity.uf && normalizeCityNameWorker(s.cidade) === normalizeCityNameWorker(resolvedCity.nome)) ||
    null;

  if (!matchedStation && stations.length > 0) {
    const ufCities = Array.isArray(ufJson?.cidades) ? ufJson.cidades : [];
    const byIbge = new Map();
    for (const c of [...ufCities, ...capitals]) byIbge.set(c.ibge, c);
    const sameUf = stations.filter((s) => s.uf === resolvedCity.uf);
    const pool = sameUf.length > 0 ? sameUf : stations;
    let bestDist = Infinity;
    for (const st of pool) {
      const cc = byIbge.get(st.ibge);
      if (cc) {
        const d = haversineKmWorker(resolvedCity.latitude, resolvedCity.longitude, cc.latitude, cc.longitude);
        if (d < bestDist) {
          bestDist = d;
          matchedStation = st;
        }
      }
    }
    if (!matchedStation) matchedStation = sameUf[0] || stations[0];
  }

  const rawAlerts = Array.isArray(alertsJson?.alertas) ? alertsJson.alertas : [];
  const activeAlerts = rawAlerts.filter((a) => !a.futuro);
  const alertPool = activeAlerts.length > 0 ? activeAlerts : rawAlerts;
  const cityAlert = alertPool.find((a) => Array.isArray(a.geocodes) && a.geocodes.includes(resolvedCity.ibge));
  const chosenAlert = cityAlert || [...alertPool].sort((a, b) => (b.nivel || 0) - (a.nivel || 0))[0] || null;
  const alert = chosenAlert && chosenAlert.evento
    ? {
        event: chosenAlert.evento,
        severity: chosenAlert.severidade || 'Atenção',
        level: Number(chosenAlert.nivel || 1),
        start: chosenAlert.inicio || '',
        end: chosenAlert.fim || '',
        cityAffected: Boolean(cityAlert),
        affectedCount: chosenAlert.municipios_afetados,
      }
    : null;

  if (matchedStation) {
    const temp = Math.round(matchedStation.temperatura);
    const maxTemp = Math.round(matchedStation.maxima ?? temp + 3);
    const minTemp = Math.round(matchedStation.minima ?? temp - 4);
    const rainMm = typeof matchedStation.chuva_mm === 'number' ? matchedStation.chuva_mm : 0;
    const cond = matchedStation.condicao || 'Parcialmente nublado';
    const wmo = matchedStation.codigo_wmo || 0;
    const lower = cond.toLowerCase();
    let humidity = 62;
    let uvIndex = 5;
    if (rainMm > 1 || lower.includes('trovoada') || lower.includes('tempestade') || wmo >= 80) {
      humidity = 88;
      uvIndex = 2;
    } else if (rainMm > 0 || lower.includes('chuva') || lower.includes('garoa') || (wmo >= 51 && wmo <= 67)) {
      humidity = 82;
      uvIndex = 3;
    } else if (lower.includes('nublado') || lower.includes('encoberto') || wmo === 3) {
      humidity = 70;
      uvIndex = 4;
    } else if (lower.includes('limpo') || lower.includes('sol') || wmo === 0 || wmo === 1) {
      humidity = 52;
      uvIndex = 8;
    }
    const uvDescription = uvIndex >= 8 ? 'Muito Alto' : uvIndex >= 6 ? 'Alto' : uvIndex <= 2 ? 'Baixo' : 'Moderado';

    return {
      city: resolvedCity.nome,
      uf: resolvedCity.uf,
      ibge: resolvedCity.ibge,
      stationCity: matchedStation.ibge !== resolvedCity.ibge && matchedStation.cidade !== resolvedCity.nome ? matchedStation.cidade : undefined,
      temperature: temp,
      feelsLike: temp + (rainMm > 0 ? 0 : 1),
      humidity,
      condition: cond,
      conditionCode: String(wmo),
      uvIndex,
      uvDescription,
      maxTemp,
      minTemp,
      rainMm,
      alert,
      attributionName: 'Radar Meteorológico',
      attributionUrl: baseUrl,
      forecast: [{ date: 'Hoje', maxTemp, minTemp, condition: cond }],
      isFallback: false,
    };
  }

  return {
    city: resolvedCity.nome,
    uf: resolvedCity.uf,
    ibge: resolvedCity.ibge,
    temperature: 26,
    feelsLike: 27,
    humidity: 58,
    condition: 'Parcialmente nublado',
    conditionCode: '2',
    uvIndex: 6,
    uvDescription: 'Alto',
    maxTemp: 29,
    minTemp: 19,
    rainMm: 0,
    alert,
    attributionName: 'Radar Meteorológico',
    attributionUrl: baseUrl,
    forecast: [{ date: 'Hoje', maxTemp: 29, minTemp: 19, condition: 'Parcialmente nublado' }],
    isFallback: true,
  };
}

async function handleApiRequest(request, env, url) {
  const pathname = url.pathname;
  const clientIp = getWorkerClientIp(request);

  if (pathname === '/api/health') {
    const siteConfig = resolveWorkerSiteConfig(env);
    return jsonResponse(
      {
        status: 'healthy',
        app: SITE_INFO.name,
        domain: siteConfig.domain,
        appUrl: siteConfig.appUrl,
        timestamp: new Date().toISOString(),
        uptimeSeconds: 0,
        memoryRssMb: 0,
        environment: readEnvVar(env, ['NODE_ENV']) || 'production',
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
    const rl = checkWorkerRateLimit(`worker:news:${clientIp}`, 90, 60000);
    if (!rl.allowed) {
      return jsonResponse({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }, 429, { 'Retry-After': '60' });
    }
    const category = sanitizeWorkerInput(url.searchParams.get('category') || 'all', 80);
    const q = sanitizeWorkerInput(url.searchParams.get('q') || '', 120);
    const sourceId = sanitizeWorkerInput(url.searchParams.get('sourceId') || '', 64);
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
    const rl = checkWorkerRateLimit(`worker:article:${clientIp}`, 60, 60000);
    if (!rl.allowed) {
      return jsonResponse({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }, 429, { 'Retry-After': '60' });
    }
    const slug = sanitizeWorkerInput(url.searchParams.get('slug') || url.searchParams.get('id') || '', 180);
    const article = await findArticleBySlug(env, slug);
    const contentHtml = article?.contentHtml || '<p>O conteúdo completo desta reportagem está em atualização pela redação do Norma Jurídica.</p>';
    return jsonResponse(
      { success: true, slug, contentHtml },
      200,
      { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
    );
  }

  if (pathname === '/api/weather') {
    const rl = checkWorkerRateLimit(`worker:weather:${clientIp}`, 60, 60000);
    if (!rl.allowed) {
      return jsonResponse({ error: 'Limite de requisições excedido.' }, 429, { 'Retry-After': '60' });
    }
    const latParam = url.searchParams.get('lat');
    const lonParam = url.searchParams.get('lon');
    const qParam = url.searchParams.get('q') || (latParam && lonParam ? `${latParam},${lonParam}` : '');
    const data = await getWeatherRadarDataForWorker(qParam, env, request);
    return jsonResponse(data, 200, { 'Cache-Control': 'public, max-age=600, s-maxage=600' });
  }

  if (pathname === '/api/audio') {
    const apiKey = readEnvVar(env, ['ELEVENLABS_API_KEY']);
    if (request.method === 'GET') {
      return jsonResponse({ enabled: !!apiKey, provider: apiKey ? 'elevenlabs' : 'browser' });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Método não permitido.' }, 405, { Allow: 'GET, POST' });
    }
    const rl = checkWorkerRateLimit(`worker:audio:${clientIp}`, 20, 60000);
    if (!rl.allowed) {
      return jsonResponse({ error: 'Limite de requisições de áudio excedido.' }, 429, { 'Retry-After': '60' });
    }
    const parsedBody = await readSafeJsonBody(request, 20480);
    if (parsedBody.error) {
      return jsonResponse({ error: parsedBody.error }, parsedBody.status);
    }
    const text = sanitizeWorkerInput(parsedBody.data.text || '', 4000);
    if (!text) return jsonResponse({ error: 'Texto para síntese de áudio é obrigatório.' }, 400);
    if (!apiKey) {
      return jsonResponse(
        { enabled: false, fallback: 'web-speech', message: 'ElevenLabs não configurado. Utilizando síntese nativa do navegador.' },
        200,
        { 'Cache-Control': 'no-store' }
      );
    }
    const voiceId = (readEnvVar(env, ['ELEVENLABS_VOICE_ID']) || '21m00Tcm4TlvDq8ikWAM').trim();
    if (!/^[A-Za-z0-9_-]{5,64}$/.test(voiceId)) {
      return jsonResponse({ enabled: false, fallback: 'web-speech' }, 200, { 'Cache-Control': 'no-store' });
    }
    const baseUrl = (readEnvVar(env, ['ELEVENLABS_API_URL']) || 'https://api.elevenlabs.io/v1').replace(/\/+$/, '');
    try {
      assertSafeExternalUrl(baseUrl);
      const res = await fetch(`${baseUrl}/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: 'POST',
        headers: { Accept: 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': apiKey },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return jsonResponse({ enabled: false, fallback: 'web-speech' }, 200, { 'Cache-Control': 'no-store' });
      return new Response(res.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' } });
    } catch {
      return jsonResponse({ enabled: false, fallback: 'web-speech' }, 200, { 'Cache-Control': 'no-store' });
    }
  }

  if (pathname === '/api/contact') {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Método não permitido.' }, 405, { Allow: 'POST' });
    }
    const rl = checkWorkerRateLimit(`worker:contact:${clientIp}`, 5, 600000);
    if (!rl.allowed) {
      return jsonResponse({ error: 'Limite de envios excedido. Aguarde alguns minutos antes de tentar novamente.' }, 429, { 'Retry-After': '600' });
    }
    const parsedBody = await readSafeJsonBody(request, 24576);
    if (parsedBody.error) {
      return jsonResponse({ error: parsedBody.error }, parsedBody.status);
    }
    const body = parsedBody.data;
    const name = sanitizeWorkerInput(body.name || '', 120);
    const email = sanitizeWorkerInput(body.email || '', 150);
    const subject = sanitizeWorkerInput(body.subject || 'Contato Geral', 150) || 'Contato Geral';
    const message = sanitizeWorkerInput(body.message || '', 6000);
    if (name.length < 2) return jsonResponse({ error: 'O nome informado deve ter pelo menos 2 caracteres.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'Por favor, informe um endereço de e-mail válido.' }, 400);
    if (message.length < 10) return jsonResponse({ error: 'A mensagem deve conter pelo menos 10 caracteres detalhando a solicitação.' }, 400);

    const now = new Date();
    const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
    const protocol = `NJ-${datePart}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    let emailSent = false;
    const webhookUrl = readEnvVar(env, ['CONTACT_WEBHOOK_URL']);
    if (webhookUrl) {
      try {
        assertSafeExternalUrl(webhookUrl);
        const hookRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ protocol, name, email, subject, message, timestamp: now.toISOString() }),
          signal: AbortSignal.timeout(5000),
        });
        emailSent = hookRes.ok;
      } catch {}
    }

    return jsonResponse(
      {
        success: true,
        protocol,
        emailSent,
        message: 'Manifestação registrada com sucesso. Anote o número de protocolo para acompanhamento.',
      },
      200,
      { 'Cache-Control': 'no-store' }
    );
  }

  if (pathname === '/api/sync') {
    const rl = checkWorkerRateLimit(`worker:sync:${clientIp}`, 30, 60000);
    if (!rl.allowed) {
      return jsonResponse({ error: 'Muitas solicitações de sincronização.' }, 429, { 'Retry-After': '60' });
    }
    const action = sanitizeWorkerInput(url.searchParams.get('action') || 'status', 32) || 'status';
    const { baseUrl, apiKey } = resolveWorkerNewsApiConfig(env);
    const siteConfig = resolveWorkerSiteConfig(env);
    const configuredSecret = readEnvVar(env, ['REVALIDATE_SECRET', 'CRON_SECRET']);

    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const adminHeader = (request.headers.get('x-admin-secret') || request.headers.get('x-revalidate-secret') || '').trim();
    const provided = adminHeader || bearer || url.searchParams.get('secret') || url.searchParams.get('key') || '';

    if (action === 'export') {
      if (!configuredSecret) {
        return jsonResponse({ error: 'Segredo de administração não configurado no servidor.' }, 503);
      }
      if (!timingSafeCompare(provided, configuredSecret)) {
        return jsonResponse(
          {
            error: 'Ação restrita. Segredo ou token de autorização não fornecido ou inválido.',
            hint: 'Envie o segredo no cabeçalho Authorization: Bearer <TOKEN> (ou x-admin-secret). Para apenas atualizar as notícias a partir do navegador, use /api/sync?action=hydrate&format=html, que não exige segredo.',
          },
          401
        );
      }
      const exported = await fetchAggregatedNews(env, { category: 'all', limit: 100, page: 1 });
      return jsonResponse(
        {
          exportedAt: new Date().toISOString(),
          total: exported.items.length,
          items: exported.items,
        },
        200,
        { 'Cache-Control': 'no-store' }
      );
    }

    if ((action === 'sync' || action === 'prune') && configuredSecret) {
      if (!timingSafeCompare(provided, configuredSecret)) {
        return jsonResponse(
          {
            error: 'Ação restrita. Segredo ou token de autorização não fornecido ou inválido.',
            hint: 'Envie o segredo no cabeçalho Authorization: Bearer <TOKEN> (ou x-admin-secret). Para apenas atualizar as notícias a partir do navegador, use /api/sync?action=hydrate&format=html, que não exige segredo.',
          },
          401
        );
      }
    }
    const probeStart = Date.now();
    let probeRes = await fetchUpstreamJsonDetailed(env, '/api/types', 3000);
    if (!probeRes.data && probeRes.status !== 401) {
      probeRes = await fetchUpstreamJsonDetailed(env, '/api/news?limit=1', 3000);
    }
    const latencyMs = Date.now() - probeStart;

    let cachedSummary = { items: [], total: 0, hydration: { hydratedShards: 0, totalShards: getSourceShards().length, pendingShards: getSourceShards().length, activeSourcesCount: DEFAULT_SOURCE_IDS.length } };
    const shardParam = url.searchParams.has('shard') ? parseInt(url.searchParams.get('shard') || '-1', 10) : -1;
    if (action === 'sync' || action === 'hydrate') {
      cachedSummary = await fetchAggregatedNews(env, {
        category: 'all',
        limit: 100,
        page: 1,
        refresh: true,
        hydrate: true,
        shard: shardParam,
      });
    } else if (probeRes.data) {
      cachedSummary = await fetchAggregatedNews(env, { category: 'all', limit: 1, page: 1 });
    }
    const latestItem = cachedSummary.items[0] || null;
    const totalStored = cachedSummary.total || 0;
    const hydration = cachedSummary.hydration || {
      hydratedShards: 0,
      totalShards: getSourceShards().length,
      pendingShards: getSourceShards().length,
      activeSourcesCount: DEFAULT_SOURCE_IDS.length,
    };
    const syncIntervalSec = parseInt(readEnvVar(env, ['NEWS_SYNC_INTERVAL_SECONDS']) || '60', 10) || 60;
    const maxItems = Math.max(15000, parseInt(readEnvVar(env, ['NEWS_STORE_MAX_ITEMS']) || '15000', 10) || 15000);
    const maxPerSource = Math.max(350, parseInt(readEnvVar(env, ['NEWS_STORE_MAX_PER_SOURCE']) || '350', 10) || 350);
    const retentionDays = Math.max(90, parseInt(readEnvVar(env, ['NEWS_RETENTION_DAYS']) || '90', 10) || 90);

    const upstreamDiagnosis = diagnoseWorkerUpstream({
      ok: Boolean(probeRes.data),
      httpStatus: probeRes.status,
      hasApiKey: Boolean(apiKey),
      baseUrl,
      siteDomain: siteConfig.domain,
      currentHost: url.hostname,
    });
    const payload = {
      status: 'conectado',
      connection: 'ativa',
      actionExecuted: action,
      storage: {
        engine: 'Cloudflare Worker Edge Cache',
        databasePath: 'edge-cache',
        isEphemeral: false,
        totalStored,
        hydration,
        capacity: { maxItems, maxPerSource, retentionDays, syncIntervalSeconds: syncIntervalSec },
      },
      site: {
        domain: siteConfig.domain,
        appUrl: siteConfig.appUrl,
        hasAppUrlVar: siteConfig.hasAppUrlVar,
        hasSiteDomainVar: siteConfig.hasSiteDomainVar,
      },
      upstream: {
        status: probeRes.data ? 'conectado' : 'alerta',
        httpStatus: probeRes.status,
        authConfigured: Boolean(apiKey),
        latencyMs,
        endpoint: baseUrl,
        selfReference: upstreamDiagnosis.selfReference,
        diagnosis: upstreamDiagnosis.message,
      },
      latestPostInStore: latestItem
        ? {
            id: latestItem.id,
            title: latestItem.title,
            slug: latestItem.slug,
            category: latestItem.category,
            pubDate: latestItem.pubDate,
            timeAgo: latestItem.timeAgo,
            link: latestItem.link,
          }
        : null,
      timestamp: new Date().toISOString(),
    };
    const format = url.searchParams.get('format') || '';
    const accept = request.headers.get('accept') || '';
    if (format === 'html' || (!format && accept.includes('text/html'))) {
      const isUpstreamOk = Boolean(probeRes.data);
      const statusBadge = isUpstreamOk
        ? '<span class="badge">● Cloudflare Worker Edge Ativo</span>'
        : '<span class="badge badge-warn">● Cloudflare Worker Edge (Upstream em Alerta)</span>';
      const brtTime = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const alertHelpBox = !apiKey
        ? `<div class="card card-alert">
            <div class="stat-label" style="color:#fbbf24;">Ação Necessária: Autenticação API Ausente no Runtime</div>
            <p style="margin:6px 0;color:#fde68a;">Nenhuma chave de API foi encontrada no ambiente de execução (<code>env</code>) do Worker.</p>
            <p style="margin:6px 0;color:#cbd5e1;">No painel do Cloudflare: acesse <strong>Workers &amp; Pages → normajuridica → Settings → Variables and Secrets</strong> e adicione <code>API_KEY</code> ou <code>NEWS_API_KEY</code> como variável de <strong>Runtime</strong> (não apenas Build variables), depois execute um novo deploy.</p>
          </div>`
        : '';
      const upstreamAlertBox = upstreamDiagnosis.message
        ? `<div class="card card-alert">
            <div class="stat-label" style="color:#fbbf24;">Por que nenhuma notícia está chegando</div>
            <p style="margin:6px 0;color:#fde68a;">${escapeHtml(upstreamDiagnosis.message)}</p>
          </div>`
        : '';
      const latestCard = latestItem
        ? `<div class="card">
            <div class="stat-label">Publicação Mais Recente no Portal</div>
            <div class="latest-title"><a href="/noticia/${escapeHtml(latestItem.slug)}" style="color:#fff;text-decoration:none;">${escapeHtml(latestItem.title)}</a></div>
            <div style="color:#60a5fa;margin-top:6px;">${escapeHtml(latestItem.category)} • ${escapeHtml(latestItem.timeAgo)} • ID: ${escapeHtml(latestItem.id)}</div>
          </div>`
        : '';

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Status da Sincronização &amp; Edge • ${SITE_INFO.name}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #090d16; color: #f1f5f9; padding: 24px; margin: 0; }
    .container { max-width: 720px; margin: 30px auto; background: #131c2e; border: 1px solid #1e293b; border-radius: 20px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; border-bottom: 1px solid #1e293b; padding-bottom: 20px; }
    h1 { font-size: 20px; margin: 0; color: #fff; font-weight: 800; letter-spacing: -0.5px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px; background: #065f46; color: #6ee7b7; font-size: 12px; font-weight: 700; }
    .badge-warn { background: #7c2d12; color: #fdba74; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
    .stat-box { background: #0b1120; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; }
    .stat-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.4px; }
    .stat-value { font-size: 20px; font-weight: 900; color: #38bdf8; font-family: monospace; }
    .card { background: #0b1120; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; margin-bottom: 20px; font-size: 13px; line-height: 1.55; }
    .card-alert { border-color: #92400e; background: rgba(120, 53, 15, 0.25); }
    .card p { margin: 6px 0; color: #cbd5e1; }
    code { color: #38bdf8; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; }
    .latest-title { font-size: 15px; font-weight: 700; color: #fff; margin-top: 6px; line-height: 1.4; }
    .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; transition: background 0.2s; margin: 4px; }
    .btn:hover { background: #1d4ed8; }
    .btn-secondary { background: #334155; }
    .btn-secondary:hover { background: #475569; }
    .footer { font-size: 11px; color: #64748b; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div style="font-size: 11px; color: #60a5fa; font-weight: 800; text-transform: uppercase;">${SITE_INFO.name}</div>
        <h1>Armazenamento Edge &amp; Sincronização</h1>
      </div>
      ${statusBadge}
    </div>
    <div class="grid">
      <div class="stat-box">
        <div class="stat-label">Notícias no Feed / Edge</div>
        <div id="nj-sync-total" class="stat-value" style="color: ${totalStored > 0 ? '#34d399' : '#fbbf24'};">${totalStored.toLocaleString('pt-BR')}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Capacidade Máxima (FIFO)</div>
        <div class="stat-value">${maxItems.toLocaleString('pt-BR')} itens</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Lotes de Fontes Ativas</div>
        <div id="nj-sync-shards" class="stat-value">${hydration.hydratedShards}/${hydration.totalShards} (${hydration.activeSourcesCount} fontes)</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Limite por Fonte / Retenção</div>
        <div class="stat-value">${maxPerSource} / ${retentionDays} dias</div>
      </div>
    </div>
    <div class="card">
      <div class="stat-label">Status do Edge Cache &amp; Conectividade</div>
      <p><strong>Engine:</strong> ${escapeHtml(payload.storage.engine)}</p>
      <p><strong>Domínio / App URL:</strong> <code>${escapeHtml(siteConfig.domain)}</code> • <code>${escapeHtml(siteConfig.appUrl)}</code></p>
      <p><strong>Upstream:</strong> <code>${escapeHtml(baseUrl)}</code> (${escapeHtml(payload.upstream.status)}, HTTP ${payload.upstream.httpStatus || 'N/A'}, ${latencyMs}ms)</p>
      <p><strong>Autenticação API:</strong> <strong style="color:${apiKey ? '#34d399' : '#f87171'};">${apiKey ? 'Configurada' : 'Ausente'}</strong></p>
      <p><strong>Variáveis de URL:</strong> APP_URL=${siteConfig.hasAppUrlVar ? 'Configurada' : 'Fallback'} • SITE_DOMAIN=${siteConfig.hasSiteDomainVar ? 'Configurada' : 'Fallback'}</p>
    </div>
    ${upstreamAlertBox}
    ${alertHelpBox}
    ${latestCard}
    <div style="text-align: center; margin-top: 24px;">
      <a href="/api/sync?action=hydrate&amp;format=html" class="btn">↻ Forçar Sincronização Agora</a>
      <a href="/" class="btn btn-secondary">← Voltar ao Portal</a>
    </div>
    <div class="footer">
      Verificação executada em ${escapeHtml(brtTime)} (Horário de Brasília) • ${escapeHtml(payload.timestamp)}
    </div>
  </div>
  ${
    isUpstreamOk && hydration.pendingShards > 0
      ? `<script>
          (function(){
            var pending = ${hydration.pendingShards};
            var step = 0;
            function nextHydrate() {
              if (step >= ${hydration.totalShards}) return;
              step++;
              fetch('/api/sync?action=hydrate', { cache: 'no-store' })
                .then(function(r){ return r.ok ? r.json() : null; })
                .then(function(d){
                  if (!d || !d.storage) return;
                  var tEl = document.getElementById('nj-sync-total');
                  var sEl = document.getElementById('nj-sync-shards');
                  if (tEl && typeof d.storage.totalStored === 'number') {
                    tEl.textContent = d.storage.totalStored.toLocaleString('pt-BR');
                    if (d.storage.totalStored > 0) tEl.style.color = '#34d399';
                  }
                  var h = d.storage.hydration;
                  if (sEl && h) {
                    sEl.textContent = h.hydratedShards + '/' + h.totalShards + ' (' + h.activeSourcesCount + ' fontes)';
                  }
                  if (h && h.pendingShards > 0) {
                    setTimeout(nextHydrate, 250);
                  }
                })
                .catch(function(){});
            }
            setTimeout(nextHydrate, 250);
          })();
        </script>`
      : ''
  }
</body>
</html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' } });
    }
    return jsonResponse(payload, 200, { 'Cache-Control': 'no-store, max-age=0' });
  }

  if (pathname === '/api/revalidate') {
    const rl = checkWorkerRateLimit(`worker:revalidate:${clientIp}`, 10, 60000);
    if (!rl.allowed) {
      return jsonResponse({ error: 'Muitas tentativas de revalidação.' }, 429, { 'Retry-After': '60' });
    }
    const configuredSecret = readEnvVar(env, ['REVALIDATE_SECRET', 'CRON_SECRET']);
    if (!configuredSecret) {
      return jsonResponse({ error: 'REVALIDATE_SECRET não configurado no ambiente do servidor.' }, 503);
    }
    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const headerSecret = (request.headers.get('x-revalidate-secret') || '').trim();
    const provided = headerSecret || bearer || url.searchParams.get('secret') || '';
    if (!timingSafeCompare(provided, configuredSecret)) {
      return jsonResponse({ error: 'Segredo de revalidação inválido.' }, 401);
    }
    return jsonResponse(
      { revalidated: true, timestamp: new Date().toISOString(), message: 'Cache Edge revalidado com sucesso.' },
      200,
      { 'Cache-Control': 'no-store, max-age=0' }
    );
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
    const { items } = await fetchAggregatedNews(env, { category: 'all', limit: 10000, page: 1 });
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
            totalCount: entries.length,
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
          totalCount: entries.length,
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
  const adsenseConfig = resolveWorkerAdsenseConfig(env);
  const adsenseId = adsenseConfig.clientId;
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
    const featuredImg = upgradeImageResolution(article.imageUrl || '') || '/cover.png';
    const pageUrl = `${baseUrl}/noticia/${article.slug}`;
    const shareTitle = encodeURIComponent(article.title);
    const shareUrl = encodeURIComponent(pageUrl);
    const ogImgAbs = featuredImg.startsWith('http') ? featuredImg : `${baseUrl}${featuredImg}`;
    const articleSchemas = [
      {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: article.title,
        description: article.summary,
        datePublished: article.isoDate || article.pubDate,
        dateModified: article.isoDate || article.pubDate,
        mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
        image: [ogImgAbs],
        author: [{ '@type': 'Person', name: article.author || SITE_INFO.name }],
        publisher: {
          '@type': 'NewsMediaOrganization',
          name: SITE_INFO.name,
          logo: { '@type': 'ImageObject', url: `${baseUrl}/og-image.png` },
        },
        articleSection: article.category,
        inLanguage: 'pt-BR',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: baseUrl },
          { '@type': 'ListItem', position: 2, name: article.category, item: `${baseUrl}/categoria/${article.categoryId}` },
          { '@type': 'ListItem', position: 3, name: article.title, item: pageUrl },
        ],
      },
    ];

    const html = `${renderSharedHead({
      title: `${article.title} | ${SITE_INFO.name}`,
      description: article.summary,
      canonicalUrl: pageUrl,
      ogImageUrl: featuredImg !== '/cover.png' ? featuredImg : ogDefault,
      newsApiOrigin,
      adsenseId,
      jsonLdSchemas: articleSchemas,
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
              <img src="${escapeHtml(featuredImg)}" alt="${escapeHtml(article.title)}" width="1200" height="675" fetchpriority="high" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="w-full h-full object-cover group-hover:scale-105 hover:scale-105 transition-transform duration-700 ease-out" />
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
          <div class="my-8">${renderAdSenseBannerHtml(adsenseConfig.clientId, adsenseConfig.slots.inArticle, 'fluid')}</div>
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
            ${renderAdSenseBannerHtml(adsenseConfig.clientId, adsenseConfig.slots.sidebar)}
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
            ${renderAdSenseBannerHtml(adsenseConfig.clientId, adsenseConfig.slots.sidebarBottom)}
          </div>
        </aside>
      </div>
    </main>
    ${renderFooterAndScripts(adsenseConfig)}`;

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
    <main id="main-content" class="flex-1 max-w-5xl w-full mx-auto px-4 py-8 md:py-12">
      <div class="mb-10 text-center max-w-2xl mx-auto">
        <span class="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-1">Central de Atendimento</span>
        <h1 class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">Fale com a Redação do Norma Jurídica</h1>
        <p class="text-sm text-slate-600 dark:text-zinc-400 mt-2">Envie sugestões de pauta, pedidos de correção editorial, manifestações da ouvidoria ou contate nossa equipe comercial.</p>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div class="lg:col-span-5 space-y-6">
          <div class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
            <h2 class="text-base font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight pb-3 border-b border-slate-100 dark:border-zinc-800">Informações Institucionais</h2>
            <div class="space-y-4 text-xs sm:text-sm">
              <div class="flex items-start gap-3">
                <div class="p-2.5 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 rounded-xl flex-shrink-0">${SVG_ICONS.mapPin.replace('w-3.5 h-3.5 flex-shrink-0', 'w-5 h-5')}</div>
                <div>
                  <strong class="block text-slate-900 dark:text-zinc-100 font-bold">Sede Oficial</strong>
                  <span class="text-slate-500 dark:text-zinc-400">${SITE_INFO.name}<br>${SITE_INFO.address}</span>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <div class="p-2.5 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 rounded-xl flex-shrink-0">${SVG_ICONS.phone.replace('w-3.5 h-3.5 text-brand-400 flex-shrink-0', 'w-5 h-5')}</div>
                <div>
                  <strong class="block text-slate-900 dark:text-zinc-100 font-bold">Telefone &amp; WhatsApp</strong>
                  <span class="text-slate-500 dark:text-zinc-400">${SITE_INFO.phone}</span>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <div class="p-2.5 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 rounded-xl flex-shrink-0">${SVG_ICONS.mail.replace('w-3.5 h-3.5 text-brand-400 flex-shrink-0', 'w-5 h-5')}</div>
                <div>
                  <strong class="block text-slate-900 dark:text-zinc-100 font-bold">E-mail Institucional</strong>
                  <span class="text-slate-500 dark:text-zinc-400">${SITE_INFO.email}</span>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <div class="p-2.5 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 rounded-xl flex-shrink-0">${SVG_ICONS.clock.replace('w-3.5 h-3.5 flex-shrink-0', 'w-5 h-5')}</div>
                <div>
                  <strong class="block text-slate-900 dark:text-zinc-100 font-bold">Horário de Funcionamento</strong>
                  <span class="text-slate-500 dark:text-zinc-400">Plantão Editorial: 24 horas<br>Atendimento Comercial: Segunda a sexta, das 8h às 18h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="lg:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <form id="nj-contact-form" class="space-y-4">
            <div id="nj-contact-error" class="hidden p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">${SVG_ICONS.alertCircle}<span id="nj-contact-error-text"></span></div>
            <div>
              <label for="nj-c-name" class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Nome Completo *</label>
              <input id="nj-c-name" required name="name" placeholder="Seu nome ou razão social" class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label for="nj-c-email" class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">E-mail para Retorno *</label>
              <input id="nj-c-email" required type="email" name="email" placeholder="seuemail@exemplo.com.br" class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label for="nj-c-subject" class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Assunto da Manifestação *</label>
              <select id="nj-c-subject" name="subject" class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="Sugestão de Pauta">Sugestão de Pauta</option>
                <option value="Correção Editorial">Correção Editorial</option>
                <option value="Comercial e Anúncios">Comercial e Anúncios</option>
                <option value="Privacidade e Dados">Privacidade e Dados Pessoais (LGPD)</option>
                <option value="Elogio ou Crítica">Elogio ou Crítica</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label for="nj-c-message" class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Mensagem Detalhada *</label>
              <textarea id="nj-c-message" required name="message" rows="5" placeholder="Descreva com clareza o teor da sua mensagem, mencionando fatos, links ou anexos pertinentes..." class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"></textarea>
              <span class="text-[11px] text-slate-400 mt-1 block">Mínimo de 10 caracteres.</span>
            </div>
            <button type="submit" id="nj-c-submit" class="w-full py-3 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer">${SVG_ICONS.send}<span>Enviar Mensagem e Gerar Protocolo</span></button>
          </form>
          <div id="nj-contact-success" class="hidden text-center py-6 space-y-4">
            <div class="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">${SVG_ICONS.checkCircle}</div>
            <h3 class="text-xl font-black text-slate-900 dark:text-zinc-100">Manifestação Registrada com Sucesso!</h3>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-md mx-auto">Sua demanda foi recebida pela equipe do Norma Jurídica e encaminhada aos editores competentes.</p>
            <div class="p-4 bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 rounded-2xl max-w-sm mx-auto">
              <span class="text-xs font-bold text-brand-800 dark:text-brand-300 block mb-1">Número Oficial de Protocolo:</span>
              <div id="nj-protocol-code" class="text-2xl font-black text-brand-700 dark:text-brand-400 tracking-wider font-mono"></div>
              <button type="button" id="nj-copy-protocol" class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer">${SVG_ICONS.copy}<span>Copiar Protocolo</span></button>
              <p class="text-[11px] text-slate-500 mt-2">Por favor, anote ou salve este número para acompanhamento.</p>
            </div>
            <button type="button" id="nj-contact-again" class="mt-4 text-xs font-bold text-brand-700 hover:underline cursor-pointer">Enviar outra mensagem</button>
          </div>
        </div>
      </div>
      <script>
        (function(){
          var form = document.getElementById('nj-contact-form');
          var errBox = document.getElementById('nj-contact-error');
          var errTxt = document.getElementById('nj-contact-error-text');
          var sucBox = document.getElementById('nj-contact-success');
          var protoEl = document.getElementById('nj-protocol-code');
          var copyBtn = document.getElementById('nj-copy-protocol');
          var againBtn = document.getElementById('nj-contact-again');
          var submitBtn = document.getElementById('nj-c-submit');
          function showErr(msg){ if (errTxt) errTxt.textContent = msg; if (errBox) errBox.classList.remove('hidden'); }
          if (form) form.addEventListener('submit', async function(e){
            e.preventDefault();
            if (errBox) errBox.classList.add('hidden');
            var fd = new FormData(form);
            var payload = Object.fromEntries(fd);
            if (String(payload.name || '').trim().length < 2) return showErr('O nome informado deve ter pelo menos 2 caracteres.');
            if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(payload.email || '').trim())) return showErr('Por favor, informe um endereço de e-mail válido.');
            if (String(payload.message || '').trim().length < 10) return showErr('A mensagem deve conter pelo menos 10 caracteres detalhando a solicitação.');
            if (submitBtn) submitBtn.disabled = true;
            try {
              var res = await fetch('/api/contact', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
              var data = await res.json();
              if (!res.ok || !data.protocol) return showErr(data.error || 'Falha ao registrar manifestação.');
              if (protoEl) protoEl.textContent = data.protocol;
              form.classList.add('hidden');
              if (sucBox) sucBox.classList.remove('hidden');
              form.reset();
            } catch(ex){ showErr('Erro na comunicação com o servidor.'); }
            finally { if (submitBtn) submitBtn.disabled = false; }
          });
          if (copyBtn) copyBtn.addEventListener('click', function(){
            var code = protoEl ? protoEl.textContent : '';
            if (code) try { navigator.clipboard.writeText(code); copyBtn.lastChild.textContent = 'Copiado para a área de transferência'; setTimeout(function(){ copyBtn.lastChild.textContent = 'Copiar Protocolo'; }, 2000); } catch(e){}
          });
          if (againBtn) againBtn.addEventListener('click', function(){
            if (sucBox) sucBox.classList.add('hidden');
            if (form) form.classList.remove('hidden');
          });
        })();
      </script>
    </main>
    ${renderFooterAndScripts(adsenseConfig)}`;
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
      <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-6">
        <a href="/" class="hover:text-brand-700 dark:hover:text-brand-400 transition-colors">Início</a>${SVG_ICONS.chevronRight}
        <span class="text-slate-800 dark:text-zinc-200 font-medium">Institucional</span>
      </nav>
      <h1 class="text-3xl font-black mb-6">Páginas Institucionais</h1>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${Object.entries(INSTITUTIONAL_PAGES).map(([s, p]) => `<a href="/pagina/${escapeHtml(s)}" class="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl hover:border-brand-600 transition-colors"><span class="text-[10px] font-black uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-1">${escapeHtml(p.category)}</span><h2 class="font-bold text-base mb-1">${escapeHtml(p.title)}</h2><p class="text-xs text-slate-500 dark:text-zinc-400">${escapeHtml(p.lead)}</p></a>`).join('')}
      </div>
    </main>
    ${renderFooterAndScripts(adsenseConfig)}`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (pathname === '/privacidade' || pathname === '/termos' || pathname === '/cookies') {
    const legalKey = pathname.slice(1);
    const legal = LEGAL_PAGES[legalKey];
    const html = `${renderSharedHead({
      title: legal.metaTitle,
      description: legal.metaDesc,
      canonicalUrl: `${baseUrl}${pathname}`,
      ogImageUrl: ogDefault,
      newsApiOrigin,
      adsenseId,
    })}
    ${renderHeaderAndNav('todas', [])}
    <main id="main-content" class="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
      <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-6">
        <a href="/" class="hover:text-brand-700 dark:hover:text-brand-400">Início</a>${SVG_ICONS.chevronRight}
        <span class="text-slate-800 dark:text-zinc-200 font-medium">${escapeHtml(legal.breadcrumb)}</span>
      </nav>
      <div class="mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-full text-xs font-black uppercase tracking-wider mb-3">
          ${SVG_ICONS[legal.iconKey] || SVG_ICONS.shieldCheck}
          <span>${escapeHtml(legal.badge)}</span>
        </div>
        <h1 class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-tight mb-4">${escapeHtml(legal.title)}</h1>
        <p class="text-base text-slate-600 dark:text-zinc-300 leading-relaxed border-l-4 border-brand-700 pl-4">${legal.lead}</p>
      </div>
      <article class="article-body prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 font-serif leading-8 text-base md:text-lg space-y-6">${legal.contentHtml}</article>
    </main>
    ${renderFooterAndScripts(adsenseConfig)}`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (pathname.startsWith('/pagina/')) {
    const slug = pathname.slice('/pagina/'.length).replace(/\/+$/, '');
    const pageData = INSTITUTIONAL_PAGES[slug] || getGenericInstitutionalPage(slug);
    const html = `${renderSharedHead({
      title: `${pageData.title} | ${SITE_INFO.name}`,
      description: pageData.lead,
      canonicalUrl: `${baseUrl}${pathname}`,
      ogImageUrl: ogDefault,
      newsApiOrigin,
      adsenseId,
    })}
    ${renderHeaderAndNav('todas', [])}
    <main id="main-content" class="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
      <nav aria-label="Navegação estrutural" class="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-6">
        <a href="/" class="hover:text-brand-700 dark:hover:text-brand-400 transition-colors">Início</a>${SVG_ICONS.chevronRight}
        <a href="/pagina" class="hover:text-brand-700 dark:hover:text-brand-400 transition-colors">Institucional</a>${SVG_ICONS.chevronRight}
        <span class="text-slate-800 dark:text-zinc-200 font-medium">${escapeHtml(pageData.title)}</span>
      </nav>
      <div class="mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-full text-xs font-black uppercase tracking-wider mb-3">
          ${SVG_ICONS.shieldCheck.replace('text-brand-400', 'w-3.5 h-3.5')}
          <span>${escapeHtml(pageData.category)}</span>
        </div>
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-tight mb-4">${escapeHtml(pageData.title)}</h1>
        <p class="text-base sm:text-lg text-slate-600 dark:text-zinc-300 leading-relaxed border-l-4 border-brand-700 pl-4 text-justify hyphens-none">${escapeHtml(pageData.lead)}</p>
      </div>
      <article class="article-body prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 font-serif leading-8 text-base md:text-lg mb-12 text-justify hyphens-none">${pageData.contentHtml}</article>
      <div class="pt-6 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center">
        <a href="/pagina" class="inline-flex items-center gap-2 text-xs font-bold text-brand-700 dark:text-brand-400 hover:underline">${SVG_ICONS.arrowLeft}<span>Voltar ao índice institucional</span></a>
        <a href="/contato" class="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm">Fale com a Redação</a>
      </div>
    </main>
    ${renderFooterAndScripts(adsenseConfig)}`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // 3. Home (/) ou Editoria (/categoria/[slug] | /categoria | /noticia)
  const isHome = pathname === '/' || pathname === '/noticia' || pathname === '/categoria';
  const isCategory = pathname.startsWith('/categoria/');
  if (!isHome && !isCategory) {
    const popularShortcuts = [
      { name: 'Todas as Notícias', href: '/' },
      { name: 'Justiça', href: '/categoria/justica' },
      { name: 'Política', href: '/categoria/politica' },
      { name: 'Economia', href: '/categoria/economia' },
      { name: 'Educação', href: '/categoria/educacao' },
      { name: 'Esporte', href: '/categoria/esporte' },
      { name: 'Saúde', href: '/categoria/saude' },
      { name: 'Tecnologia & Games', href: '/categoria/tecnologia-e-games' },
      { name: 'Pará', href: '/categoria/para' },
      { name: 'Tocantins', href: '/categoria/tocantins' },
      { name: 'Goiás', href: '/categoria/goias' },
      { name: 'Santa Catarina', href: '/categoria/santa-catarina' },
      { name: 'Mundo', href: '/categoria/mundo' },
    ];
    const html404 = `${renderSharedHead({
      title: `Página Não Encontrada | ${SITE_INFO.name}`,
      description: 'Conteúdo não localizado ou movido.',
      canonicalUrl: `${baseUrl}${pathname}`,
      ogImageUrl: ogDefault,
      newsApiOrigin,
      adsenseId,
    })}
    ${renderHeaderAndNav('todas', [])}
    <main id="main-content" class="flex-1 max-w-4xl w-full mx-auto px-4 py-16 flex flex-col items-center text-center justify-center">
      <div class="w-16 h-16 bg-brand-700 text-white rounded-3xl flex items-center justify-center font-black text-3xl shadow-xl mb-6 ring-4 ring-brand-100 dark:ring-brand-950">NJ</div>
      <span class="text-sm font-black uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-2">Erro 404 • Página Não Encontrada</span>
      <h1 class="text-3xl sm:text-5xl font-black text-slate-900 dark:text-zinc-50 tracking-tight mb-4">Conteúdo não localizado ou movido</h1>
      <p class="text-sm sm:text-base text-slate-600 dark:text-zinc-400 max-w-lg mb-8 leading-relaxed">O endereço que você tentou acessar não existe ou foi atualizado pela redação do Norma Jurídica.</p>
      <div class="w-full max-w-md mb-10">
        <form action="/" method="GET" class="relative">
          <input type="search" name="q" placeholder="Pesquisar notícias no portal..." class="w-full px-4 py-3 pl-11 rounded-2xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          ${SVG_ICONS.search.replace('w-4 h-4 text-slate-400 absolute left-3', 'w-5 h-5 text-slate-400 absolute left-3.5')}
        </form>
      </div>
      <div class="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div class="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-4">${SVG_ICONS.compass}<span>Navegue pelas Principais Editorias</span></div>
        <div class="flex flex-wrap items-center justify-center gap-2">
          ${popularShortcuts.map((sc) => `<a href="${sc.href}" class="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/60 dark:hover:text-brand-400 text-xs font-bold rounded-xl transition-colors">${escapeHtml(sc.name)}</a>`).join('')}
        </div>
        <div class="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 flex justify-center">
          <a href="/" class="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors shadow-md">${SVG_ICONS.home}<span>Ir para a Página Inicial</span></a>
        </div>
      </div>
    </main>
    ${renderFooterAndScripts(adsenseConfig)}`;
    return new Response(html404, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const articleQueryParam = url.searchParams.get('article');
  if (articleQueryParam) {
    return Response.redirect(`${baseUrl}/noticia/${encodeURIComponent(articleQueryParam)}`, 307);
  }

  const catQueryParam = url.searchParams.get('cat') || '';
  const isFavorites = catQueryParam === 'favoritos';
  const catSlug = isCategory ? pathname.slice('/categoria/'.length).replace(/\/+$/, '') : (isFavorites ? 'favoritos' : 'all');
  if (isCategory && normalizeCategoryText(catSlug) === 'noticias-gerais') {
    return Response.redirect(`${baseUrl}/categoria/brasil`, 308);
  }
  const q = url.searchParams.get('q') || '';
  const refresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('refresh') === 'true';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = isFavorites ? 100 : isCategory ? 12 : 24;
  const { items, totalPages, hydration } = await fetchAggregatedNews(env, { category: isFavorites ? 'all' : catSlug, q, page, limit, refresh });
  const catTitle = isFavorites ? 'Minha Lista' : isCategory ? resolveCategoryDisplayName(catSlug) : 'Destaques';

  // Render dedicated 3-column Category layout when on /categoria/[slug] (matching app/categoria/[slug]/page.tsx)
  if (isCategory) {
    const pageSuffix = page > 1 ? ` - Página ${page}` : '';
    const htmlCategory = `${renderSharedHead({
      title: `Notícias sobre ${catTitle}${pageSuffix} | ${SITE_INFO.name}`,
      description: `Acompanhe as últimas notícias, análises e reportagens sobre ${catTitle} no portal ${SITE_INFO.name}.${pageSuffix}`,
      canonicalUrl: page > 1 ? `${baseUrl}/categoria/${catSlug}?page=${page}` : `${baseUrl}/categoria/${catSlug}`,
      ogImageUrl: ogDefault,
      newsApiOrigin,
      adsenseId,
    })}
    ${renderHeaderAndNav(catSlug, items, q)}
    <main id="main-content" class="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
      <div class="mb-8 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <h1 class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">${escapeHtml(catTitle)}</h1>
        <p class="text-sm text-slate-500 dark:text-zinc-400 mt-2">Cobertura analítica e factual sobre ${escapeHtml(catTitle.toLowerCase())}, decisões oficiais e acontecimentos em tempo real.</p>
      </div>
      <div class="mb-8">${renderAdSenseBannerHtml(adsenseConfig.clientId, adsenseConfig.slots.header)}</div>
      ${
        items.length === 0
          ? `<div class="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8">
              <div class="w-16 h-16 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-4">${SVG_ICONS.search.replace('w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', 'w-8 h-8')}</div>
              <h2 class="text-lg font-black text-slate-900 dark:text-zinc-100 mb-2">Edição em apuração • ${escapeHtml(catTitle)}</h2>
              <p class="text-sm text-slate-500 max-w-md mx-auto mb-6">A redação do Norma Jurídica está processando e checando novas matérias oficiais para esta editoria em tempo real.</p>
              <a href="/?refresh=true" class="px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2">${SVG_ICONS.refresh.replace('w-4 h-4', 'w-3.5 h-3.5')}<span>Ver todas as notícias</span></a>
            </div>`
          : `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">${items.map((n) => renderNewsCardHtml(n, 'grid')).join('')}</div>
             <div class="mt-8">${renderPaginationHtml(`/categoria/${catSlug}`, page, totalPages)}</div>`
      }
    </main>
    ${renderFooterAndScripts(adsenseConfig)}`;
    return new Response(htmlCategory, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const isInitialHighlights = !isFavorites && !q && page === 1 && items.length > 0;
  const heroSlides = isInitialHighlights ? items.slice(0, 10) : [];
  const feed = isInitialHighlights && items.length > 10 ? items.slice(10) : isInitialHighlights ? items.slice(1) : items;
  const mostRead = items.slice(0, 5);
  const firstHero = heroSlides[0] || null;
  const slidesJson = safeJsonLdStringify(
    heroSlides.map((s) => ({
      slug: s.slug,
      title: s.title,
      summary: s.summary,
      category: s.category,
      author: s.author || 'Norma Jurídica',
      timeAgo: s.timeAgo,
      imageUrl: upgradeImageResolution(s.imageUrl || '') || '/cover.png',
    }))
  );

  const homeSchemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'NewsMediaOrganization',
      name: SITE_INFO.name,
      url: baseUrl,
      logo: { '@type': 'ImageObject', url: `${baseUrl}/og-image.png` },
      contactPoint: { '@type': 'ContactPoint', telephone: SITE_INFO.phone, contactType: 'customer service', areaServed: 'BR', availableLanguage: 'Portuguese' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_INFO.name,
      url: baseUrl,
      potentialAction: { '@type': 'SearchAction', target: `${baseUrl}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
  ];

  const html = `${renderSharedHead({
    title: `${SITE_INFO.name} | ${SITE_INFO.tagline}`,
    description: SITE_INFO.description,
    canonicalUrl: baseUrl,
    ogImageUrl: ogDefault,
    newsApiOrigin,
    adsenseId,
    jsonLdSchemas: homeSchemas,
  })}
  ${renderHeaderAndNav(catSlug, items, q)}
  <main id="main-content" class="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
    ${
      !isFavorites
        ? `<section class="mb-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-sm">
            <div class="max-w-2xl"><h1 class="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-tight">Acompanhe as principais informações de economia, justiça, política e acontecimentos do Brasil.</h1></div>
            <div class="flex-shrink-0">
              <div id="nj-weather-card" class="rounded-2xl p-4 text-white bg-gradient-to-br from-amber-500 to-orange-600 shadow-md w-full md:w-[23rem] border border-white/10 space-y-2">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div id="nj-weather-icon" class="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl flex-shrink-0">${SVG_ICONS.sun.replace('w-3.5 h-3.5 text-amber-400 flex-shrink-0', 'w-7 h-7 text-white drop-shadow')}</div>
                    <div class="min-w-0">
                      <div class="flex items-baseline gap-1.5 flex-wrap">
                        <span id="nj-weather-temp" class="text-3xl font-black tracking-tight">26°C</span>
                        <span id="nj-weather-city" class="text-xs text-white/90 font-semibold inline-flex items-center gap-0.5 truncate">Brasília • DF</span>
                      </div>
                      <p id="nj-weather-cond" class="text-xs text-white/90 font-medium capitalize line-clamp-1">Parcialmente nublado</p>
                    </div>
                  </div>
                  <div class="text-right text-[11px] text-white/90 space-y-1 font-medium border-l border-white/20 pl-3 flex-shrink-0">
                    <div class="flex items-center justify-end gap-1">${SVG_ICONS.thermometer}<span id="nj-weather-minmax">19° / 29°</span></div>
                    <div class="flex items-center justify-end gap-1">${SVG_ICONS.droplets}<span id="nj-weather-hum">58% Umid.</span></div>
                  </div>
                </div>
                <div id="nj-weather-alert" class="hidden items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/25 border border-amber-300/40 text-[11px] font-semibold text-amber-50">
                  ${SVG_ICONS.shieldAlert}<span id="nj-weather-alert-text" class="truncate"></span>
                </div>
                <div class="flex items-center justify-between text-[10px] text-white/75 pt-0.5 border-t border-white/10">
                  <span id="nj-weather-station">Clima &amp; Alertas INMET</span>
                  <a id="nj-weather-credit" href="${DEFAULT_WEATHER_API_BASE_URL}" target="_blank" rel="noopener noreferrer" class="font-semibold text-white/90 hover:text-white underline decoration-white/40">radarmeteorologico.com.br</a>
                </div>
              </div>
            </div>
            <script>
              (function(){
                var ICONS = {
                  sun: '${SVG_ICONS.sun.replace('w-3.5 h-3.5 text-amber-400 flex-shrink-0', 'w-7 h-7 text-white drop-shadow')}',
                  moon: '${SVG_ICONS.moon.replace('w-3.5 h-3.5 text-brand-400 flex-shrink-0', 'w-7 h-7 text-white drop-shadow')}',
                  cloud: '${SVG_ICONS.cloud.replace('w-8 h-8', 'w-7 h-7')}',
                  rain: '${SVG_ICONS.cloudRain.replace('w-8 h-8', 'w-7 h-7')}',
                  storm: '${SVG_ICONS.cloudLightning.replace('w-8 h-8', 'w-7 h-7')}'
                };
                function applyWeatherData(w){
                  if (!w) return;
                  var t = document.getElementById('nj-weather-temp'), c = document.getElementById('nj-weather-city'),
                      cd = document.getElementById('nj-weather-cond'), mm = document.getElementById('nj-weather-minmax'),
                      h = document.getElementById('nj-weather-hum'), st = document.getElementById('nj-weather-station'),
                      al = document.getElementById('nj-weather-alert'), alTxt = document.getElementById('nj-weather-alert-text'),
                      card = document.getElementById('nj-weather-card'), ico = document.getElementById('nj-weather-icon'),
                      cred = document.getElementById('nj-weather-credit');
                  if (t) t.textContent = w.temperature + '°C';
                  if (c) c.textContent = w.uf ? (w.city + ' • ' + w.uf) : w.city;
                  if (cd) cd.textContent = w.condition;
                  var maxT = w.maxTemp != null ? w.maxTemp : (w.forecast && w.forecast[0] ? w.forecast[0].maxTemp : w.temperature + 3);
                  var minT = w.minTemp != null ? w.minTemp : (w.forecast && w.forecast[0] ? w.forecast[0].minTemp : w.temperature - 4);
                  if (mm) mm.textContent = minT + '° / ' + maxT + '°';
                  if (h) h.textContent = (typeof w.rainMm === 'number' && w.rainMm > 0) ? (w.rainMm + ' mm') : (w.humidity + '% Umid.');
                  if (st) st.textContent = w.stationCity ? ('Estação: ' + w.stationCity) : 'Clima & Alertas INMET';
                  if (cred && w.attributionUrl) cred.href = w.attributionUrl;
                  if (al && alTxt) {
                    if (w.alert && w.alert.event) {
                      alTxt.textContent = 'INMET: ' + w.alert.event + ' • ' + (w.alert.severity || 'Atenção');
                      al.classList.remove('hidden'); al.classList.add('flex');
                    } else {
                      al.classList.add('hidden'); al.classList.remove('flex');
                    }
                  }
                  if (card && w.condition) {
                    var cl = w.condition.toLowerCase(), grad = 'from-blue-600 to-indigo-700', iconSvg = ICONS.sun;
                    if (cl.indexOf('tempestade') >= 0 || cl.indexOf('trovoada') >= 0) { grad = 'from-purple-800 to-indigo-950'; iconSvg = ICONS.storm; }
                    else if (cl.indexOf('chuva') >= 0 || cl.indexOf('garoa') >= 0) { grad = 'from-sky-700 to-blue-900'; iconSvg = ICONS.rain; }
                    else if (cl.indexOf('nublado') >= 0 || cl.indexOf('encoberto') >= 0) { grad = 'from-slate-600 to-slate-800'; iconSvg = ICONS.cloud; }
                    else if (cl.indexOf('noite') >= 0 || cl.indexOf('limpo') >= 0) {
                      var hr = new Date().getHours();
                      if (hr < 6 || hr >= 18) { grad = 'from-indigo-900 to-zinc-950'; iconSvg = ICONS.moon; }
                      else { grad = 'from-amber-500 to-orange-600'; iconSvg = ICONS.sun; }
                    } else if (cl.indexOf('sol') >= 0 || cl.indexOf('ensolarado') >= 0) { grad = 'from-amber-500 to-orange-600'; iconSvg = ICONS.sun; }
                    card.className = 'rounded-2xl p-4 text-white bg-gradient-to-br ' + grad + ' shadow-md w-full md:w-[23rem] border border-white/10 space-y-2';
                    if (ico) ico.innerHTML = iconSvg;
                  }
                }
                function loadW(qStr){
                  var ep = qStr ? ('/api/weather?q=' + encodeURIComponent(qStr)) : '/api/weather';
                  fetch(ep).then(function(r){ return r.ok ? r.json() : null; }).then(applyWeatherData).catch(function(){});
                }
                var cachedCoords = null;
                try { cachedCoords = sessionStorage.getItem('nj_weather_coords'); } catch(e){}
                if (cachedCoords) loadW(cachedCoords);
                var geoAllowed = true;
                try {
                  var pol = document.permissionsPolicy || document.featurePolicy;
                  if (pol && typeof pol.allowsFeature === 'function') geoAllowed = pol.allowsFeature('geolocation');
                } catch(e){}
                if (geoAllowed && 'geolocation' in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    function(pos){
                      var coords = pos.coords.latitude.toFixed(4) + ',' + pos.coords.longitude.toFixed(4);
                      try { sessionStorage.setItem('nj_weather_coords', coords); } catch(e){}
                      if (coords !== cachedCoords) loadW(coords);
                    },
                    function(){ if (!cachedCoords) loadW(''); },
                    { timeout: 5000, maximumAge: 600000 }
                  );
                } else if (!cachedCoords) {
                  loadW('');
                }
              })();
            </script>
          </section>`
        : `<div class="mb-8 pb-4 border-b border-slate-200 dark:border-zinc-800"><h1 class="text-3xl sm:text-4xl font-black tracking-tight">${escapeHtml(catTitle)}</h1></div>`
    }
    <div class="mb-8">${renderAdSenseBannerHtml(adsenseConfig.clientId, adsenseConfig.slots.header)}</div>
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-zinc-800">
      <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">${escapeHtml(catTitle)}${
        q ? ` <span class="text-sm font-normal text-slate-500">(busca por: "${escapeHtml(q)}")</span>` : ''
      }</h2>
      <div class="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 self-end sm:self-auto">
        <button type="button" id="nj-view-grid-btn" class="p-2 rounded-lg text-xs font-bold transition-all cursor-pointer bg-white dark:bg-zinc-800 text-brand-700 dark:text-brand-400 shadow-sm" title="Exibição em Grade" aria-label="Exibição em grade"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg></button>
        <button type="button" id="nj-view-compact-btn" class="p-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100" title="Exibição em Lista Compacta" aria-label="Exibição compacta"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg></button>
      </div>
    </div>
    <div id="nj-fav-empty" class="hidden text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 mb-8">
      <div class="w-16 h-16 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-4">${SVG_ICONS.bookmark.replace('w-4 h-4', 'w-8 h-8')}</div>
      <h3 class="text-lg font-black text-slate-900 dark:text-zinc-100 mb-2">Nenhuma matéria salva ainda</h3>
      <p class="text-sm text-slate-500 max-w-md mx-auto mb-6">Clique no ícone de marcador nas matérias que deseja salvar para leitura posterior.</p>
      <a href="/" class="px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2">Ver todas as notícias</a>
    </div>
    ${
      items.length === 0
        ? `<div class="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8">
            <div class="w-16 h-16 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-4">${SVG_ICONS.search.replace('w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none', 'w-8 h-8')}</div>
            <h3 class="text-lg font-black text-slate-900 dark:text-zinc-100 mb-2">${
              q ? 'Nenhum resultado para a busca' : `Edição em apuração • ${escapeHtml(catTitle)}`
            }</h3>
            <p class="text-sm text-slate-500 max-w-md mx-auto mb-6">${
              q
                ? `Não encontramos registros para "${escapeHtml(q)}". Verifique a digitação ou consulte outras editorias.`
                : 'A redação do Norma Jurídica está processando e checando novas matérias oficiais para esta editoria em tempo real.'
            }</p>
            <a href="/?refresh=true" class="px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2">${SVG_ICONS.refresh.replace('w-4 h-4', 'w-3.5 h-3.5')}<span>Ver todas as notícias</span></a>
          </div>`
        : `<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
      <div class="lg:col-span-8 space-y-10">
        ${
          firstHero
            ? `<section id="nj-featured-carousel" class="mb-10" aria-label="Destaques Principais">
                <div class="relative w-full aspect-[16/9] rounded-3xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-zinc-800 shadow-xl group">
                  <div class="relative w-full h-full overflow-hidden zoom-frame" data-pin-nopin="true" data-pin-no-hover="true">
                    <img id="nj-hero-img" src="${escapeHtml(upgradeImageResolution(firstHero.imageUrl || '') || '/cover.png')}" alt="${escapeHtml(firstHero.title)}" width="1200" height="675" fetchpriority="high" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='/cover.png';" class="w-full h-full object-cover group-hover:scale-105 hover:scale-105 transition-transform duration-700 ease-out" />
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
        ${renderAdSenseBannerHtml(adsenseConfig.clientId, adsenseConfig.slots.inArticle)}
        ${renderPaginationHtml('/', page, totalPages)}
      </div>
      <aside class="lg:col-span-4 space-y-8">
        <div class="sticky top-20 space-y-8">
          ${renderAdSenseBannerHtml(adsenseConfig.clientId, adsenseConfig.slots.sidebar)}
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
          ${renderAdSenseBannerHtml(adsenseConfig.clientId, adsenseConfig.slots.sidebarBottom)}
        </div>
      </aside>
    </div>`
    }
    ${
      !isFavorites && !q && page === 1
        ? `<script>
            (function(){
              var knownSlug = ${safeJsonLdStringify(items[0]?.slug || '')};
              setInterval(function(){
                if (document.visibilityState !== 'visible') return;
                fetch('/api/news?limit=1', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
                  var topSlug = d && d.items && d.items[0] ? d.items[0].slug : '';
                  if (topSlug && topSlug !== knownSlug) location.reload();
                }).catch(function(){});
              }, 60000);
              var pendingShards = ${Number(hydration?.pendingShards || 0)};
              var totalShards = ${Number(hydration?.totalShards || 4)};
              if (pendingShards > 0) {
                var hStep = 0;
                var bgHydrate = function() {
                  if (hStep >= totalShards) return;
                  hStep++;
                  fetch('/api/sync?action=hydrate', { cache: 'no-store' })
                    .then(function(r){ return r.ok ? r.json() : null; })
                    .then(function(d){
                      var rem = d && d.storage && d.storage.hydration ? d.storage.hydration.pendingShards : 0;
                      if (rem > 0) setTimeout(bgHydrate, 350);
                    })
                    .catch(function(){});
                };
                setTimeout(bgHydrate, 400);
              }
            })();
          </script>`
        : ''
    }
  </main>
  ${renderFooterAndScripts(adsenseConfig)}`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

const workerHandler = {
  async fetch(request, env = {}) {
    if (!['GET', 'HEAD', 'POST', 'OPTIONS'].includes(request.method)) {
      return applySecurityHeaders(
        new Response(JSON.stringify({ error: 'Método HTTP não permitido.' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET, HEAD, POST, OPTIONS' },
        }),
        new URL(request.url).pathname
      );
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Canonicalização HTTPS e redirecionamento www -> domínio canônico configurado no env
    const canonicalRedirect = resolveDnsAndCanonical(request, env);
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
      await fetchAggregatedNews(env, { category: 'all', limit: 1, hydrate: true, refresh: true });
      const safeOrigin = resolveSafeOriginUrl(env, new URL(CANONICAL_ORIGIN), new Headers());
      const cronSecret = readEnvVar(env, ['REVALIDATE_SECRET', 'CRON_SECRET']);
      if (safeOrigin) {
        const syncUrl = new URL('/api/sync?action=sync', safeOrigin);
        const headers = {};
        if (cronSecret) {
          headers.Authorization = `Bearer ${cronSecret}`;
        }
        await fetch(syncUrl.toString(), { method: 'GET', headers }).catch(() => {});
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

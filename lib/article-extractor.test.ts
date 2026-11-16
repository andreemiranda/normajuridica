import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureCompleteArticleText,
  extractArticleFromHtml,
  formatArticleParagraphsHtml,
} from './article-extractor';

test('formatArticleParagraphsHtml remove <p><p> aninhados e divide blocos únicos longos mantendo abreviações', () => {
  const nested = '<p><p>Primeiro parágrafo.<br><br>Segundo parágrafo com Art. 5º e Dr. Silva.</p></p>';
  const cleanNested = formatArticleParagraphsHtml(nested);
  assert.equal(cleanNested.includes('<p><p>'), false);
  const pMatches = cleanNested.match(/<p\b/g) || [];
  assert.equal(pMatches.length, 2);

  const giantBlob =
    'O plenário do Supremo Tribunal Federal decidiu hoje ampliar os parâmetros de transparência nos portais legislativos municipais em todo o país. ' +
    'Segundo o relator, Dr. Carlos Mendes, a medida garante o cumprimento do Art. 37 da Constituição Federal e fortalece o controle social. ' +
    'Os municípios terão o prazo de cento e oitenta dias para adequar seus sistemas eletrônicos de publicação oficial aos novos padrões técnicos. ' +
    'Além disso, o Tribunal de Contas acompanhará a implementação das ferramentas de busca e acessibilidade em formato aberto para todos os cidadãos. ' +
    'Entidades representativas do setor público manifestaram apoio integral à decisão durante a sessão extraordinária desta quinta-feira.';

  const expanded = formatArticleParagraphsHtml(`<p>${giantBlob}</p>`);
  const paragraphs = expanded.match(/<p>[\s\S]*?<\/p>/g) || [];
  assert.ok(paragraphs.length >= 2, `Esperava múltiplos parágrafos, obtido ${paragraphs.length}`);
  assert.ok(expanded.includes('Dr. Carlos Mendes'));
  assert.ok(expanded.includes('Art. 37'));
});

test('extractArticleFromHtml extrai conteúdo editorial completo ignorando navegação, scripts e ruído', () => {
  const samplePage = `
    <html>
      <body>
        <nav><a href="/">Home</a><a href="/contato">Contato</a></nav>
        <article>
          <h1>Nova resolução regulamenta sessões digitais</h1>
          <p>O Conselho Nacional aprovou nesta semana as novas diretrizes de governança para sessões públicas transmitidas em tempo real.</p>
          <h2>Principais alterações aprovadas</h2>
          <p>A normativa exige registro integral dos votos nominais, disponibilização imediata das atas e recursos de acessibilidade em língua brasileira de sinais.</p>
          <p>Leia mais: Assine nossa newsletter diária</p>
          <blockquote>Decisão amplia a transparência institucional em todas as esferas federativas.</blockquote>
        </article>
        <footer>Todos os direitos reservados</footer>
      </body>
    </html>
  `;

  const extracted = extractArticleFromHtml(samplePage);
  assert.match(extracted, /diretrizes de governança/);
  assert.match(extracted, /<h2>Principais alterações aprovadas<\/h2>/);
  assert.match(extracted, /registro integral dos votos nominais/);
  assert.match(extracted, /<blockquote><p>Decisão amplia a transparência/);
  assert.equal(extracted.includes('Assine nossa newsletter'), false);
  assert.equal(extracted.includes('Todos os direitos reservados'), false);
});

test('ensureCompleteArticleText preserva matérias completas e expande notas curtas sem truncar', () => {
  const shortNote = '<p>Resumo inicial da audiência pública na Câmara Municipal.</p>';
  const completed = ensureCompleteArticleText(shortNote, 'Audiência Pública', 'Política');
  assert.ok((completed.match(/<p\b/g) || []).length >= 2);
  assert.match(completed, /Norma Jurídica/);
});

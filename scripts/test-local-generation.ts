import fs from 'node:fs/promises';
import { writeArticleSectioned } from '../src/pipeline/sectionedWrite';
import { formatFinal } from '../src/pipeline/format';
import { validateArticleQuality } from '../src/pipeline/validators/quality';
import { buildContextPack } from '../src/pipeline/contextPack';
import { textGenerationProviderFromEnv } from '../src/pipeline/openai';

const topic = process.env.LOCAL_TEST_TOPIC || 'Europa kupuje bezpieczeństwo na kredyt, a rachunek za energię wysyła sąsiadom';
const sourceUrl = process.env.LOCAL_TEST_SOURCE_URL || 'https://example.com/local-model-test';
const env = {
  ...process.env,
  TEXT_GENERATION_PROVIDER: 'jetson',
  TEXT_GENERATION_FALLBACK: 'none',
  JETSON_GATEWAY_URL: process.env.JETSON_GATEWAY_URL || 'http://10.2.11.58:8110',
  JETSON_GATEWAY_MODEL: process.env.JETSON_GATEWAY_MODEL || 'qwen3:30b',
} as unknown as Env;

const provider = textGenerationProviderFromEnv(env);
if (provider.type !== 'jetson') throw new Error('Local test did not select Jetson provider');

const styleGuide = await fs.readFile('src/prompt/style-guide.txt', 'utf8');
const contextPack = buildContextPack({
  selectedTopic: { title: topic, url: sourceUrl, description: 'Kontrolowany test lokalnego pipeline\u0027u.' },
  hotTopics: [],
});
// Keep this smoke test focused on local prose generation. The production
// outline stage also requests structured JSON; the current Ollama gateway is
// intentionally tested separately because it exposes native text output.
const outline = {
  finalTitle: topic,
  description: 'Europa finansuje bezpieczeństwo kredytem, a koszty energii przesuwa na państwa sąsiednie.',
  sections: [
    { h2: 'Kredytowy rachunek', bullets: ['mechanizm finansowania bezpieczeństwa', 'koszt przenoszony na sąsiadów'] },
    { h2: 'Energetyczna faktura', bullets: ['logistyka i polityczne decyzje', 'skutek dla budżetów'] },
    { h2: 'Cena odroczona', bullets: ['analogia z ostatnich dwóch lat', 'co zostaje po konferencji'] },
  ],
  guardrails: [],
};
const written = await writeArticleSectioned({
  apiKey: '',
  outline,
  styleGuide,
  contextPack,
  model: provider.model,
  provider,
  leadSourceUrl: sourceUrl,
  paragraphsPerSection: 1,
  maxTokensPerCall: 1800,
});
const article = formatFinal(written.edited);
article.sourceUrl = sourceUrl;
const quality = validateArticleQuality(article, outline);
if (!quality.ok && process.env.LOCAL_TEST_STRICT === 'true') {
  throw new Error(`Local article quality failed: ${quality.errors.join('; ')}`);
}
console.log(JSON.stringify({
  provider: provider.type,
  model: provider.model,
  title: article.title,
  words: quality.stats.words,
  sections: outline.sections.map(section => section.h2),
  sourceUrl,
  qualityOk: quality.ok,
  qualityErrors: quality.errors,
  content: article.content,
}, null, 2));

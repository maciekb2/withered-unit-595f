import { logEvent, logError } from '../utils/logger';
import { createOpenAIRequestError } from '../utils/openaiErrors';
import { retryFetch } from '../utils/retryFetch';

const PSEUDOINTELEKT_HERO_STYLE_LOCK = `

STALE INSTRUKCJE STYLU PSEUDOINTELEKT HERO:
- czysty Situation Room magazine collage, satyryczna ilustracja geopolityczna, jedna precyzyjna metafora z dwoch lub trzech konkretnych przedmiotow;
- elegancki, lekko zabawny kolaż redakcyjny, bez ludzi i twarzy, z wyraznym punktem skupienia;
- paleta: gleboka lesna zielen, teal, ciepla kosc sloniowa i przygaszone zloto; czerwień tylko jako oszczedny akcent;
- landscape 3:2, kontrolowana pusta przestrzen, ostre wycinankowe ksztalty, delikatnie przestrzenne powierzchnie i subtelna faktura druku;
- preferuj przedmioty, mapy, architekture, dokumenty, instrumenty i emblematy; obraz ma byc czytelny po przycieciu do miniatury;
- bez tekstu, liter, cyfr, logo, znakow wodnych, UI, ramek i czytelnych napisow;
- bez fotorealizmu, sceny filmowej, stock-photo look, neonowych gradientow, wizualnego halasu, przypadkowych ikon, ludzi i stereotypowego przedstawiania narodowosci lub grup spolecznych.
`.trim();

export interface GenerateHeroOptions {
  apiKey: string;
  prompt: string;
  model?: string;
  /**
   * Size of the generated image. Defaults to the editorial 3:2 format.
   */
  size?: '256x256' | '512x512' | '1024x1024' | '1024x1536' | '1536x1024';
  /**
   * Style variant for DALL-E 3. GPT Image models should carry style in the prompt.
   */
  style?: 'vivid' | 'natural';
  /**
   * DALL-E 3 supports standard/hd. GPT Image models support low/medium/high/auto.
   */
  quality?: 'standard' | 'hd' | 'low' | 'medium' | 'high' | 'auto';
}

export async function generateHeroImage({
  apiKey,
  prompt,
  model = 'gpt-image-2',
  size = '1536x1024',
  style = 'natural',
  quality = 'medium',
}: GenerateHeroOptions): Promise<Buffer> {
  logEvent({ type: 'generate-hero-start' });
  const finalPrompt = withPseudointelektHeroStyle(prompt);
  logEvent({ type: 'openai-image-request', model, size, quality, promptSnippet: finalPrompt.slice(0, 100) });
  try {
    const body: Record<string, unknown> = {
      model,
      prompt: finalPrompt,
      n: 1,
      size,
    };
    if (model.startsWith('dall-e-3')) {
      body.response_format = 'b64_json';
      body.style = style;
      body.quality = quality === 'hd' ? 'hd' : 'standard';
    } else {
      body.quality = quality === 'hd' || quality === 'standard' ? 'medium' : quality;
    }

    const endpoint = 'https://api.openai.com/v1/images/generations';
    const res = await retryFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      retries: 2,
      retryDelayMs: 1000,
    });

    logEvent({ type: 'openai-image-response-status', status: res.status });

    if (!res.ok) {
      const msg = await res.text();
      throw createOpenAIRequestError(endpoint, res.status, msg);
    }

    const data: any = await res.json();
    logEvent({ type: 'openai-image-response-received' });
    if (!data.data || !data.data[0]) {
      throw new Error('OpenAI image response missing data');
    }
    const b64 = data.data[0].b64_json as string | undefined;
    if (b64) {
      logEvent({ type: 'generate-hero-complete' });
      return Buffer.from(b64, 'base64');
    }

    const imageUrl = data.data[0].url as string | undefined;
    if (imageUrl) {
      const imageRes = await retryFetch(imageUrl, { retries: 2, retryDelayMs: 1000 });
      if (!imageRes.ok) {
        throw new Error(`OpenAI image URL fetch failed: ${imageRes.status}`);
      }
      logEvent({ type: 'generate-hero-complete' });
      return Buffer.from(await imageRes.arrayBuffer());
    }

    throw new Error('OpenAI image response missing b64_json or url');
  } catch (err) {
    logError(err, { type: 'generate-hero-error' });
    throw err;
  }
}

function withPseudointelektHeroStyle(prompt: string): string {
  if (prompt.includes('STALE INSTRUKCJE STYLU PSEUDOINTELEKT HERO')) {
    return prompt;
  }
  return `${prompt.trim()}\n\n${PSEUDOINTELEKT_HERO_STYLE_LOCK}`;
}

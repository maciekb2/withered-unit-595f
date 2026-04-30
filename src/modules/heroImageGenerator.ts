import { logEvent, logError } from '../utils/logger';
import { retryFetch } from '../utils/retryFetch';

export interface GenerateHeroOptions {
  apiKey: string;
  prompt: string;
  model?: string;
  /**
   * Size of the generated image. Defaults to '1024x1024'.
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
  model = 'gpt-image-1.5',
  size = '1024x1024',
  style = 'vivid',
  quality = 'medium',
}: GenerateHeroOptions): Promise<Buffer> {
  logEvent({ type: 'generate-hero-start' });
  logEvent({ type: 'openai-image-request', model, size, quality, promptSnippet: prompt.slice(0, 100) });
  try {
    const body: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
      size,
      response_format: 'b64_json',
    };
    if (model.startsWith('dall-e-3')) {
      body.style = style;
      body.quality = quality === 'hd' ? 'hd' : 'standard';
    } else {
      body.quality = quality === 'hd' || quality === 'standard' ? 'medium' : quality;
    }

    const res = await retryFetch('https://api.openai.com/v1/images/generations', {
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
      throw new Error(`OpenAI image request failed: ${res.status} ${msg}`);
    }

    const data: any = await res.json();
    logEvent({ type: 'openai-image-response-received' });
    if (!data.data || !data.data[0]) {
      throw new Error('OpenAI image response missing data');
    }
    const b64 = data.data[0].b64_json as string | undefined;
    if (!b64) {
      throw new Error('OpenAI image response missing b64_json');
    }
    logEvent({ type: 'generate-hero-complete' });
    return Buffer.from(b64, 'base64');
  } catch (err) {
    logError(err, { type: 'generate-hero-error' });
    throw err;
  }
}

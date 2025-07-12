import { logEvent, logError } from '../utils/logger';
import { retryFetch } from '../utils/retryFetch';

export interface GenerateHeroOptions {
  apiKey: string;
  prompt: string;
  /**
   * Size of the generated image. OpenAI currently supports
   * '256x256', '512x512' and '1024x1024'. Defaults to '1024x1024'.
   */
  size?: '256x256' | '512x512' | '1024x1024';
}

export async function generateHeroImage({ apiKey, prompt, size = '1024x1024' }: GenerateHeroOptions): Promise<Buffer> {
  logEvent({ type: 'generate-hero-start' });
  logEvent({ type: 'openai-image-request', promptSnippet: prompt.slice(0, 100) });
  try {
    const res = await retryFetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        n: 1,
        size,
        response_format: 'b64_json',
      }),
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
    const b64 = data.data[0].b64_json as string;
    logEvent({ type: 'generate-hero-complete' });
    return Buffer.from(b64, 'base64');
  } catch (err) {
    logError(err, { type: 'generate-hero-error' });
    throw err;
  }
}

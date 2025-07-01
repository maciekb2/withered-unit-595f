import { logEvent, logError } from '../utils/logger';

export interface GenerateHeroOptions {
  apiKey: string;
  prompt: string;
}

export async function generateHeroImage({ apiKey, prompt }: GenerateHeroOptions): Promise<Buffer> {
  logEvent({ type: 'generate-hero-start' });
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        n: 1,
        size: '1024x512',
        response_format: 'b64_json',
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`OpenAI image request failed: ${res.status} ${msg}`);
    }

    const data: any = await res.json();
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

export interface GenerateHeroOptions {
  apiKey: string;
  prompt: string;
}

export async function generateHeroImage({ apiKey, prompt }: GenerateHeroOptions): Promise<Buffer> {
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

  const data: any = await res.json();
  const b64 = data.data[0].b64_json as string;
  return Buffer.from(b64, 'base64');
}

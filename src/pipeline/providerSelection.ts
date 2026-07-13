import type { TextGenerationProvider } from './openai';

export function modelForProvider(
  provider: TextGenerationProvider,
  providerModel: string,
  openAiModel: string,
): string {
  return provider.type === 'openai' ? openAiModel : providerModel;
}

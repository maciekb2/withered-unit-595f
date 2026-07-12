import { logEvent, logError } from '../utils/logger';
import { chat, type ChatMessage, type TextGenerationProvider } from './openai';
import { guardrails } from './guardrails';
import { extractJson } from '../utils/json';
import type { FinalJson } from './types';

export interface ArticleReview {
  ok: boolean;
  issues: string[];
  suggestions: string[];
}

export interface ReviewResult {
  review: ArticleReview;
  messages: ChatMessage[];
  raw: string;
}

export async function reviewArticle({
  apiKey,
  article,
  model = 'gpt-5',
  provider,
  maxTokens = 1800,
}: {
  apiKey: string;
  article: FinalJson;
  model?: string;
  provider?: TextGenerationProvider;
  maxTokens?: number;
}): Promise<ReviewResult> {
  const userPrompt = `Jesteś niezależnym redaktorem naczelnym. Oceń poniższy artykuł po polsku przed publikacją.
Sprawdź: zgodność z tytułem i konspektem, powtórzenia akapitów, generyczne frazy, nienaturalne kalki, błędy językowe oraz twierdzenia brzmiące jak nieudokumentowane fakty. Nie dopisuj faktów i nie przepisuj artykułu.
Zwróć wyłącznie JSON { "ok": boolean, "issues": string[], "suggestions": string[] }. Jeśli tekst jest gotowy, zwróć ok=true i puste tablice.

Tytuł: ${article.title}
Opis: ${article.description}

Treść:
${article.content}`;
  const messages: ChatMessage[] = [
    { role: 'system', content: guardrails() },
    { role: 'user', content: userPrompt },
  ];
  let raw = '';
  try {
    raw = await chat(apiKey, {
      messages,
      max_completion_tokens: maxTokens,
      model,
      provider,
      response_style: 'normal',
    });
    const parsed = extractJson<Partial<ArticleReview>>(raw);
    const review: ArticleReview = {
      ok: parsed.ok === true,
      issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).slice(0, 12) : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String).slice(0, 12) : [],
    };
    logEvent({ type: 'article-review-complete', ok: review.ok, issues: review.issues.length });
    return { review, messages, raw };
  } catch (error) {
    logError(error, { type: 'article-review-error', raw });
    (error as any).messages = messages;
    (error as any).raw = raw;
    throw error;
  }
}

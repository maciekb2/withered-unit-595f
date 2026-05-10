import type { Edited, FinalJson } from './types';
import {
  assertArticleDescription,
  assertPolishArticleText,
  cleanArticleDescription,
  normalizeObviousPolishNames,
} from './description';
import { tagsForArticle } from '../utils/topics';

export function formatFinal(edited: Edited): FinalJson {
  const description = cleanArticleDescription(edited.description);
  const title = normalizeObviousPolishNames(edited.title);
  if (title.length > 100) {
    throw new Error('title too long');
  }
  assertPolishArticleText(title, 'title');
  assertPolishArticleText(description, 'description');
  assertArticleDescription(description);
  if (edited.markdown.length < 800) {
    throw new Error('content too short');
  }
  return {
    title,
    description,
    content: edited.markdown,
    tags: tagsForArticle(edited.title, description),
  };
}

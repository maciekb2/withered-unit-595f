import type { Edited, FinalJson } from './types';

export function formatFinal(edited: Edited): FinalJson {
  if (edited.title.length > 100) {
    throw new Error('title too long');
  }
  if (edited.description.length > 200) {
    throw new Error('description too long');
  }
  if (edited.markdown.length < 500) {
    throw new Error('content too short');
  }
  return { title: edited.title, description: edited.description, content: edited.markdown };
}

import { publicationDate } from '../src/utils/publicationDate';
import { TOPICS } from '../src/utils/topics';

export function publicationInput(env: NodeJS.ProcessEnv) {
  const baseTopic = env.BASE_TOPIC?.trim();
  if (!baseTopic) throw new Error('BASE_TOPIC is required');
  const leadSourceUrl = env.LEAD_SOURCE_URL?.trim() || '';
  let source: URL;
  try { source = new URL(leadSourceUrl); } catch { throw new Error('Valid LEAD_SOURCE_URL is required'); }
  if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password || source.hostname === 'example.com') {
    throw new Error('Valid LEAD_SOURCE_URL is required');
  }
  const topic = TOPICS.find(topic => topic.slug === env.ARTICLE_TOPIC);
  if (!topic) throw new Error('ARTICLE_TOPIC must be a canonical topic slug');
  const topicDescription = env.SOURCE_CONTEXT?.trim();
  if (!topicDescription) throw new Error('SOURCE_CONTEXT with verified facts is required');
  // buildContextPack intentionally caps the source description at 500 chars.
  // Reject oversized input rather than silently losing factual guardrails.
  if (topicDescription.length > 500) throw new Error('SOURCE_CONTEXT must not exceed 500 characters');
  return { baseTopic, leadSourceUrl, topicDescription, topic: topic.slug, date: publicationDate(env.PUBLICATION_DATE) };
}

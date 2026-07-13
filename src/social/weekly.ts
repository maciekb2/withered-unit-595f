import type { SocialPackage } from './types';

export interface WeeklyRunItem {
  jobId: string;
  package: SocialPackage;
  variantKey: string;
}

export interface WeeklyRunInput {
  weekKey: string;
  promptVersion: string;
  brief?: Record<string, unknown>;
  items: WeeklyRunItem[];
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateWeeklyRun(input: WeeklyRunInput): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-W\d{2}$/.test(input.weekKey || '')) errors.push('invalid weekKey');
  if (!input.promptVersion || input.promptVersion.length > 80) errors.push('invalid promptVersion');
  if (!Array.isArray(input.items) || input.items.length !== 3) errors.push('weekly run must contain exactly 3 items');
  const ids = new Set<string>();
  let current = 0;
  let evergreen = 0;
  let staticPosts = 0;
  let carousels = 0;
  for (const item of input.items || []) {
    if (!uuid.test(item.jobId || '')) errors.push('invalid jobId');
    ids.add(item.jobId);
    if (!item.variantKey || item.variantKey.length > 80) errors.push('invalid variantKey');
    if (item.package?.contentKind === 'current') current += 1;
    if (item.package?.contentKind === 'evergreen') evergreen += 1;
    if (item.package?.staticPost) staticPosts += 1;
    if (item.package?.carousel) carousels += 1;
    if (item.package?.staticPost && item.package?.carousel) errors.push('one item cannot request both static post and carousel');
  }
  if (ids.size !== input.items?.length) errors.push('duplicate jobId');
  if (current !== 2 || evergreen !== 1) errors.push('weekly run requires 2 current and 1 evergreen item');
  if (staticPosts > 1) errors.push('weekly run allows at most 1 static post');
  if (carousels > 1) errors.push('weekly run allows at most 1 carousel');
  return [...new Set(errors)];
}

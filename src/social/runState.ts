const sealedRunStatuses = new Set(['ready', 'processing', 'review', 'queued', 'published']);
const finalizedJobStatuses = new Set(['ready', 'generating', 'review', 'queued', 'published']);

export const isSealedSocialRunStatus = (status: string) => sealedRunStatuses.has(status);
export const isFinalizedSocialJobStatus = (status: string) => finalizedJobStatuses.has(status);

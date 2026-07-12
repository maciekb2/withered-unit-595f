const metricValue = metric => Number(metric?.value || 0);

export function classifyBufferPost(post, publication = {}, now = new Date()) {
  const nowMs = new Date(now).getTime();
  const dueAtMs = post?.dueAt ? new Date(post.dueAt).getTime() : NaN;
  if (Number.isFinite(dueAtMs)) {
    if (dueAtMs > nowMs) return { status: 'queued', publishedAt: null };
    return { status: 'published', publishedAt: new Date(dueAtMs) };
  }
  if (publication.published_at) return { status: 'published', publishedAt: new Date(publication.published_at) };
  const hasActivity = Array.isArray(post?.metrics) && post.metrics.some(metric => metricValue(metric) > 0);
  if (hasActivity && post.metricsUpdatedAt) {
    return { status: 'published', publishedAt: new Date(post.metricsUpdatedAt) };
  }
  return { status: 'draft', publishedAt: null };
}

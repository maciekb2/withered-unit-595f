type EventName = 'article_read_start' | 'article_scroll_depth' | 'article_read_complete';
interface Sample { now: number; allowed: boolean; visible: boolean; progress: number; scrolled?: boolean; fullyVisible?: boolean; }

// A reading heuristic, not proof that a human understood the text. Time counts
// only while consent is granted and the article content is in a visible tab.
export function articleMeasurement(emit: (name: EventName, extra?: Record<string, number>) => void) {
  let last: Sample | null = null;
  let activeMs = 0;
  let started = false;
  let completed = false;
  let endObserved = false;
  const seen = new Set<number>();
  return (sample: Sample) => {
    const active = sample.allowed && sample.visible;
    if (active && last?.allowed && last.visible) activeMs += Math.max(0, sample.now - last.now);
    if (!sample.allowed) endObserved = false;
    // Do not replay milestones reached before consent.
    if (sample.allowed && !last?.allowed) {
      for (const threshold of [25, 50, 75, 90]) if (sample.progress >= threshold) seen.add(threshold);
      endObserved = Boolean(sample.fullyVisible);
    }
    last = sample;
    if (!active) return;
    if (!started) { started = true; emit('article_read_start'); }
    if (sample.scrolled) {
      for (const threshold of [25, 50, 75, 90]) {
        if (sample.progress >= threshold && !seen.has(threshold)) {
          seen.add(threshold); emit('article_scroll_depth', { scroll_percent: threshold });
        }
      }
      if (sample.progress >= 90) endObserved = true;
    }
    if (sample.fullyVisible) endObserved = true;
    if (!completed && endObserved && activeMs >= 30000) {
      completed = true; emit('article_read_complete', { active_seconds: Math.floor(activeMs / 1000) });
    }
  };
}

export function observeArticleMeasurement(): () => void {
  const article = document.querySelector<HTMLElement>('[data-article-page]');
  const content = document.querySelector<HTMLElement>('#article-content');
  if (!article || !content) return () => {};
  const publishedAt = Date.parse(article.dataset.articlePublishedAt || '');
  const track = (window as Window & { pseudointelektTrack?: (name: string, params: Record<string, unknown>) => void });
  const measure = articleMeasurement((name, extra) => track.pseudointelektTrack?.(name, {
    article_slug: article.dataset.articleSlug,
    article_year: Number(article.dataset.articleYear || 0),
    article_age_days: Number.isFinite(publishedAt) ? Math.max(0, Math.floor((Date.now() - publishedAt) / 86400000)) : 0,
    ...extra,
  }));
  const sample = (scrolled = false) => {
    const bounds = content.getBoundingClientRect();
    const progress = Math.max(0, Math.min(100, 100 * (window.innerHeight - bounds.top) / Math.max(1, bounds.height)));
    measure({ now: performance.now(), allowed: document.documentElement.dataset.analyticsConsent === 'granted',
      visible: document.visibilityState === 'visible' && bounds.bottom > 0 && bounds.top < window.innerHeight,
      progress, scrolled, fullyVisible: bounds.top >= 0 && bounds.bottom <= window.innerHeight });
  };
  const onScroll = () => sample(true);
  const onChange = () => sample();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pseudointelekt:analytics-consent', onChange);
  document.addEventListener('visibilitychange', onChange);
  const timer = window.setInterval(onChange, 1000);
  sample();
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pseudointelekt:analytics-consent', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}

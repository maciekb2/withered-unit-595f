export type SocialJobAction = { status: 'ready' | 'skipped'; resetAttempts: boolean };

export function resolveSocialJobAction(action?: string): SocialJobAction | null {
  if (action === 'skip') return { status: 'skipped', resetAttempts: false };
  if (action === 'retry' || action === 'regenerate') return { status: 'ready', resetAttempts: true };
  return null;
}

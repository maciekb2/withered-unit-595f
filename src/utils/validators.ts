import type { FinalJson } from '../pipeline/types';

export function validateFinalJson(a: FinalJson): { ok: boolean; errs: string[] } {
  const errs: string[] = [];
  if (!a.title || a.title.length > 100) {
    errs.push('title must be <=100 chars');
  }
  if (!a.description || a.description.length > 200) {
    errs.push('description must be <=200 chars');
  }
  if (/[#*_`]/.test(a.description)) {
    errs.push('description contains markdown characters');
  }
  if (!a.content || a.content.length < 800) {
    errs.push('content must be at least 800 chars');
  }
  return { ok: errs.length === 0, errs };
}

export function yamlEscape(s: string): string {
  return s.replace(/"/g, '\\"');
}

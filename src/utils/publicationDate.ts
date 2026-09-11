/** Reject rolled-over calendar dates and path components before writing assets. */
export function publicationDate(value = new Date().toISOString().slice(0, 10)): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Publication date must be YYYY-MM-DD');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid publication date');
  }
  return value;
}

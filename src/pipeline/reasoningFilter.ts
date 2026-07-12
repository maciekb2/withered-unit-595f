/** Remove model-internal reasoning that occasionally leaks from local models. */
export function stripModelReasoning(text: string, expectedHeading?: string): string {
  let value = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/```(?:json|markdown|text)?\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  if (expectedHeading) {
    const heading = `## ${expectedHeading}`;
    const positions: number[] = [];
    let at = value.indexOf(heading);
    while (at >= 0) { positions.push(at); at = value.indexOf(heading, at + heading.length); }
    if (positions.length > 1) value = value.slice(positions[positions.length - 1]);
  }
  for (const marker of ['FINAL ANSWER:', 'FINAL:', 'Gotowy tekst:']) {
    const at = value.lastIndexOf(marker);
    if (at >= 0 && at < value.length - marker.length) { value = value.slice(at + marker.length).trim(); break; }
  }
  const planning = /(?:^|\n)(?:The style guide says:|Need to |Let's |Wait,|First, I |Now, check|I need to )/i;
  if (planning.test(value) && value.indexOf('\n\n') >= 0) {
    const kept = value.split(/\n\s*\n/).filter(p => !planning.test(p.trim()));
    if (kept.length >= 2) value = kept.join('\n\n').trim();
  }
  return value.trim();
}

export function stripEditedReasoning<T extends { markdown: string; title: string; description: string }>(edited: T): T {
  return { ...edited, markdown: stripModelReasoning(edited.markdown), title: stripModelReasoning(edited.title), description: stripModelReasoning(edited.description) };
}

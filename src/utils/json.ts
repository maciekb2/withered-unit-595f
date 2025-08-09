export function extractJson<T>(text: string): T {
  let jsonText = text.trim();
  const fenceMatch = /^```(?:json)?\n([\s\S]*?)\n```$/m.exec(jsonText);
  if (fenceMatch) {
    jsonText = fenceMatch[1];
  }
  // quote unquoted keys
  jsonText = jsonText.replace(/([\{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
  // remove trailing commas
  jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(jsonText);
}

export function extractJson<T>(text: string): T {
  let jsonText = text.trim();
  const fenceMatch = /^```(?:json)?\n([\s\S]*?)\n```$/m.exec(jsonText);
  if (fenceMatch) {
    jsonText = fenceMatch[1];
  } else {
    const objStart = jsonText.indexOf('{');
    const arrStart = jsonText.indexOf('[');
    if (arrStart !== -1 && (arrStart < objStart || objStart === -1)) {
      const arrEnd = jsonText.lastIndexOf(']');
      if (arrEnd !== -1 && arrEnd > arrStart) {
        jsonText = jsonText.slice(arrStart, arrEnd + 1);
      }
    } else if (objStart !== -1) {
      const objEnd = jsonText.lastIndexOf('}');
      if (objEnd !== -1 && objEnd > objStart) {
        jsonText = jsonText.slice(objStart, objEnd + 1);
      }
    }
  }

  // quote unquoted keys
  jsonText = jsonText.replace(/([\{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
  // remove trailing commas
  jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${(err as Error).message}. Input: ${jsonText}`);
  }
}

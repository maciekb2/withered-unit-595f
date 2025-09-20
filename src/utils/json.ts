import { jsonrepair } from 'jsonrepair';

export function extractJson<T>(text: string): T {
  const original = text.trim();
  let jsonText = original;

  const fenceMatch = /^```(?:json)?\n([\s\S]*?)\n```$/m.exec(jsonText);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
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
    jsonText = jsonText.trim();
  }

  if (!jsonText || !/^[\[{]/.test(jsonText)) {
    throw new Error(`No JSON found in input: ${original}`);
  }

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    try {
      const repaired = jsonrepair(jsonText);
      return JSON.parse(repaired);
    } catch (repairErr) {
      throw new Error(
        `Failed to parse JSON: ${(repairErr as Error).message}. Original error: ${(err as Error).message}. Input: ${jsonText}`
      );
    }
  }
}

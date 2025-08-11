import { strict as assert } from 'node:assert';
import { extractJson } from './json';

// Should parse code fence and unquoted keys
const input = "```json\n{\n  finalTitle: \"A\",\n  description: \"B\",\n  sections: [],\n}\n```";

const obj = extractJson<any>(input);
assert.equal(obj.finalTitle, 'A');
assert.equal(obj.description, 'B');
assert.deepEqual(obj.sections, []);

// Should parse when JSON is embedded in extra text
const messy = "Oto wynik:\n{ finalTitle: \"X\", description: \"Y\", sections: [] } Inny tekst";
const obj2 = extractJson<any>(messy);
assert.equal(obj2.finalTitle, 'X');
assert.equal(obj2.description, 'Y');

console.log('extractJson ok');

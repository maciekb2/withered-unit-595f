import { strict as assert } from 'node:assert';
import { extractJson } from './json';

// Should parse code fence and unquoted keys
const input = "```json\n{\n  finalTitle: \"A\",\n  description: \"B\",\n  sections: [],\n}\n```";

const obj = extractJson<any>(input);
assert.equal(obj.finalTitle, 'A');
assert.equal(obj.description, 'B');
assert.deepEqual(obj.sections, []);

console.log('extractJson ok');

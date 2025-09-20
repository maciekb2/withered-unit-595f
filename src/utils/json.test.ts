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

// Should not mangle colons inside string values
const tricky = '{ markdown: "Karta UE CELEX:12012P/TXT oraz https://eur-lex.europa.eu" }';
const obj3 = extractJson<any>(tricky);
assert.ok(obj3.markdown.includes('CELEX:12012P/TXT'));
assert.ok(obj3.markdown.includes('https://eur-lex.europa.eu'));

// Should throw when no JSON present
assert.throws(() => extractJson('```json\n```'), /No JSON/);

console.log('extractJson ok');

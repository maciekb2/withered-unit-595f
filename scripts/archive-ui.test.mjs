import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/components/BlogArchive.astro', import.meta.url), 'utf8');
const script = source.match(/<script define:vars=\{\{ records, perPage \}\}>([\s\S]*?)<\/script>/)[1];
// Exercise the shipped inline controller, not a separately copied implementation.
class Element {
  value = ''; hidden = false; textContent = ''; children = []; events = {}; attributes = {};
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(event, callback) { this.events[event] = callback; }
  focus() { this.focused = true; }
}
class Input extends Element {}
class Button extends Element {}
class Select extends Element { options = [{ value: '' }, { value: 'geopolityka' }]; }
function archive(search = '') {
  const elements = new Map();
  for (const selector of ['#blog-search', '#blog-topic', '[data-default-archive]', '[data-search-results]', '[data-results-list]', '[data-results-pagination]', '[data-results-count]', '[data-empty-results]', '[data-clear-search]', '[data-blog-count]', '[data-results-title]']) {
    elements.set(selector, selector === '#blog-search' ? new Input() : selector === '#blog-topic' ? new Select() : selector === '[data-clear-search]' ? new Button() : new Element());
  }
  let url = '/blog/' + search;
  runInNewContext(script, {
    document: { querySelector: key => elements.get(key), createElement: () => new Element() },
    location: { pathname: '/blog/', search }, history: { replaceState: (_state, _title, next) => { url = next; } },
    HTMLInputElement: Input, HTMLButtonElement: Button, HTMLSelectElement: Select, URLSearchParams, Intl,
    clearTimeout() {}, setTimeout() { return 1; }, window: {},
    records: [{ id: 'test', title: 'Łączność i państwa', description: 'Źródła', tags: ['geopolityka'], topicLabel: 'Geopolityka', date: '2026-09-11', image: '' }], perPage: 20,
  });
  return { elements, url: () => url };
}
test('clearing the final archive filter resets URL, selected topic and visible archive', () => {
  const state = archive('?temat=geopolityka&q=lacznosc');
  assert.equal(state.elements.get('[data-results-list]').children.length, 1);
  state.elements.get('[data-clear-search]').events.click();
  assert.equal(state.url(), '/blog/');
  assert.equal(state.elements.get('#blog-topic').value, '');
  assert.equal(state.elements.get('[data-default-archive]').hidden, false);
  assert.equal(state.elements.get('[data-search-results]').hidden, true);
  assert.equal(state.elements.get('#blog-search').focused, true);
});
test('unknown topic restores all articles and no-results state is explicit', () => {
  const state = archive('?temat=unknown');
  assert.equal(state.url(), '/blog/');
  const input = state.elements.get('#blog-search'); input.value = 'nieistniejący tekst'; input.events.input();
  assert.equal(state.elements.get('[data-empty-results]').hidden, false);
  assert.equal(state.elements.get('[data-results-list]').children.length, 0);
});

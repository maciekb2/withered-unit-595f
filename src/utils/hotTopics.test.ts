import test from 'node:test';
import assert from 'node:assert/strict';
import { getHotTopics, parseHotTopicsFromXml } from './hotTopics.js';

const rssFixture = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture RSS</title>
    <item>
      <title><![CDATA[World &amp; Europe update]]></title>
      <link>https://example.com/world?x=1&amp;y=2</link>
      <pubDate>Thu, 30 Apr 2026 08:15:00 GMT</pubDate>
      <description><![CDATA[<p>Lead &amp; <strong>context</strong>&nbsp;here.</p>]]></description>
    </item>
    <item>
      <title>Missing date should be skipped</title>
      <link>https://example.com/missing-date</link>
      <description>not included</description>
    </item>
  </channel>
</rss>`;

const atomFixture = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Fixture Atom</title>
  <entry>
    <title>Atom title</title>
    <link rel="alternate" href="https://example.com/atom" />
    <updated>2026-04-30T09:00:00Z</updated>
    <summary type="html">&lt;p&gt;Atom &amp;amp; summary&lt;/p&gt;</summary>
  </entry>
</feed>`;

test('parseHotTopicsFromXml parses RSS items without regex extraction', () => {
  const topics = parseHotTopicsFromXml('Fixture', rssFixture);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].title, 'World & Europe update');
  assert.equal(topics[0].url, 'https://example.com/world?x=1&y=2');
  assert.equal(topics[0].published, '2026-04-30T08:15:00.000Z');
  assert.equal(topics[0].source, 'Fixture');
  assert.equal(topics[0].description, 'Lead & context here.');
});

test('parseHotTopicsFromXml parses Atom entries', () => {
  const topics = parseHotTopicsFromXml('Atom Fixture', atomFixture);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].title, 'Atom title');
  assert.equal(topics[0].url, 'https://example.com/atom');
  assert.equal(topics[0].published, '2026-04-30T09:00:00.000Z');
  assert.equal(topics[0].description, 'Atom & summary');
});

test('getHotTopics returns at least 3 topics with title and url', async () => {
  const originalFetch = globalThis.fetch;
  const firstFeed = rssFixture.replace('</channel>', `
    <item>
      <title>Second RSS item</title>
      <link>https://example.com/second</link>
      <pubDate>Thu, 30 Apr 2026 07:00:00 GMT</pubDate>
      <description>Second description</description>
    </item>
  </channel>`);
  globalThis.fetch = async (url) => {
    return new Response(String(url).includes('pap.pl') ? atomFixture : firstFeed, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  };

  try {
    const topics = await getHotTopics();
    assert.ok(Array.isArray(topics));
    assert.ok(topics.length >= 3);
    for (const t of topics.slice(0, 3)) {
      assert.equal(typeof t.title, 'string');
      assert.ok(t.title.length > 0);
      assert.equal(typeof t.url, 'string');
      assert.ok(t.url.length > 0);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

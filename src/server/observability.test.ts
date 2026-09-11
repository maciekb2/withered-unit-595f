import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { probe, probeGateway } from './observability';
test('synthetic probes check semantics and do not follow redirects', async () => {
  const server = createServer((req,res) => {
    if (req.url === '/redirect') { res.writeHead(302,{location:'/good'});res.end(); }
    else if (req.url === '/image') { res.writeHead(200,{'content-type':'image/png','content-length':'123'});res.end(); }
    else { res.writeHead(200);res.end(req.url === '/good' ? '<h1>Article</h1>' : 'broken response'); }
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const address = server.address() as {port:number};
  const url = (path: string) => new URL(path,`http://127.0.0.1:${address.port}`);
  try {
    assert.equal((await probe(url('/good'))).ok,1);
    assert.equal((await probe(url('/bad'))).ok,0);
    assert.equal((await probe(url('/redirect'))).ok,0);
    assert.equal((await probe(url('/image'),'HEAD')).ok,1);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
});

test('gateway probe supplies the required synthetic client identity', async () => {
  const server = createServer((req,res) => {
    const valid = req.headers.host === 'pseudointelekt.pl'
      && req.headers['cf-connecting-ip'] === '192.0.2.1'
      && req.headers['user-agent'] === 'pseudointelekt-internal-probe/1';
    if (req.url === '/redirect') { res.writeHead(302,{location:'/'}); res.end(); return; }
    if (req.url === '/large') { res.end('<h1>'+'x'.repeat(512*1024)); return; }
    if (req.url === '/broken') { res.end('broken'); return; }
    res.writeHead(valid ? 200 : 400); res.end('<h1>Gateway</h1>');
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const url = new URL(`http://127.0.0.1:${(server.address() as {port:number}).port}/`);
  try {
    assert.equal((await probe(url)).status,400);
    assert.equal((await probeGateway(url)).ok,1);
    assert.equal((await probeGateway(new URL('/redirect',url))).status,302);
    assert.equal((await probeGateway(new URL('/large',url))).ok,0);
    assert.equal((await probeGateway(new URL('/broken',url))).ok,0);
    assert.equal((await probeGateway(new URL('https://example.invalid/'))).ok,0);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
});

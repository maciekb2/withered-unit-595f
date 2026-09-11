import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { probe } from './observability';
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSseController } from './sseController.js';

test('SSE controller serializes events and closes after queued writes', async () => {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const reader = stream.readable.getReader();
  const controller = createSseController(stream.writable);

  controller.enqueue('data: one\n\n');
  controller.enqueue(':keepalive\n\n');
  controller.enqueue('data: two\n\n');
  controller.close();

  const decoder = new TextDecoder();
  let output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  await controller.done;

  assert.equal(output, 'data: one\n\n:keepalive\n\ndata: two\n\n');
  assert.equal(controller.closed, true);
});

test('SSE controller ignores writes after close', async () => {
  const chunks: string[] = [];
  const writable = new WritableStream<Uint8Array>({
    write(chunk) { chunks.push(new TextDecoder().decode(chunk)); },
  });
  const controller = createSseController(writable);

  controller.enqueue('before');
  controller.close();
  controller.enqueue('after');
  controller.close();
  await controller.done;

  assert.deepEqual(chunks, ['before']);
});

test('SSE controller contains writer failures without unhandled rejections', async () => {
  let writes = 0;
  const writable = new WritableStream<Uint8Array>({
    write() {
      writes++;
      throw new Error('client disconnected');
    },
  });
  const controller = createSseController(writable);

  controller.enqueue('data: event\n\n');
  controller.enqueue('data: second\n\n');
  controller.close();
  await assert.doesNotReject(controller.done);

  assert.equal(writes, 1);
  assert.equal(controller.closed, true);
});

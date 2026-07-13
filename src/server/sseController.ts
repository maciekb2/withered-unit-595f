export interface SafeSseController {
  enqueue(chunk: string): void;
  close(): void;
  readonly closed: boolean;
  readonly done: Promise<void>;
}

export function createSseController(
  writable: WritableStream<Uint8Array>,
  encoder = new TextEncoder(),
): SafeSseController {
  const writer = writable.getWriter();
  let closed = false;
  let queue = Promise.resolve();

  const append = (operation: () => Promise<unknown>) => {
    queue = queue.then(operation).then(() => undefined, () => undefined);
  };

  return {
    enqueue(chunk: string) {
      if (closed) return;
      append(() => writer.write(encoder.encode(chunk)));
    },
    close() {
      if (closed) return;
      closed = true;
      append(() => writer.close());
    },
    get closed() {
      return closed;
    },
    get done() {
      return queue;
    },
  };
}

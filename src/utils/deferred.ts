export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolveFn: (value: T) => void = () => {};
  const promise = new Promise<T>(res => {
    resolveFn = res;
  });
  return { promise, resolve: resolveFn };
}

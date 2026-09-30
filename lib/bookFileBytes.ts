// Weak ownership keeps input buffers alive only as long as their import Blob.
const inputBuffers = new WeakMap<Blob, ArrayBuffer>();

export function rememberBookFileBytes(blob: Blob, buffer: ArrayBuffer) {
  inputBuffers.set(blob, buffer);
}

export function readBookFileBytes(blob: Blob): Promise<ArrayBuffer> {
  const buffer = inputBuffers.get(blob);
  return buffer ? Promise.resolve(buffer) : blob.arrayBuffer();
}

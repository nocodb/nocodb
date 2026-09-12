import { Transform } from 'stream';
import type { TransformCallback } from 'stream';

export class AttachmentSizeLimitError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Attachment exceeds the maximum allowed size of ${maxBytes} bytes`);
    this.name = 'AttachmentSizeLimitError';
  }
}

/**
 * A pass-through stream that aborts once more than `maxBytes` have flowed
 * through it, erroring with AttachmentSizeLimitError. Enforcing the limit
 * mid-transfer (rather than only via axios maxContentLength, which needs a
 * Content-Length header) stops chunked / length-less responses from streaming
 * an oversized file to storage. Fixes GHSA-cxj6-g54p-jwxp.
 */
export class SizeLimitedStream extends Transform {
  bytesProcessed = 0;

  constructor(private readonly maxBytes: number) {
    super();
  }

  _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ) {
    this.bytesProcessed += chunk.length;
    if (this.bytesProcessed > this.maxBytes) {
      callback(new AttachmentSizeLimitError(this.maxBytes));
      return;
    }
    callback(null, chunk);
  }
}

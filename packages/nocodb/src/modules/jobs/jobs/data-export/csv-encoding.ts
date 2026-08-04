import { Transform } from 'stream';
import iconv from 'iconv-lite';

export const UTF8_BOM = Buffer.from('﻿', 'utf8');

// Max UTF-8 bytes to hold while deciding whether the requested legacy charset
// can represent the data. Large enough to observe the non-ASCII content of the
// first rows (so scripts no legacy codepage can represent — e.g. Tibetan, many
// CJK-in-wrong-codepage cases — are detected up front), small enough to keep
// memory bounded for arbitrarily large exports.
export const CHARSET_DECISION_BUFFER_BYTES = 64 * 1024;

/**
 * Encode a UTF-8 text stream to `charset`, but transparently fall back to UTF-8
 * (with a BOM) for the whole file if any character cannot be represented in
 * `charset`. Without this, a legacy single-byte/CJK codepage (windows-125x,
 * ISO-8859-*, GBK, Big5, Shift-JIS, …) silently turns every non-representable
 * character into "?" — e.g. ASCII survives but Tibetan is destroyed.
 *
 * The decision is made from at most `decisionBufferBytes` of buffered output, so
 * the UTF-8 BOM can be placed at byte 0 (required for Excel to detect UTF-8)
 * without buffering the entire export. Because ASCII encodes identically across
 * all these codepages and UTF-8, and non-representable characters in a given
 * column surface in its first rows, the common cases (all-ASCII, or a
 * non-representable script) are always decided correctly within the buffer.
 *
 * @param charset target legacy charset (must be a valid iconv encoding)
 * @param onFallback called once if the stream falls back to UTF-8
 * @param decisionBufferBytes head-of-stream buffer size before committing to
 *   the requested charset (injectable for testing)
 */
export function createCharsetEncodeStream(
  charset: string,
  onFallback?: () => void,
  decisionBufferBytes: number = CHARSET_DECISION_BUFFER_BYTES,
): Transform {
  let mode: 'deciding' | 'legacy' | 'utf8' = 'deciding';
  const buffered: string[] = [];
  let bufferedBytes = 0;

  // Stateful encoder for the committed-legacy path, built once and reused. A
  // fresh `iconv.encode()` per chunk would re-emit any head-of-stream bytes the
  // codec produces — e.g. UTF-16 writes a BOM, ISO-2022-* reset escape
  // sequences — corrupting the output by injecting them between every chunk
  // (encoding "ab" then "cd" separately yields "ab" + BOM + "cd").
  // Reusing one encoder (as iconv's own encodeStream does) emits them once.
  let legacyEncoder: ReturnType<typeof iconv.getEncoder> | null = null;
  const getLegacyEncoder = () => {
    if (!legacyEncoder) legacyEncoder = iconv.getEncoder(charset);
    return legacyEncoder;
  };

  // A charset is lossy for `text` if encoding then decoding doesn't round-trip.
  // Uses stateless encode/decode — this is a representability probe, not output.
  const isLossy = (text: string) =>
    iconv.decode(iconv.encode(text, charset), charset) !== text;

  return new Transform({
    transform(chunk, _enc, cb) {
      const text = Buffer.isBuffer(chunk)
        ? chunk.toString('utf8')
        : String(chunk);

      if (mode === 'utf8') return cb(null, Buffer.from(text, 'utf8'));
      if (mode === 'legacy') return cb(null, getLegacyEncoder().write(text));

      // deciding: nothing has been emitted yet, so we can still choose the
      // file's encoding (and prepend a BOM) based on what we've seen.
      if (isLossy(text)) {
        mode = 'utf8';
        onFallback?.();
        const pending = buffered.join('') + text;
        buffered.length = 0;
        return cb(
          null,
          Buffer.concat([UTF8_BOM, Buffer.from(pending, 'utf8')]),
        );
      }

      buffered.push(text);
      bufferedBytes += Buffer.byteLength(text, 'utf8');

      if (bufferedBytes >= decisionBufferBytes) {
        // Seen enough representable data — commit to the requested charset.
        mode = 'legacy';
        const pending = buffered.join('');
        buffered.length = 0;
        return cb(null, getLegacyEncoder().write(pending));
      }

      return cb();
    },
    flush(cb) {
      if (mode === 'utf8') return cb();

      if (mode === 'legacy') {
        // Emit any trailing bytes the stateful encoder is still holding.
        return cb(null, getLegacyEncoder().end() ?? Buffer.alloc(0));
      }

      // Still deciding: the whole file fit within the decision buffer.
      const pending = buffered.join('');
      buffered.length = 0;

      if (isLossy(pending)) {
        onFallback?.();
        return cb(
          null,
          Buffer.concat([UTF8_BOM, Buffer.from(pending, 'utf8')]),
        );
      }

      const encoder = getLegacyEncoder();
      return cb(
        null,
        Buffer.concat([
          encoder.write(pending),
          encoder.end() ?? Buffer.alloc(0),
        ]),
      );
    },
  });
}

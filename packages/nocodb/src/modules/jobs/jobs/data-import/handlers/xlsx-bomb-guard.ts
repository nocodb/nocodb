import type { Readable } from 'stream';
import { NcError } from '~/helpers/catchError';

// An .xlsx is a ZIP. exceljs caches the whole `xl/sharedStrings.xml` in memory,
// so a tiny archive whose entries declare a huge uncompressed size (a
// decompression bomb) crashes the process with a V8 OOM abort. The compressed
// upload cap does not bound the DECOMPRESSED size, so check the ZIP's declared
// sizes before exceljs opens the file.
//
// Read the sizes from the central directory rather than the per-entry local
// headers: streaming ZIP writers (exceljs's own export included) legitimately
// defer local-header sizes via a data descriptor, so a local-header check would
// either miss the size or false-reject real spreadsheets. The central directory
// always carries the authoritative compressed+uncompressed sizes.
const MAX_ENTRY_DECOMPRESSED_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_ENTRY_COMPRESSION_RATIO = 200;

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;
const UINT32_MAX = 0xffffffff;

/** Reject an entry that decompresses past the size or ratio limit. */
function assertEntrySafe(
  filename: string,
  compressedSize: number,
  uncompressedSize: number,
) {
  // 0xFFFFFFFF marks a ZIP64 size (real value ≥ 4 GB, held in the extra field).
  // Anything that large is already far past the limit — no need to parse it.
  if (
    uncompressedSize === UINT32_MAX ||
    uncompressedSize > MAX_ENTRY_DECOMPRESSED_BYTES
  ) {
    NcError.badRequest(
      `The uploaded spreadsheet is rejected: entry "${filename}" decompresses to an unsafe size.`,
    );
  }

  if (
    compressedSize > 0 &&
    uncompressedSize / compressedSize > MAX_ENTRY_COMPRESSION_RATIO
  ) {
    NcError.badRequest(
      `The uploaded spreadsheet is rejected: entry "${filename}" has an unsafe compression ratio.`,
    );
  }
}

/** Locate the central directory, honouring ZIP64 when the classic EOCD caps out. */
function findCentralDirectory(
  buf: Buffer,
): { offset: number; entries: number } | null {
  // The EOCD sits at the end behind a variable-length comment (≤ 65535).
  const scanStart = Math.max(0, buf.length - (0xffff + 22));
  let eocd = -1;
  for (let i = buf.length - 22; i >= scanStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  let entries = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);

  if (entries === 0xffff || cdOffset === UINT32_MAX) {
    // ZIP64: the locator precedes the EOCD and points at the ZIP64 EOCD.
    const locator = eocd - 20;
    if (locator < 0 || buf.readUInt32LE(locator) !== ZIP64_EOCD_LOCATOR_SIGNATURE)
      return null;

    const z64 = Number(buf.readBigUInt64LE(locator + 8));
    if (
      z64 < 0 ||
      z64 + 56 > buf.length ||
      buf.readUInt32LE(z64) !== ZIP64_EOCD_SIGNATURE
    )
      return null;

    entries = Number(buf.readBigUInt64LE(z64 + 32));
    cdOffset = Number(buf.readBigUInt64LE(z64 + 48));
  }

  if (cdOffset < 0 || cdOffset >= buf.length) return null;
  return { offset: cdOffset, entries };
}

/**
 * Throws NcError.badRequest if the buffer is a ZIP whose central directory
 * declares a decompression bomb. A non-ZIP or unparseable buffer is left for
 * exceljs to reject normally — this guard only blocks the clear-cut bomb.
 */
export function assertXlsxNotDecompressionBomb(buf: Buffer): void {
  const cd = findCentralDirectory(buf);
  if (!cd) return;

  let ptr = cd.offset;
  for (let i = 0; i < cd.entries; i++) {
    if (ptr + 46 > buf.length) break;
    if (buf.readUInt32LE(ptr) !== CENTRAL_FILE_HEADER_SIGNATURE) break;

    const compressedSize = buf.readUInt32LE(ptr + 20);
    const uncompressedSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);

    const filename = buf
      .subarray(ptr + 46, ptr + 46 + nameLen)
      .toString('utf8');

    assertEntrySafe(filename, compressedSize, uncompressedSize);

    ptr += 46 + nameLen + extraLen + commentLen;
  }
}

/** Buffer a stream with a hard cap (the upload is already capped upstream). */
export async function readStreamToBuffer(
  stream: Readable,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > maxBytes) {
      stream.destroy();
      NcError.badRequest('The uploaded file exceeds the import size limit.');
    }
    chunks.push(buf);
  }

  return Buffer.concat(chunks);
}

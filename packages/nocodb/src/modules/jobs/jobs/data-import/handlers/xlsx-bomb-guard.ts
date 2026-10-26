import zlib from 'zlib';
import type { Readable } from 'stream';
import { NcError } from '~/helpers/catchError';
import {
  NC_DATA_IMPORT_XLSX_MAX_PART_SIZE,
  NC_DATA_IMPORT_XLSX_MAX_UNZIPPED_SIZE,
} from '~/constants';

// An .xlsx is a ZIP. exceljs caches the whole `xl/sharedStrings.xml` in memory,
// so a tiny archive that inflates to a huge size (a decompression bomb) crashes
// the process with a V8 OOM abort. The compressed upload cap does not bound the
// DECOMPRESSED size, so the archive is checked before exceljs opens it.
//
// exceljs (via unzipper) reads the local entries in file order and ignores the
// central directory, while the central directory is what lists the entries. So
// the guard requires both to describe exactly the same byte ranges, then
// inflates every entry the way unzipper will, with a hard cap on the output.
const MAX_ENTRY_COMPRESSION_RATIO = 200;
// exceljs streams worksheet XML row by row; every other part it parses in memory
const STREAMED_PART_PATH = /xl\/worksheets\/sheet\d+[.]xml/;

export interface XlsxGuardLimits {
  /** parts exceljs holds in memory, e.g. sharedStrings */
  maxPartSize: number;
  /** the whole unzipped workbook, and so any single worksheet */
  maxUnzippedSize: number;
}

const DEFAULT_LIMITS: XlsxGuardLimits = {
  maxPartSize: NC_DATA_IMPORT_XLSX_MAX_PART_SIZE,
  maxUnzippedSize: NC_DATA_IMPORT_XLSX_MAX_UNZIPPED_SIZE,
};

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const DATA_DESCRIPTOR_SIGNATURE_BYTES = Buffer.from([0x50, 0x4b, 0x07, 0x08]);
const FLAG_DATA_DESCRIPTOR = 0x08;
const UINT32_MAX = 0xffffffff;

interface CentralEntry {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

function rejectInvalidArchive(): never {
  NcError.badRequest(
    'The uploaded spreadsheet is rejected: the file is not a valid xlsx archive.',
  );
}

function formatLimit(bytes: number, envName: string) {
  return `${Math.round(bytes / (1024 * 1024))} MB limit (${envName})`;
}

/** Reject an entry that decompresses past the size or ratio limit. */
function assertEntrySafe(
  filename: string,
  compressedSize: number,
  uncompressedSize: number,
  limits: XlsxGuardLimits,
) {
  const streamed = STREAMED_PART_PATH.test(filename);
  const [maxSize, envName] = streamed
    ? [limits.maxUnzippedSize, 'NC_DATA_IMPORT_XLSX_MAX_UNZIPPED_SIZE']
    : [limits.maxPartSize, 'NC_DATA_IMPORT_XLSX_MAX_PART_SIZE'];

  // 0xFFFFFFFF marks a ZIP64 size (real value ≥ 4 GB, held in the extra field).
  // Anything that large is already far past the limit — no need to parse it.
  if (uncompressedSize === UINT32_MAX || uncompressedSize > maxSize) {
    NcError.badRequest(
      `The uploaded spreadsheet is rejected: entry "${filename}" decompresses to an unsafe size, over the ${formatLimit(
        maxSize,
        envName,
      )}.`,
    );
  }

  if (
    !streamed &&
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
): { offset: number; end: number; entries: number } | null {
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
  let cdSize = buf.readUInt32LE(eocd + 12);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  let cdEnd = eocd;

  if (entries === 0xffff || cdSize === UINT32_MAX || cdOffset === UINT32_MAX) {
    // ZIP64: the locator precedes the EOCD and points at the ZIP64 EOCD.
    const locator = eocd - 20;
    if (
      locator < 0 ||
      buf.readUInt32LE(locator) !== ZIP64_EOCD_LOCATOR_SIGNATURE
    )
      return null;

    const z64 = Number(buf.readBigUInt64LE(locator + 8));
    if (
      z64 < 0 ||
      z64 + 56 > locator ||
      buf.readUInt32LE(z64) !== ZIP64_EOCD_SIGNATURE
    )
      return null;

    entries = Number(buf.readBigUInt64LE(z64 + 32));
    cdSize = Number(buf.readBigUInt64LE(z64 + 40));
    cdOffset = Number(buf.readBigUInt64LE(z64 + 48));
    cdEnd = z64;
  }

  if (cdOffset < 0 || cdOffset + cdSize !== cdEnd) return null;
  return { offset: cdOffset, end: cdEnd, entries };
}

function readCentralDirectory(
  buf: Buffer,
  limits: XlsxGuardLimits,
): {
  offset: number;
  entries: CentralEntry[];
} {
  const cd = findCentralDirectory(buf);
  if (!cd) rejectInvalidArchive();

  const entries: CentralEntry[] = [];
  let ptr = cd.offset;
  for (let i = 0; i < cd.entries; i++) {
    if (
      ptr + 46 > cd.end ||
      buf.readUInt32LE(ptr) !== CENTRAL_FILE_HEADER_SIGNATURE
    )
      rejectInvalidArchive();

    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const entry: CentralEntry = {
      filename: buf.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8'),
      compressedSize: buf.readUInt32LE(ptr + 20),
      uncompressedSize: buf.readUInt32LE(ptr + 24),
      localOffset: buf.readUInt32LE(ptr + 42),
    };

    assertEntrySafe(
      entry.filename,
      entry.compressedSize,
      entry.uncompressedSize,
      limits,
    );
    entries.push(entry);

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  if (ptr !== cd.end) rejectInvalidArchive();

  return { offset: cd.offset, entries };
}

/** Inflated byte count, stopping as soon as it passes `limit`. */
function inflatedSize(data: Buffer, limit: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const inflater = zlib.createInflateRaw();
    let size = 0;
    inflater.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        inflater.destroy();
        resolve(size);
      }
    });
    inflater.on('end', () => resolve(size));
    inflater.on('error', reject);
    inflater.end(data);
  });
}

/**
 * Throws NcError.badRequest unless the buffer is a well-formed ZIP whose
 * entries all inflate within the size and ratio limits.
 */
export async function assertXlsxNotDecompressionBomb(
  buf: Buffer,
  limits: XlsxGuardLimits = DEFAULT_LIMITS,
): Promise<void> {
  const cd = readCentralDirectory(buf, limits);
  const entries = [...cd.entries].sort((a, b) => a.localOffset - b.localOffset);

  const total = entries.reduce((sum, e) => sum + e.uncompressedSize, 0);
  if (total > limits.maxUnzippedSize) {
    NcError.badRequest(
      `The uploaded spreadsheet is rejected: it decompresses to an unsafe size, over the ${formatLimit(
        limits.maxUnzippedSize,
        'NC_DATA_IMPORT_XLSX_MAX_UNZIPPED_SIZE',
      )}.`,
    );
  }

  let cursor = 0;
  for (const entry of entries) {
    // local entries must tile the archive, so none can hide between them
    if (
      entry.localOffset !== cursor ||
      cursor + 30 > cd.offset ||
      buf.readUInt32LE(cursor) !== LOCAL_FILE_HEADER_SIGNATURE
    )
      rejectInvalidArchive();

    const flags = buf.readUInt16LE(cursor + 6);
    const method = buf.readUInt16LE(cursor + 8);
    const localCompressedSize = buf.readUInt32LE(cursor + 18);
    const dataStart =
      cursor +
      30 +
      buf.readUInt16LE(cursor + 26) +
      buf.readUInt16LE(cursor + 28);
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > cd.offset) rejectInvalidArchive();

    // unzipper reads the local size, or scans to the first descriptor
    // signature when a deferred-size entry leaves it at 0
    const hasDescriptor = (flags & FLAG_DATA_DESCRIPTOR) !== 0;
    if (hasDescriptor && localCompressedSize === 0) {
      if (buf.indexOf(DATA_DESCRIPTOR_SIGNATURE_BYTES, dataStart) !== dataEnd)
        rejectInvalidArchive();
    } else if (localCompressedSize !== entry.compressedSize) {
      rejectInvalidArchive();
    }

    cursor = dataEnd;
    if (hasDescriptor) {
      if (
        cursor + 16 > cd.offset ||
        buf.readUInt32LE(cursor) !== DATA_DESCRIPTOR_SIGNATURE
      )
        rejectInvalidArchive();
      cursor += 16;
    }

    // unzipper inflates every non-stored entry, whatever the method says; the
    // declared size was already bounded, so stop as soon as the entry passes it
    let size = entry.compressedSize;
    if (method !== 0) {
      size = await inflatedSize(
        buf.subarray(dataStart, dataEnd),
        entry.uncompressedSize,
      ).catch(() => rejectInvalidArchive());
    }
    if (size !== entry.uncompressedSize) rejectInvalidArchive();
  }

  if (cursor !== cd.offset) rejectInvalidArchive();
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

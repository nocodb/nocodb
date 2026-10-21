/**
 * The one-file tar Docker's archive endpoints speak: enough to write a file
 * into a container with an owner, and to read one back out.
 */

const BLOCK = 512;
/** The largest value a 7-digit octal header field holds. */
const MAX_ID = 0o7777777;

/** A tar that is not one readable regular file: a directory, a link, or a broken archive. */
export class TarError extends Error {}

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, '0') + '\0';
}

export function packFile(name: string, data: Buffer, opts: { mode: number; uid: number; gid: number }): Buffer {
  if (Buffer.byteLength(name) > 100) throw new Error('file name longer than 100 bytes');
  if (!name || name.endsWith('/')) throw new Error('file name must not be empty or end in /');
  for (const [field, value, max] of [
    ['mode', opts.mode, 0o7777],
    ['uid', opts.uid, MAX_ID],
    ['gid', opts.gid, MAX_ID],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`${field} out of range: ${value}`);
  }

  const header = Buffer.alloc(BLOCK);
  header.write(name, 0, 100, 'utf8');
  header.write(octal(opts.mode, 8), 100);
  header.write(octal(opts.uid, 8), 108);
  header.write(octal(opts.gid, 8), 116);
  header.write(octal(data.length, 12), 124);
  header.write(octal(Math.floor(Date.now() / 1000), 12), 136);
  header.write('        ', 148); // checksum is computed over spaces here
  header.write('0', 156); // regular file
  header.write('ustar\0' + '00', 257);

  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(octal(sum, 7) + ' ', 148);

  const padding = Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK);
  return Buffer.concat([header, data, padding, Buffer.alloc(BLOCK * 2)]);
}

/**
 * The file GET /archive returns for a file path: its first entry, past any
 * pax/long-name headers. A directory or link at that path is refused, not
 * searched for a file inside it.
 */
export function firstFile(tar: Buffer): Buffer {
  let offset = 0;
  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) break;
    const field = header.subarray(124, 136).toString('latin1').replace(/\0.*$/s, '').trim();
    const body = offset + BLOCK;
    if (!/^[0-7]+$/.test(field || '0')) throw new TarError('bad size in archive');
    const size = Number.parseInt(field || '0', 8);
    if (size > tar.length - body) throw new TarError('truncated archive');
    const type = String.fromCharCode(header[156] ?? 48);
    if (type === '0' || type === '\0') return tar.subarray(body, body + size);
    // Metadata for the next entry (pax, GNU long name/link): skip to it.
    if (!['x', 'g', 'L', 'K'].includes(type)) {
      throw new TarError(type === '5' ? 'is a directory' : type === '2' || type === '1' ? 'is a link' : 'not a regular file');
    }
    offset = body + Math.ceil(size / BLOCK) * BLOCK;
  }
  throw new TarError('no file in archive');
}

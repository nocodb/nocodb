/**
 * The one-file tar Docker's archive endpoints speak: enough to write a file
 * into a container with an owner, and to read one back out.
 */

const BLOCK = 512;

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, '0') + '\0';
}

export function packFile(name: string, data: Buffer, opts: { mode: number; uid: number; gid: number }): Buffer {
  if (Buffer.byteLength(name) > 100) throw new Error('file name longer than 100 bytes');

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

/** The first regular file in a tar: what GET /archive returns for a file path. */
export function firstFile(tar: Buffer): Buffer {
  let offset = 0;
  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) break;
    const size = Number.parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim() || '0', 8);
    const type = String.fromCharCode(header[156] ?? 48);
    const body = offset + BLOCK;
    if (type === '0' || type === '\0') return tar.subarray(body, body + size);
    offset = body + Math.ceil(size / BLOCK) * BLOCK;
  }
  throw new Error('no file in archive');
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firstFile, packFile, TarError } from '../../src/tar.ts';

const opts = { mode: 0o644, uid: 1000, gid: 1000 };

/** A packed file whose header field at `offset` is overwritten with `value` (NUL-padded to `width`). */
const withField = (offset: number, width: number, value: string): Buffer => {
  const tar = packFile('f.txt', Buffer.from('hello'), opts);
  tar.fill(0, offset, offset + width);
  tar.write(value, offset, width, 'latin1');
  return tar;
};

describe('packFile → firstFile', () => {
  for (const size of [0, 1, 511, 512, 513, 2048]) {
    it(`round-trips ${size} bytes`, () => {
      const data = Buffer.alloc(size, 0x61);
      const tar = packFile('f.bin', data, opts);
      assert.equal(tar.length % 512, 0);
      assert.deepEqual(firstFile(tar), data);
    });
  }

  it('round-trips a 100-byte name and a multibyte one', () => {
    for (const name of ['n'.repeat(100), 'é'.repeat(50), 'файл.txt']) {
      const tar = packFile(name, Buffer.from('x'), opts);
      assert.equal(tar.subarray(0, 100).toString('utf8').replace(/\0+$/, ''), name);
      assert.deepEqual(firstFile(tar), Buffer.from('x'));
    }
  });

  it('writes a valid ustar checksum', () => {
    const tar = packFile('f', Buffer.from('x'), opts);
    const header = Buffer.from(tar.subarray(0, 512));
    const stored = Number.parseInt(header.subarray(148, 156).toString('latin1'), 8);
    header.fill(0x20, 148, 156);
    let sum = 0;
    for (const byte of header) sum += byte;
    assert.equal(stored, sum);
  });

  it('skips a pax header before the file', () => {
    const paxBody = Buffer.from('30 path=some/long/name/file.txt\n');
    const pax = packFile('PaxHeader', paxBody, opts);
    pax.write('x', 156);
    // Drop the pax archive's end-of-archive blocks.
    const paxEntry = pax.subarray(0, 512 + Math.ceil(paxBody.length / 512) * 512);
    const file = packFile('file.txt', Buffer.from('body'), opts);
    assert.deepEqual(firstFile(Buffer.concat([paxEntry, file])), Buffer.from('body'));
  });
});

describe('firstFile rejects', () => {
  const rejects = (tar: Buffer, message: RegExp) =>
    assert.throws(() => firstFile(tar), (e: unknown) => e instanceof TarError && message.test(e.message));

  it('a negative size', () => rejects(withField(124, 12, '-1'), /bad size/));
  it('a non-octal size', () => rejects(withField(124, 12, '00000000009'), /bad size/));
  it('a size past the end of the archive', () => rejects(withField(124, 12, '77777777777'), /truncated/));
  it('a directory', () => rejects(withField(156, 1, '5'), /is a directory/));
  it('a symlink', () => rejects(withField(156, 1, '2'), /is a link/));
  it('a hard link', () => rejects(withField(156, 1, '1'), /is a link/));
  it('a fifo', () => rejects(withField(156, 1, '6'), /not a regular file/));
  it('an empty archive', () => rejects(Buffer.alloc(1024), /no file/));
  it('a pax header with nothing after it', () => {
    const pax = packFile('PaxHeader', Buffer.from('x'), opts);
    pax.write('x', 156);
    rejects(pax, /no file/);
  });
});

describe('packFile rejects', () => {
  const data = Buffer.from('x');
  it('a name over 100 bytes', () => {
    assert.throws(() => packFile('n'.repeat(101), data, opts), /longer than 100/);
    // 51 two-byte characters: 102 bytes.
    assert.throws(() => packFile('é'.repeat(51), data, opts), /longer than 100/);
  });
  it('an empty name or one ending in /', () => {
    assert.throws(() => packFile('', data, opts), /empty or end in/);
    assert.throws(() => packFile('dir/', data, opts), /empty or end in/);
  });
  for (const [field, bad] of [
    ['mode', [-1, 0o10000, 1.5, Number.NaN]],
    ['uid', [-1, 0o10000000, 2.5]],
    ['gid', [-1, 0o10000000, Number.POSITIVE_INFINITY]],
  ] as const) {
    it(`an out-of-range ${field}`, () => {
      for (const value of bad) {
        assert.throws(() => packFile('f', data, { ...opts, [field]: value }), new RegExp(`${field} out of range`));
      }
    });
  }
  it('accepts the largest uid/gid and mode', () => {
    const tar = packFile('f', data, { mode: 0o7777, uid: 0o7777777, gid: 0o7777777 });
    assert.deepEqual(firstFile(tar), data);
  });
});

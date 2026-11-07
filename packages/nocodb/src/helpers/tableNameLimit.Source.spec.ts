import {
  measureTableName,
  physicalTableNameCandidate,
  tableNameTooLongMessage,
} from './tableNameLimit';

const cjk = (n: number) => '字'.repeat(n);
const emoji = (n: number) => '😀'.repeat(n);

describe('measureTableName', () => {
  test('pg counts UTF-8 bytes, so 22 CJK characters exceed NAMEDATALEN', () => {
    // '字' is 3 bytes. 22 * 3 = 66 > 63, while .length is only 22.
    expect(measureTableName(cjk(22), 'pg')).toBe(66);
    expect(cjk(22).length).toBe(22);
  });

  test('pg accepts 21 CJK characters, which are exactly 63 bytes', () => {
    expect(measureTableName(cjk(21), 'pg')).toBe(63);
  });

  test('pg ASCII length matches the character count', () => {
    expect(measureTableName('a'.repeat(63), 'pg')).toBe(63);
    expect(measureTableName('a'.repeat(64), 'pg')).toBe(64);
  });

  test('oracledb counts UTF-8 bytes against the 125-byte budget', () => {
    // 42 * 3 = 126 > 125; 41 * 3 = 123 <= 125. .length would allow both.
    expect(measureTableName(cjk(42), 'oracledb')).toBe(126);
    expect(measureTableName(cjk(41), 'oracledb')).toBe(123);
  });

  test('mysql and mssql keep counting UTF-16 code units', () => {
    expect(measureTableName(cjk(40), 'mysql2')).toBe(40);
    expect(measureTableName(cjk(40), 'mysql')).toBe(40);
    expect(measureTableName(cjk(40), 'mssql')).toBe(40);
    // An emoji is one code point and two UTF-16 code units. The historical
    // check uses `.length`, so the mysql path must stay at 2 per emoji.
    expect(measureTableName(emoji(16), 'mysql2')).toBe(32);
  });

  test('pg counts an emoji as 4 bytes', () => {
    expect(measureTableName(emoji(16), 'pg')).toBe(64);
    expect(emoji(16).length).toBe(32);
  });
});

describe('tableNameTooLongMessage', () => {
  test('names the unit the dialect actually counts', () => {
    expect(tableNameTooLongMessage(63, 'pg')).toBe(
      'Table name exceeds 63 bytes',
    );
    expect(tableNameTooLongMessage(125, 'oracledb')).toBe(
      'Table name exceeds 125 bytes',
    );
    expect(tableNameTooLongMessage(64, 'mysql2')).toBe(
      'Table name exceeds 64 characters',
    );
    expect(tableNameTooLongMessage(125, 'mssql')).toBe(
      'Table name exceeds 125 characters',
    );
  });
});

describe('physicalTableNameCandidate', () => {
  test('pg trims an in-limit CJK name so the suffix stays within 63 bytes', () => {
    const name = physicalTableNameCandidate(cjk(21), '_1', 63, 'pg');
    expect(Buffer.byteLength(name, 'utf8')).toBeLessThanOrEqual(63);
    expect(name.endsWith('_1')).toBe(true);
    // 21 CJK characters are 63 bytes, so at least one has to go.
    expect(name.startsWith(cjk(21))).toBe(false);
    expect(name).not.toMatch(/[\uD800-\uDFFF]/);
  });

  test('pg does not shorten a name that is already over the byte limit', () => {
    // 62 CJK characters are 186 bytes. Character slicing would keep 61 of
    // them plus `_1` (`.length` 63) and the name would still be 185 bytes.
    const desired = cjk(62);
    expect(physicalTableNameCandidate(desired, '_1', 63, 'pg')).toBe(
      `${desired}_1`,
    );
  });

  test('pg drops a trailing character that would cross the byte budget', () => {
    // 15 emoji (60 bytes) plus '字' (3) is 63 bytes, inside the limit, but
    // `_1` leaves a 61-byte budget and '字' does not fit in the last byte.
    const desired = emoji(15) + '字';
    const name = physicalTableNameCandidate(desired, '_1', 63, 'pg');
    expect(name).toBe(`${emoji(15)}_1`);
    expect(Buffer.byteLength(name, 'utf8')).toBeLessThanOrEqual(63);
  });

  test('pg keeps a short multibyte name whole when the suffix fits', () => {
    expect(physicalTableNameCandidate(cjk(10), '_1', 63, 'pg')).toBe(
      `${cjk(10)}_1`,
    );
  });

  test('pg ASCII trim matches the previous code-point slice', () => {
    expect(physicalTableNameCandidate('a'.repeat(63), '_1', 63, 'pg')).toBe(
      `${'a'.repeat(61)}_1`,
    );
  });

  test('mysql trim still slices by code point, including astral characters', () => {
    expect(physicalTableNameCandidate('a'.repeat(64), '_1', 64, 'mysql2')).toBe(
      `${'a'.repeat(62)}_1`,
    );
    expect(physicalTableNameCandidate(emoji(30), '_1', 64, 'mysql2')).toBe(
      `${emoji(30)}_1`,
    );
    expect(physicalTableNameCandidate('a'.repeat(65), '_1', 64, 'mysql2')).toBe(
      `${'a'.repeat(65)}_1`,
    );
  });
});

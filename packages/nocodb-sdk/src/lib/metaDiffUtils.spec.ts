import { isColumnTypeChanged } from './metaDiffUtils';

describe('isColumnTypeChanged', () => {
  // ── Generic dt change (all dialects) ──────────────────────────────────────

  it('returns true when dt changes', () => {
    expect(
      isColumnTypeChanged('pg', { dt: 'text' }, { dt: 'character varying' }),
    ).toBe(true);
  });

  it('returns false when dt and dtxp are both unchanged', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'character varying', dtxp: 100 },
        { dt: 'character varying', dtxp: 100 },
      ),
    ).toBe(false);
  });

  // ── PostgreSQL: text → varchar ────────────────────────────────────────────

  it('PG: detects text → character varying', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'text', dtxp: null },
        { dt: 'character varying', dtxp: 1 },
      ),
    ).toBe(true);
  });

  it('PG: no false-positive for text → text (no change)', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'text', dtxp: null },
        { dt: 'text', dtxp: null },
      ),
    ).toBe(false);
  });

  it('PG: detects character varying → text', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'character varying', dtxp: 100 },
        { dt: 'text', dtxp: null },
      ),
    ).toBe(true);
  });

  // ── PostgreSQL: varchar length change ─────────────────────────────────────

  it('PG: detects varchar(100) → varchar(1) as type change', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'character varying', dtxp: 100 },
        { dt: 'character varying', dtxp: 1 },
      ),
    ).toBe(true);
  });

  it('PG: detects varchar(1) → varchar(100)', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'character varying', dtxp: 1 },
        { dt: 'character varying', dtxp: 100 },
      ),
    ).toBe(true);
  });

  it('PG: detects unbounded varchar → varchar(255)', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'character varying', dtxp: null },
        { dt: 'character varying', dtxp: 255 },
      ),
    ).toBe(true);
  });

  it('PG: detects varchar(255) → unbounded varchar', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'character varying', dtxp: 255 },
        { dt: 'character varying', dtxp: null },
      ),
    ).toBe(true);
  });

  it('PG: no false-positive when varchar length unchanged (number vs string coercion)', () => {
    // NocoDB stores dtxp as a string in its metadata DB; PostgreSQL returns
    // an integer.  The comparison must treat '100' and 100 as the same.
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'character varying', dtxp: '100' },
        { dt: 'character varying', dtxp: 100 },
      ),
    ).toBe(false);
  });

  it('PG: no false-positive when varchar length is both null', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'character varying', dtxp: null },
        { dt: 'character varying', dtxp: null },
      ),
    ).toBe(false);
  });

  // ── PostgreSQL: char(n) ───────────────────────────────────────────────────

  it('PG: detects char(1) → char(10)', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'char', dtxp: 1 },
        { dt: 'char', dtxp: 10 },
      ),
    ).toBe(true);
  });

  it('PG: no false-positive for char length unchanged', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'char', dtxp: 5 },
        { dt: 'char', dtxp: 5 },
      ),
    ).toBe(false);
  });

  // ── PostgreSQL: text (no length parameter) ────────────────────────────────

  it('PG: no false-positive for two text columns (both dtxp null/undefined)', () => {
    // text has no character_maximum_length; dtxp is always null/undefined
    expect(
      isColumnTypeChanged(
        'pg',
        { dt: 'text', dtxp: null },
        { dt: 'text', dtxp: undefined },
      ),
    ).toBe(false);
  });

  // ── PostgreSQL: native enum ───────────────────────────────────────────────

  it('PG: detects native enum option list change', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        {
          dt: 'USER-DEFINED',
          dtxp: 'a,b',
          udt_typtype: 'e',
          internal_meta: { pg_enum_type_name: 'mood' },
        },
        {
          dt: 'USER-DEFINED',
          dtxp: 'a,b,c',
          udt_typtype: 'e',
          data_type_custom: 'mood',
        },
      ),
    ).toBe(true);
  });

  it('PG: detects native enum type rename (different data_type_custom)', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        {
          dt: 'USER-DEFINED',
          dtxp: 'a,b',
          udt_typtype: 'e',
          internal_meta: { pg_enum_type_name: 'mood' },
        },
        {
          dt: 'USER-DEFINED',
          dtxp: 'a,b',
          udt_typtype: 'e',
          data_type_custom: 'status',
        },
      ),
    ).toBe(true);
  });

  it('PG: no false-positive for unchanged native enum', () => {
    expect(
      isColumnTypeChanged(
        'pg',
        {
          dt: 'USER-DEFINED',
          dtxp: 'a,b',
          udt_typtype: 'e',
          internal_meta: { pg_enum_type_name: 'mood' },
        },
        {
          dt: 'USER-DEFINED',
          dtxp: 'a,b',
          udt_typtype: 'e',
          data_type_custom: 'mood',
        },
      ),
    ).toBe(false);
  });

  // ── MySQL: enum / set ─────────────────────────────────────────────────────

  it('MySQL: detects enum option list change', () => {
    expect(
      isColumnTypeChanged(
        'mysql2',
        { dt: 'enum', dtxp: "'a','b'" },
        { dt: 'enum', dtxp: "'a','b','c'" },
      ),
    ).toBe(true);
  });

  it('MySQL: no false-positive for enum unchanged', () => {
    expect(
      isColumnTypeChanged(
        'mysql2',
        { dt: 'enum', dtxp: "'a','b'" },
        { dt: 'enum', dtxp: "'a','b'" },
      ),
    ).toBe(false);
  });

  // ── MySQL: varchar dtxp NOT compared (no regression) ─────────────────────

  it('MySQL: does NOT flag varchar length change (PG-only length check)', () => {
    // The PG-only condition must not fire for MySQL sources.
    expect(
      isColumnTypeChanged(
        'mysql2',
        { dt: 'varchar', dtxp: 100 },
        { dt: 'varchar', dtxp: 1 },
      ),
    ).toBe(false);
  });

  // ── SQLite ────────────────────────────────────────────────────────────────

  it('SQLite: detects dt change', () => {
    expect(
      isColumnTypeChanged('sqlite3', { dt: 'TEXT' }, { dt: 'INTEGER' }),
    ).toBe(true);
  });

  it('SQLite: no false-positive when dt unchanged', () => {
    expect(
      isColumnTypeChanged('sqlite3', { dt: 'TEXT' }, { dt: 'TEXT' }),
    ).toBe(false);
  });
});

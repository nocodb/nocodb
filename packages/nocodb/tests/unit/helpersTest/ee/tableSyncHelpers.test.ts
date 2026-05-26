import 'mocha';
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import {
  buildSyncSystemFields,
  extractShareUuid,
  extractSourcePk,
  normalizeLinkValue,
  REMAP_UIDTS,
  toDestColumnDef,
} from '~/modules/table-sync/table-sync.helpers';

/**
 * Pure-function unit tests for table-sync helpers.
 *
 * These run without any DB / Nest setup, so failures here surface
 * issues in pure transforms before the slower integration suite catches
 * them. Anything here that breaks usually means a downstream replication
 * test will break too — fix here first.
 */
export function tableSyncHelpersTests() {
  describe('table-sync helpers', () => {
    describe('REMAP_UIDTS', () => {
      it('Formula → SingleLineText (text snapshot of formula value)', () => {
        expect(REMAP_UIDTS[UITypes.Formula]).to.eq(UITypes.SingleLineText);
      });
      it('Lookup → LongText (flatten arrays/objects to text)', () => {
        expect(REMAP_UIDTS[UITypes.Lookup]).to.eq(UITypes.LongText);
      });
      it('Rollup → SingleLineText (aggregate snapshot as text)', () => {
        expect(REMAP_UIDTS[UITypes.Rollup]).to.eq(UITypes.SingleLineText);
      });
      it('User / CreatedBy / LastModifiedBy → SingleLineText', () => {
        expect(REMAP_UIDTS[UITypes.User]).to.eq(UITypes.SingleLineText);
        expect(REMAP_UIDTS[UITypes.CreatedBy]).to.eq(UITypes.SingleLineText);
        expect(REMAP_UIDTS[UITypes.LastModifiedBy]).to.eq(
          UITypes.SingleLineText,
        );
      });
      it('CreatedTime / LastModifiedTime → DateTime', () => {
        expect(REMAP_UIDTS[UITypes.CreatedTime]).to.eq(UITypes.DateTime);
        expect(REMAP_UIDTS[UITypes.LastModifiedTime]).to.eq(UITypes.DateTime);
      });
      it('untouched uidts (e.g. SingleLineText, Number) are NOT in the remap', () => {
        expect(REMAP_UIDTS[UITypes.SingleLineText]).to.eq(undefined);
        expect(REMAP_UIDTS[UITypes.Number]).to.eq(undefined);
      });
    });

    describe('toDestColumnDef', () => {
      it('copies title + column_name; sets readonly=true', () => {
        const def = toDestColumnDef({
          title: 'Name',
          column_name: 'name',
          uidt: UITypes.SingleLineText,
        } as any);
        expect(def.title).to.eq('Name');
        expect(def.column_name).to.eq('name');
        expect(def.uidt).to.eq(UITypes.SingleLineText);
        expect(def.readonly).to.eq(true);
      });

      it('generates a sanitized column_name when source has none', () => {
        const def = toDestColumnDef({
          title: 'Customer Name!',
          uidt: UITypes.SingleLineText,
        } as any);
        expect(def.column_name).to.be.a('string');
        expect(def.column_name).to.not.eq('');
      });

      it('applies REMAP_UIDTS (Formula → SLT)', () => {
        const def = toDestColumnDef({
          title: 'Total',
          uidt: UITypes.Formula,
        } as any);
        expect(def.uidt).to.eq(UITypes.SingleLineText);
      });

      it('preserves pv=true when set on source', () => {
        const def = toDestColumnDef({
          title: 'Title',
          uidt: UITypes.SingleLineText,
          pv: true,
        } as any);
        expect(def.pv).to.eq(true);
      });

      it('does NOT set pv when source has no pv flag', () => {
        const def = toDestColumnDef({
          title: 'Other',
          uidt: UITypes.SingleLineText,
        } as any);
        expect(def.pv).to.eq(undefined);
      });

      it('filters out empty/missing option titles for select cols', () => {
        const def = toDestColumnDef({
          title: 'Status',
          uidt: UITypes.SingleSelect,
          colOptions: {
            options: [
              { title: 'Open' },
              { title: '' },
              { title: undefined as any },
              { title: 'Closed' },
            ],
          },
        } as any);
        expect(def.colOptions?.options.map((o) => o.title)).to.deep.eq([
          'Open',
          'Closed',
        ]);
      });
    });

    describe('extractShareUuid', () => {
      it('returns the raw UUID-like string as-is', () => {
        expect(extractShareUuid('vw1234abcd')).to.eq('vw1234abcd');
      });

      it('extracts UUID from a full share URL', () => {
        expect(
          extractShareUuid(
            'https://app.nocodb.com/dashboard/#/nc/view/abcd-1234-uuid/details',
          ),
        ).to.eq('abcd-1234-uuid');
      });

      it('strips query/fragment from extracted UUID', () => {
        expect(
          extractShareUuid('https://app/nc/view/u123?password=x'),
        ).to.eq('u123');
        expect(extractShareUuid('https://app/nc/view/u456#anchor')).to.eq(
          'u456',
        );
      });

      it('returns null for empty / garbage input', () => {
        expect(extractShareUuid('')).to.eq(null);
        expect(extractShareUuid('   ')).to.eq(null);
        expect(extractShareUuid('not a url with slash/inside')).to.eq(null);
      });

      it('trims surrounding whitespace before matching', () => {
        expect(extractShareUuid('  vwxyz12345  ')).to.eq('vwxyz12345');
      });
    });

    describe('extractSourcePk', () => {
      it('returns string-coerced PK value', () => {
        expect(extractSourcePk({ Id: 42 }, 'Id')).to.eq('42');
        expect(extractSourcePk({ Id: 'abc' }, 'Id')).to.eq('abc');
      });

      it('returns null for missing PK', () => {
        expect(extractSourcePk({}, 'Id')).to.eq(null);
      });

      it('treats empty string and null as "missing"', () => {
        expect(extractSourcePk({ Id: '' }, 'Id')).to.eq(null);
        expect(extractSourcePk({ Id: null }, 'Id')).to.eq(null);
      });

      it('respects custom pkTitle', () => {
        expect(extractSourcePk({ RowId: 99 }, 'RowId')).to.eq('99');
        expect(extractSourcePk({ Id: 1, RowId: 2 }, 'RowId')).to.eq('2');
      });
    });

    describe('normalizeLinkValue', () => {
      it('extracts ids from V2 array-of-objects shape', () => {
        const out = normalizeLinkValue(
          [
            { Id: 1, Title: 'A' },
            { Id: 2, Title: 'B' },
          ],
          'Id',
        );
        expect(out.sort()).to.deep.eq(['1', '2']);
      });

      it('tolerates primitive ids inside the array', () => {
        const out = normalizeLinkValue([1, 'abc', 3], 'Id');
        expect(out.sort()).to.deep.eq(['1', '3', 'abc']);
      });

      it('dedupes repeated ids', () => {
        const out = normalizeLinkValue(
          [{ Id: 1 }, { Id: 1 }, { Id: 2 }, 1],
          'Id',
        );
        expect(out.sort()).to.deep.eq(['1', '2']);
      });

      it('filters out null / undefined / empty entries', () => {
        const out = normalizeLinkValue(
          [{ Id: 1 }, null, undefined, '', { Id: '' }],
          'Id',
        );
        expect(out).to.deep.eq(['1']);
      });

      it('returns [] for null/undefined input (NOT "field missing" — caller distinguishes)', () => {
        expect(normalizeLinkValue(null)).to.deep.eq([]);
        expect(normalizeLinkValue(undefined)).to.deep.eq([]);
      });

      it('accepts a single (non-array) object as input', () => {
        expect(normalizeLinkValue({ Id: 5 }, 'Id')).to.deep.eq(['5']);
      });

      it('falls back to Id field when parentPkTitle is custom but Id present', () => {
        const out = normalizeLinkValue(
          [{ Id: 1 }, { CustomPk: 2 }],
          'CustomPk',
        );
        // Both entries resolve: CustomPk=2 directly, Id=1 via fallback.
        expect(out.sort()).to.deep.eq(['1', '2']);
      });

      it('falls back to lowercase id field', () => {
        const out = normalizeLinkValue([{ id: 7 }], 'Id');
        expect(out).to.deep.eq(['7']);
      });

      it('skips objects with no resolvable id', () => {
        const out = normalizeLinkValue(
          [{ Id: 1 }, { OnlyTitle: 'x' }, { Id: 2 }],
          'Id',
        );
        expect(out.sort()).to.deep.eq(['1', '2']);
      });
    });

    describe('buildSyncSystemFields', () => {
      const runMeta = {
        syncId: 'sync-1',
        runId: 'run-1',
        syncedAtIso: '2026-01-01T00:00:00.000Z',
        namespace: 'src-table/src-view',
      };

      it('emits RemoteId / RemoteRaw / sync metadata', () => {
        const out = buildSyncSystemFields({
          sourceId: 'abc',
          record: { foo: 'bar' },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          runMeta,
        });
        expect(out.RemoteId).to.eq('abc');
        expect(out.RemoteRaw).to.eq(JSON.stringify({ foo: 'bar' }));
        expect(out.RemoteCreatedAt).to.eq('2026-01-01');
        expect(out.RemoteUpdatedAt).to.eq('2026-01-02');
        expect(out.RemoteSyncedAt).to.eq(runMeta.syncedAtIso);
        expect(out.RemoteNamespace).to.eq(runMeta.namespace);
        expect(out.SyncConfigId).to.eq(runMeta.syncId);
        expect(out.SyncRunId).to.eq(runMeta.runId);
        expect(out.SyncProvider).to.eq('nocodb-table-sync');
      });

      it('null timestamps surface as null (not undefined)', () => {
        const out = buildSyncSystemFields({
          sourceId: 'x',
          record: {},
          createdAt: null,
          updatedAt: null,
          runMeta,
        });
        expect(out.RemoteCreatedAt).to.eq(null);
        expect(out.RemoteUpdatedAt).to.eq(null);
      });

      it('default RemoteDeleted=false; RemoteDeletedTime=null', () => {
        const out = buildSyncSystemFields({
          sourceId: 'x',
          record: {},
          createdAt: null,
          updatedAt: null,
          runMeta,
        });
        expect(out.RemoteDeleted).to.eq(false);
        expect(out.RemoteDeletedTime).to.eq(null);
      });

      it('honors deleted / deletedAt overrides', () => {
        const out = buildSyncSystemFields({
          sourceId: 'x',
          record: {},
          createdAt: null,
          updatedAt: null,
          runMeta,
          deleted: true,
          deletedAt: '2026-02-01T00:00:00.000Z',
        });
        expect(out.RemoteDeleted).to.eq(true);
        expect(out.RemoteDeletedTime).to.eq('2026-02-01T00:00:00.000Z');
      });
    });
  });
}

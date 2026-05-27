import 'mocha';
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import {
  buildSyncSystemFields,
  extractShareUuid,
  extractSourcePk,
  normalizeLinkValue,
  REMAP_UIDTS,
  SYSTEM_REMOTE_TITLES,
  toDestColumnDef,
  toDestRow,
} from '~/modules/table-sync/table-sync.helpers';
import type {
  ColumnPlan,
  SyncRunMeta,
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
      it('UUID → SingleLineText (mirror value, not a re-generated uuid)', () => {
        expect(REMAP_UIDTS[UITypes.UUID]).to.eq(UITypes.SingleLineText);
      });
      it('AutoNumber → Number (mirror value, not a re-incremented seq)', () => {
        expect(REMAP_UIDTS[UITypes.AutoNumber]).to.eq(UITypes.Number);
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

    describe('SYSTEM_REMOTE_TITLES', () => {
      it('is a Set of the Remote*/Sync* system field titles', () => {
        expect(SYSTEM_REMOTE_TITLES).to.be.instanceOf(Set);
        expect(SYSTEM_REMOTE_TITLES.has('RemoteId')).to.eq(true);
        expect(SYSTEM_REMOTE_TITLES.has('RemoteDeleted')).to.eq(true);
        expect(SYSTEM_REMOTE_TITLES.has('SyncProvider')).to.eq(true);
      });

      it('does NOT contain ordinary user-field titles', () => {
        expect(SYSTEM_REMOTE_TITLES.has('Title')).to.eq(false);
        expect(SYSTEM_REMOTE_TITLES.has('Note')).to.eq(false);
      });
    });

    describe('toDestRow', () => {
      const runMeta: SyncRunMeta = {
        syncId: 'sync-1',
        runId: 'run-1',
        syncedAtIso: '2026-01-01T00:00:00.000Z',
        namespace: 'src-table/src-view',
      };

      function makePlan(overrides: Partial<ColumnPlan> = {}): ColumnPlan {
        return {
          orderTitle: null,
          forwardFields: [],
          createdAtTitle: null,
          updatedAtTitle: null,
          sourcePkTitle: 'Id',
          linkPlans: [],
          ...overrides,
        };
      }

      it('copies forward fields and appends sync system fields', () => {
        const plan = makePlan({
          forwardFields: [{ sourceTitle: 'Title', destTitle: 'Title' }],
        });
        const out = toDestRow({ Title: 'Acme', Id: 7 }, plan, '7', runMeta);
        expect(out.Title).to.eq('Acme');
        expect(out.RemoteId).to.eq('7');
        expect(out.RemoteRaw).to.eq(JSON.stringify({ Title: 'Acme', Id: 7 }));
        expect(out.SyncProvider).to.eq('nocodb-table-sync');
        expect(out.RemoteDeleted).to.eq(false);
        expect(out.RemoteSyncedAt).to.eq(runMeta.syncedAtIso);
      });

      it('skips forward fields whose sourceTitle is absent from the row', () => {
        const plan = makePlan({
          forwardFields: [
            { sourceTitle: 'Title', destTitle: 'Title' },
            { sourceTitle: 'Missing', destTitle: 'Missing' },
          ],
        });
        const out = toDestRow({ Title: 'Acme' }, plan, '1', runMeta);
        expect(out).to.have.property('Title', 'Acme');
        expect(out).to.not.have.property('Missing');
      });

      it('reads sourceTitle but writes to a decoupled destTitle (source-rename survival)', () => {
        const plan = makePlan({
          forwardFields: [{ sourceTitle: 'Notes', destTitle: 'Note' }],
        });
        const out = toDestRow({ Notes: 'hello' }, plan, '1', runMeta);
        expect(out.Note).to.eq('hello');
        expect(out).to.not.have.property('Notes');
      });

      it('passes a value through untouched when displayTitles is omitted (even arrays)', () => {
        const arr = [{ Id: 1 }];
        const plan = makePlan({
          forwardFields: [{ sourceTitle: 'Links', destTitle: 'Links' }],
        });
        const out = toDestRow({ Links: arr }, plan, '1', runMeta);
        // No flattening — the raw reference is preserved verbatim.
        expect(out.Links).to.eq(arr);
      });

      it('flattens an array of objects to comma text using displayTitles', () => {
        const plan = makePlan({
          forwardFields: [
            { sourceTitle: 'Orders', destTitle: 'Orders', displayTitles: ['Title'] },
          ],
        });
        const out = toDestRow(
          { Orders: [{ Title: 'A' }, { Title: 'B' }] },
          plan,
          '1',
          runMeta,
        );
        expect(out.Orders).to.eq('A, B');
      });

      it('renders objects as empty string when displayTitles is null', () => {
        const plan = makePlan({
          forwardFields: [
            { sourceTitle: 'Orders', destTitle: 'Orders', displayTitles: null },
          ],
        });
        const out = toDestRow(
          { Orders: [{ Title: 'A' }, { Title: 'B' }] },
          plan,
          '1',
          runMeta,
        );
        expect(out.Orders).to.eq('');
      });

      it('skips unresolvable objects without leaving double commas (mixed array)', () => {
        const plan = makePlan({
          forwardFields: [
            { sourceTitle: 'Orders', destTitle: 'Orders', displayTitles: ['Title'] },
          ],
        });
        const out = toDestRow(
          { Orders: [{ Title: 'A' }, { Other: 'x' }, { Title: 'B' }] },
          plan,
          '1',
          runMeta,
        );
        expect(out.Orders).to.eq('A, B');
      });

      it('flattens primitive array items directly (no display title needed)', () => {
        const plan = makePlan({
          forwardFields: [
            { sourceTitle: 'Tags', destTitle: 'Tags', displayTitles: ['Title'] },
          ],
        });
        const out = toDestRow({ Tags: [1, 'two', 3] }, plan, '1', runMeta);
        expect(out.Tags).to.eq('1, two, 3');
      });

      it('treats a single non-array object as a one-item list', () => {
        const plan = makePlan({
          forwardFields: [
            {
              sourceTitle: 'Owner',
              destTitle: 'Owner',
              displayTitles: ['display_name', 'email'],
            },
          ],
        });
        const out = toDestRow(
          { Owner: { email: 'a@b.com' } },
          plan,
          '1',
          runMeta,
        );
        // display_name is absent → falls through to email.
        expect(out.Owner).to.eq('a@b.com');
      });

      it('resolves boolean display values', () => {
        const plan = makePlan({
          forwardFields: [
            { sourceTitle: 'Flags', destTitle: 'Flags', displayTitles: ['active'] },
          ],
        });
        const out = toDestRow(
          { Flags: [{ active: true }, { active: false }] },
          plan,
          '1',
          runMeta,
        );
        expect(out.Flags).to.eq('true, false');
      });

      it('passes a primitive value through unchanged even when displayTitles is set', () => {
        const plan = makePlan({
          forwardFields: [
            { sourceTitle: 'Name', destTitle: 'Name', displayTitles: ['Title'] },
          ],
        });
        const out = toDestRow({ Name: 'plain' }, plan, '1', runMeta);
        expect(out.Name).to.eq('plain');
      });

      it('copies the order column when present and non-empty', () => {
        const plan = makePlan({ orderTitle: 'nc_order' });
        const out = toDestRow({ nc_order: 3 }, plan, '1', runMeta);
        expect(out.nc_order).to.eq(3);
      });

      it('skips the order column when its value is empty string or null', () => {
        const plan = makePlan({ orderTitle: 'nc_order' });
        expect(
          toDestRow({ nc_order: '' }, plan, '1', runMeta),
        ).to.not.have.property('nc_order');
        expect(
          toDestRow({ nc_order: null }, plan, '1', runMeta),
        ).to.not.have.property('nc_order');
      });

      it('does not copy an order column that is absent from the row', () => {
        const plan = makePlan({ orderTitle: 'nc_order' });
        const out = toDestRow({ Title: 'x' }, plan, '1', runMeta);
        expect(out).to.not.have.property('nc_order');
      });

      it('lifts createdAt/updatedAt source titles onto the Remote timestamps', () => {
        const plan = makePlan({
          createdAtTitle: 'CreatedAt',
          updatedAtTitle: 'UpdatedAt',
        });
        const out = toDestRow(
          { CreatedAt: '2026-01-01', UpdatedAt: '2026-01-02' },
          plan,
          '1',
          runMeta,
        );
        expect(out.RemoteCreatedAt).to.eq('2026-01-01');
        expect(out.RemoteUpdatedAt).to.eq('2026-01-02');
      });

      it('createdAt/updatedAt titles absent from the row surface as null', () => {
        const plan = makePlan({
          createdAtTitle: 'CreatedAt',
          updatedAtTitle: 'UpdatedAt',
        });
        const out = toDestRow({}, plan, '1', runMeta);
        expect(out.RemoteCreatedAt).to.eq(null);
        expect(out.RemoteUpdatedAt).to.eq(null);
      });

      it('RemoteRaw is the JSON of the full source row, not the shaped output', () => {
        const plan = makePlan({
          forwardFields: [{ sourceTitle: 'Title', destTitle: 'DestTitle' }],
        });
        const row = { Title: 'x', Secret: 'y' };
        const out = toDestRow(row, plan, '9', runMeta);
        expect(out.RemoteRaw).to.eq(JSON.stringify(row));
        expect(out.DestTitle).to.eq('x');
      });
    });
  });
}

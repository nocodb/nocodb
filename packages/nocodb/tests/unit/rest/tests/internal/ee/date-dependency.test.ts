import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { UITypes } from 'nocodb-sdk';
import init from '../../../../init';
import { isEE } from '../../../../utils/helpers';
import { Base, Model } from '~/models';
import { RootScopes } from '~/utils/globals';

// ─── context helpers ──────────────────────────────────────────────────────────

type Context = Awaited<ReturnType<typeof init>>;

function api(ctx: Context) {
  return {
    /** xc-auth for data-plane endpoints */
    get:  (url: string) => request(ctx.app).get(url).set('xc-auth', ctx.token),
    post: (url: string, body?: any) => request(ctx.app).post(url).set('xc-auth', ctx.token).send(body ?? {}),
    patch:(url: string, body?: any) => request(ctx.app).patch(url).set('xc-auth', ctx.token).send(body ?? {}),
    /** xc-token for meta / internal endpoints */
    metaPost:(url: string, query: Record<string, any>, body?: any) =>
      request(ctx.app).post(url).set('xc-token', ctx.xc_token).query(query).send(body ?? {}),
    metaGet:(url: string, query?: Record<string, any>) =>
      request(ctx.app).get(url).set('xc-token', ctx.xc_token).query(query ?? {}),
  };
}

// ─── main suite ───────────────────────────────────────────────────────────────

export const dateDependencyTests = function () {
  if (!isEE()) {
    return true;
  }

  describe('Date Dependency', () => {
    let context: Context;
    let workspaceId: string;
    let baseId: string;
    let tableId: string;
    let startColId: string;
    let endColId: string;
    let durColId: string;
    let linkColId: string;  // HM self-referencing "Successors" column
    let INTERNAL_BASE: string;
    let DATA_BASE: string;

    // ── shared setup ──────────────────────────────────────────────────────────

    beforeEach(async () => {
      context = await init(false, 'editor', { skipSakila: true });
      workspaceId = context.fk_workspace_id!;
      const { metaPost } = api(context);

      const baseRes = await metaPost(`/api/v3/meta/workspaces/${workspaceId}/bases`, {}, { title: 'DateDepTestBase' }).expect(200);
      baseId = baseRes.body.id;
      INTERNAL_BASE = `/api/v2/internal/${workspaceId}/${baseId}`;

      const tableRes = await metaPost(`/api/v3/meta/bases/${baseId}/tables`, {}, {
        title: 'Tasks',
        fields: [
          { title: 'Title',      type: 'SingleLineText' },
          { title: 'Start Date', type: 'Date' },
          { title: 'End Date',   type: 'Date' },
          { title: 'Duration',   type: 'Number' },
        ],
      }).expect(200);
      tableId = tableRes.body.id;
      DATA_BASE = `/api/v3/data/${baseId}/${tableId}`;

      // Self-referencing HM link (predecessor → successors)
      await request(context.app)
        .post(`/api/v1/db/meta/tables/${tableId}/columns`)
        .set('xc-auth', context.token)
        .send({
          title:       'Successors',
          column_name: 'successors',
          uidt:        UITypes.LinkToAnotherRecord,
          parentId:    tableId,
          childId:     tableId,
          type:        'hm',
          version:     1,
        })
        .expect(200);

      // Resolve column IDs via model layer
      const base   = await Base.getByTitleOrId(
        { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
        baseId,
      );
      const source = (await base.getSources())[0];
      const ctx    = { base_id: baseId, workspace_id: workspaceId };
      const table  = await Model.getByAliasOrId(ctx, {
        source_id:  source.id,
        aliasOrId:  tableId,
        base_id:    baseId,
      });
      const cols = await table.getColumns(ctx);

      const findId = (title: string) => cols.find((c: any) => c.title === title)?.id as string;
      startColId = findId('Start Date');
      endColId   = findId('End Date');
      durColId   = findId('Duration');
      linkColId  = findId('Successors');

      expect(startColId, 'startColId').to.be.a('string');
      expect(endColId,   'endColId').to.be.a('string');
      expect(durColId,   'durColId').to.be.a('string');
      expect(linkColId,  'linkColId').to.be.a('string');
    });

    // ── CRUD helpers ──────────────────────────────────────────────────────────

    async function configureRule(overrides: Record<string, any> = {}) {
      const { metaPost } = api(context);
      return metaPost(INTERNAL_BASE, { operation: 'updateDateDependency', modelId: tableId }, {
        is_active:              true,
        fk_start_date_field_id: startColId,
        fk_end_date_field_id:   endColId,
        fk_duration_field_id:   durColId,
        include_weekends:       true,
        ...overrides,
      }).expect(200);
    }

    async function insertRow(fields: Record<string, any>): Promise<{ id: number; fields: Record<string, any> }> {
      const { post, get } = api(context);
      const res = await post(`${DATA_BASE}/records`, { fields }).expect(200);
      const id  = res.body.records[0].id;
      const row = await get(`${DATA_BASE}/records/${id}`).expect(200);
      return row.body;
    }

    async function updateRow(id: number, fields: Record<string, any>) {
      const { patch } = api(context);
      await patch(`${DATA_BASE}/records`, [{ id, fields }]).expect(200);
    }

    async function getRow(id: number): Promise<{ id: number; fields: Record<string, any> }> {
      const { get } = api(context);
      const res = await get(`${DATA_BASE}/records/${id}`).expect(200);
      return res.body;
    }

    /** Link parentId → childId via the HM "Successors" column */
    async function linkSuccessor(parentId: number, childId: number) {
      const { post } = api(context);
      await post(`${DATA_BASE}/links/${linkColId}/${parentId}`, [{ id: childId }]).expect(200);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1 — Within-record sync (runs on every database)
    // ─────────────────────────────────────────────────────────────────────────

    describe('within-record sync (all databases)', () => {

      describe('include_weekends: true — calendar day arithmetic', () => {
        beforeEach(() => configureRule({ include_weekends: true }));

        it('start + end  → duration (10 calendar days inclusive)', async () => {
          const row = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          expect(row.fields['Duration']).to.equal(10);
        });

        it('start + duration  → end date (5 days from Jan 1 = Jan 5)', async () => {
          const row = await insertRow({ 'Start Date': '2025-01-01', 'Duration': 5 });
          expect(row.fields['End Date']).to.equal('2025-01-05');
        });

        it('duration = 1 → end = start (same-day task)', async () => {
          const row = await insertRow({ 'Start Date': '2025-03-15', 'Duration': 1 });
          expect(row.fields['End Date']).to.equal('2025-03-15');
        });

        it('end + duration → start date (10-day task ending Jan 10 → starts Jan 1)', async () => {
          const row = await insertRow({ 'End Date': '2025-01-10', 'Duration': 10 });
          expect(row.fields['Start Date']).to.equal('2025-01-01');
        });

        it('update end → recomputes duration', async () => {
          const row = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-05' });
          await updateRow(row.id, { 'End Date': '2025-01-15' });
          const after = await getRow(row.id);
          expect(after.fields['Duration']).to.equal(15);
        });

        it('update duration → recomputes end date', async () => {
          const row = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          await updateRow(row.id, { 'Duration': 7 });
          const after = await getRow(row.id);
          expect(after.fields['End Date']).to.equal('2025-01-07');
        });

        it('all three present → recalculates duration from start+end', async () => {
          // When all three are supplied, start+end wins and duration is recalculated
          const row = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10', 'Duration': 999 });
          expect(row.fields['Duration']).to.equal(10);
        });
      });

      describe('include_weekends: false — business day arithmetic', () => {
        beforeEach(() => configureRule({ include_weekends: false }));

        it('Mon–Fri span (no weekends) → 5 business days', async () => {
          // Jan 6 (Mon) → Jan 10 (Fri) = 5 business days inclusive
          const row = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          expect(row.fields['Duration']).to.equal(5);
        });

        it('Mon–Mon span across a weekend → 6 business days', async () => {
          // Jan 6 (Mon) → Jan 13 (Mon): Mon Tue Wed Thu Fri Mon = 6 business days
          const row = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-13' });
          expect(row.fields['Duration']).to.equal(6);
        });

        it('start + 5 business days → end on Friday (skips weekend)', async () => {
          // Jan 6 (Mon) + 5 days = Jan 10 (Fri)
          const row = await insertRow({ 'Start Date': '2025-01-06', 'Duration': 5 });
          expect(row.fields['End Date']).to.equal('2025-01-10');
        });

        it('start + 6 business days → end on Monday after weekend', async () => {
          // Jan 6 (Mon) + 6 business days = Jan 13 (Mon, skipping Sat+Sun)
          const row = await insertRow({ 'Start Date': '2025-01-06', 'Duration': 6 });
          expect(row.fields['End Date']).to.equal('2025-01-13');
        });

        it('end + 5 business days backward → start on Monday', async () => {
          // Jan 10 (Fri) − 4 business days back = Jan 6 (Mon)
          const row = await insertRow({ 'End Date': '2025-01-10', 'Duration': 5 });
          expect(row.fields['Start Date']).to.equal('2025-01-06');
        });

        it('calendar vs business day: same span counts differently', async () => {
          // Jan 10 (Fri) → Jan 13 (Mon) = 4 calendar days but only 2 business days (Fri, Mon)
          const row = await insertRow({ 'Start Date': '2025-01-10', 'End Date': '2025-01-13' });
          expect(row.fields['Duration']).to.equal(2);
        });
      });

      // ── 1.3  is_active: false disables within-record sync ─────────────────

      describe('is_active: false → no field sync', () => {
        it('start + end supplied but duration NOT auto-computed', async () => {
          await configureRule({ is_active: false, include_weekends: true });

          const row = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          // Duration should remain null/0 — not auto-filled
          expect(row.fields['Duration'], 'duration not computed').to.satisfy(
            (v: any) => v === null || v === undefined || v === 0,
          );
        });

        it('start + duration supplied but end NOT auto-computed', async () => {
          await configureRule({ is_active: false, include_weekends: true });

          const row = await insertRow({ 'Start Date': '2025-01-01', 'Duration': 5 });
          expect(row.fields['End Date'], 'end date not computed').to.satisfy(
            (v: any) => v === null || v === undefined,
          );
        });
      });

      // ── 1.4  update with all three fields in payload ──────────────────────

      describe('update with all three fields in payload', () => {
        beforeEach(() => configureRule({ include_weekends: true }));

        it('update start+end together → recalculates duration', async () => {
          const row = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          expect(row.fields['Duration']).to.equal(10);

          // Update both start and end — duration should recalculate
          await updateRow(row.id, { 'Start Date': '2025-02-01', 'End Date': '2025-02-20' });
          const after = await getRow(row.id);
          expect(after.fields['Duration'], 'dur recalculated from new start+end').to.equal(20);
        });

        it('update start+duration together → recalculates end', async () => {
          const row = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });

          // Update start and duration — end should recalculate
          await updateRow(row.id, { 'Start Date': '2025-03-01', 'Duration': 3 });
          const after = await getRow(row.id);
          expect(after.fields['End Date'], 'end recalculated').to.equal('2025-03-03');
        });
      });

      // ── 1.5  edge case: duration = 0 and negative duration ────────────────

      describe('duration edge cases', () => {
        beforeEach(() => configureRule({ include_weekends: true }));

        it('duration = 0 → end date equals start date (zero-length task)', async () => {
          const row = await insertRow({ 'Start Date': '2025-01-01', 'Duration': 0 });
          // Duration=0 means zero-length task: end = start
          expect(row.fields['End Date'], 'end = start for dur=0').to.equal('2025-01-01');
        });

        it('negative duration → end date NOT computed (no-op)', async () => {
          const row = await insertRow({ 'Start Date': '2025-01-01', 'Duration': -5 });
          expect(row.fields['End Date'], 'end not computed for negative dur').to.satisfy(
            (v: any) => v === null || v === undefined,
          );
        });
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2 — Cascade propagation (internal PostgreSQL only)
    // ─────────────────────────────────────────────────────────────────────────

    describe('cascade propagation', () => {

      // ── helpers to set up a linked chain ────────────────────────────────────

      /**
       * Insert rows A (Jan 1-10), B (Jan 11-20), C (Jan 21-30) and link A→B→C.
       * Returns the three row objects.
       */
      async function insertChain() {
        const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
        const rowB = await insertRow({ 'Start Date': '2025-01-11', 'End Date': '2025-01-20' });
        const rowC = await insertRow({ 'Start Date': '2025-01-21', 'End Date': '2025-01-30' });
        await linkSuccessor(rowA.id, rowB.id);
        await linkSuccessor(rowB.id, rowC.id);
        return { rowA, rowB, rowC };
      }

      // ── 2.1  buffer_type: none → cascade disabled ─────────────────────────

      describe('buffer_type: none → cascade never fires', () => {
        it('linked successor stays unchanged after predecessor update', async () => {
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'none',
            dependency_buffer_days:        0,
          });

          const { rowA, rowB } = await insertChain();
          await updateRow(rowA.id, { 'End Date': '2025-01-20' });

          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start unchanged').to.equal('2025-01-11');
          expect(afterB.fields['End Date'],   'B end unchanged').to.equal('2025-01-20');
        });
      });

      // ── 2.2  connection: end-to-start ──────────────────────────────────────
      //
      // succ.start = pred.end + bufferDays + 1 day
      // succ.end   = new_start + (old_end - old_start)
      // Duration stored in DB is NOT changed by cascade.

      describe('connection: end-to-start', () => {

        it('[fixed, buffer=0] 2-level cascade shifts B and C', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 11-20, C: Jan 21-30 (all dur=10)
          const { rowA, rowB, rowC } = await insertChain();

          // Extend A's end to Jan 20 → A becomes Jan 1-20 (dur=20)
          await updateRow(rowA.id, { 'End Date': '2025-01-20' });

          // B: new_start = Jan 20 + 0 + 1 = Jan 21
          //    new_end   = Jan 21 + (Jan 20 - Jan 11) = Jan 21 + 9 = Jan 30
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-21');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-30');
          expect(afterB.fields['Duration'],   'B dur preserved').to.equal(10);

          // C: new_start = Jan 30 + 0 + 1 = Jan 31
          //    new_end   = Jan 31 + 9 = Feb 9
          const afterC = await getRow(rowC.id);
          expect(afterC.fields['Start Date'], 'C start').to.equal('2025-01-31');
          expect(afterC.fields['End Date'],   'C end').to.equal('2025-02-09');
          expect(afterC.fields['Duration'],   'C dur preserved').to.equal(10);
        });

        it('[fixed, buffer=2] inserts a 2-day gap between tasks', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        2,
          });

          const { rowA, rowB, rowC } = await insertChain();
          await updateRow(rowA.id, { 'End Date': '2025-01-20' });

          // B: new_start = Jan 20 + 2 + 1 = Jan 23; new_end = Jan 23 + 9 = Feb 1
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-23');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-02-01');

          // C: new_start = Feb 1 + 2 + 1 = Feb 4; new_end = Feb 4 + 9 = Feb 13
          const afterC = await getRow(rowC.id);
          expect(afterC.fields['Start Date'], 'C start').to.equal('2025-02-04');
          expect(afterC.fields['End Date'],   'C end').to.equal('2025-02-13');
        });

        it('[flexible, buffer=0] overlap detected → shifts successor', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 8-17 (overlaps A), C: Jan 18-27 — all dur=10
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-08', 'End Date': '2025-01-17' });
          const rowC = await insertRow({ 'Start Date': '2025-01-18', 'End Date': '2025-01-27' });
          await linkSuccessor(rowA.id, rowB.id);
          await linkSuccessor(rowB.id, rowC.id);

          // Extend A to Jan 15; B.start=Jan 8 ≤ Jan 15 → shift
          await updateRow(rowA.id, { 'End Date': '2025-01-15' });

          // B: new_start = Jan 16; new_end = Jan 16 + (Jan 17 - Jan 8) = Jan 16 + 9 = Jan 25
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-16');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-25');

          // C: C.start=Jan 18 ≤ B.new_end=Jan 25 → shift
          //    new_start = Jan 26; new_end = Jan 26 + 9 = Feb 4
          const afterC = await getRow(rowC.id);
          expect(afterC.fields['Start Date'], 'C start').to.equal('2025-01-26');
          expect(afterC.fields['End Date'],   'C end').to.equal('2025-02-04');
        });

        it('[flexible, buffer=0] no overlap → successor stays put', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 15-24 — plenty of gap
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-15', 'End Date': '2025-01-24' });
          await linkSuccessor(rowA.id, rowB.id);

          // A's end extends to Jan 12 — still before B.start=Jan 15 → no shift
          await updateRow(rowA.id, { 'End Date': '2025-01-12' });

          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start unchanged').to.equal('2025-01-15');
          expect(afterB.fields['End Date'],   'B end unchanged').to.equal('2025-01-24');
        });

        it('[flexible, buffer=1] no shift when gap already ≥ buffer', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        1,
          });

          // A: Jan 1-10, B: Jan 15-24 (gap = 4 days > buffer 1 day)
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-15', 'End Date': '2025-01-24' });
          await linkSuccessor(rowA.id, rowB.id);

          // Extend A slightly — B.start=Jan 15 > A.end=Jan 12 + buffer=1 → no shift
          await updateRow(rowA.id, { 'End Date': '2025-01-12' });

          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start unchanged').to.equal('2025-01-15');
          expect(afterB.fields['End Date'],   'B end unchanged').to.equal('2025-01-24');
        });
      });

      // ── 2.3  connection: end-to-end ────────────────────────────────────────
      //
      // succ.end   = pred.end + bufferDays
      // succ.start = new_end − (old_end − old_start)

      describe('connection: end-to-end', () => {

        it('[fixed, buffer=0] successor end aligns with predecessor end', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-end',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          const { rowA, rowB, rowC } = await insertChain();
          // Extend A's end to Jan 25
          await updateRow(rowA.id, { 'End Date': '2025-01-25' });

          // B: new_end = Jan 25 + 0 = Jan 25; dur_diff = Jan 20 − Jan 11 = 9; new_start = Jan 25 − 9 = Jan 16
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-16');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-25');

          // C: new_end = B.new_end + 0 = Jan 25; dur_diff = 9; new_start = Jan 25 − 9 = Jan 16
          const afterC = await getRow(rowC.id);
          expect(afterC.fields['Start Date'], 'C start').to.equal('2025-01-16');
          expect(afterC.fields['End Date'],   'C end').to.equal('2025-01-25');
        });

        it('[fixed, buffer=1] each successor ends 1 day after its predecessor', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-end',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        1,
          });

          const { rowA, rowB, rowC } = await insertChain();
          await updateRow(rowA.id, { 'End Date': '2025-01-25' });

          // B: new_end = Jan 25 + 1 = Jan 26; new_start = Jan 26 − 9 = Jan 17
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-17');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-26');

          // C: new_end = Jan 26 + 1 = Jan 27; new_start = Jan 27 − 9 = Jan 18
          const afterC = await getRow(rowC.id);
          expect(afterC.fields['Start Date'], 'C start').to.equal('2025-01-18');
          expect(afterC.fields['End Date'],   'C end').to.equal('2025-01-27');
        });

        it('[flexible] successor end already later → no shift', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-end',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // B ends Jan 24 — well after A's end of Jan 10
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-15', 'End Date': '2025-01-24' });
          await linkSuccessor(rowA.id, rowB.id);

          // Extend A to Jan 20 — B.end=Jan 24 > Jan 20 → no shift
          await updateRow(rowA.id, { 'End Date': '2025-01-20' });

          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end unchanged').to.equal('2025-01-24');
          expect(afterB.fields['Start Date'], 'B start unchanged').to.equal('2025-01-15');
        });

        it('[flexible] successor end earlier than pred end → shift', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-end',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // B ends Jan 17 — before A's extended end of Jan 20
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-08', 'End Date': '2025-01-17' });
          await linkSuccessor(rowA.id, rowB.id);

          // Extend A to Jan 20: B.end=Jan 17 < Jan 20 → SHIFT
          await updateRow(rowA.id, { 'End Date': '2025-01-20' });

          // B: new_end = Jan 20; dur_diff = Jan 17 − Jan 8 = 9; new_start = Jan 20 − 9 = Jan 11
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-20');
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-11');
        });
      });

      // ── 2.4  connection: start-to-start ───────────────────────────────────
      //
      // succ.start = pred.start + bufferDays
      // succ.end   = new_start + (old_end − old_start)

      describe('connection: start-to-start', () => {

        it('[fixed, buffer=0] all successors start on the same day as predecessor', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          // A, B, C all start Jan 1 initially
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowC = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          await linkSuccessor(rowA.id, rowB.id);
          await linkSuccessor(rowB.id, rowC.id);

          // Move A forward: start=Jan 6, end=Jan 15 (dur=10 preserved)
          await updateRow(rowA.id, { 'Start Date': '2025-01-06', 'End Date': '2025-01-15' });

          // B: new_start = Jan 6 + 0 = Jan 6; dur_diff = 9; new_end = Jan 6 + 9 = Jan 15
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-06');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-15');

          // C: new_start = Jan 6 + 0 = Jan 6; new_end = Jan 15
          const afterC = await getRow(rowC.id);
          expect(afterC.fields['Start Date'], 'C start').to.equal('2025-01-06');
          expect(afterC.fields['End Date'],   'C end').to.equal('2025-01-15');
        });

        it('[fixed, buffer=1] each successor starts 1 day later than predecessor', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        1,
          });

          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowC = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          await linkSuccessor(rowA.id, rowB.id);
          await linkSuccessor(rowB.id, rowC.id);

          // Move A: start=Jan 6, end=Jan 15
          await updateRow(rowA.id, { 'Start Date': '2025-01-06', 'End Date': '2025-01-15' });

          // B: new_start = Jan 6 + 1 = Jan 7; new_end = Jan 7 + 9 = Jan 16
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-07');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-16');

          // C: new_start = Jan 7 + 1 = Jan 8; new_end = Jan 8 + 9 = Jan 17
          const afterC = await getRow(rowC.id);
          expect(afterC.fields['Start Date'], 'C start').to.equal('2025-01-08');
          expect(afterC.fields['End Date'],   'C end').to.equal('2025-01-17');
        });

        it('[flexible] successor already starts after predecessor → no shift', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-start',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 15-24 (B starts well after A)
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-15', 'End Date': '2025-01-24' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move A forward: start=Jan 5 — still before B.start=Jan 15 → no shift
          await updateRow(rowA.id, { 'Start Date': '2025-01-05', 'End Date': '2025-01-14' });

          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start unchanged').to.equal('2025-01-15');
          expect(afterB.fields['End Date'],   'B end unchanged').to.equal('2025-01-24');
        });

        it('[flexible] successor starts before predecessor → shift to align', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-start',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // A: Jan 10-19, B: Jan 5-14 (B starts before A)
          const rowA = await insertRow({ 'Start Date': '2025-01-10', 'End Date': '2025-01-19' });
          const rowB = await insertRow({ 'Start Date': '2025-01-05', 'End Date': '2025-01-14' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move A later: start=Jan 12, end=Jan 21; B.start=Jan 5 < Jan 12 → SHIFT
          await updateRow(rowA.id, { 'Start Date': '2025-01-12', 'End Date': '2025-01-21' });

          // B: new_start = Jan 12; dur_diff = Jan 14 − Jan 5 = 9; new_end = Jan 12 + 9 = Jan 21
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-12');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-21');
        });
      });

      // ── 2.5  connection: start-to-end ────────────────────────────────────
      //
      // succ.end   = pred.start + bufferDays
      // succ.start = new_end − (old_end − old_start)

      describe('connection: start-to-end', () => {

        it('[fixed, buffer=0] successor end aligns with predecessor start', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-end',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowC = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          await linkSuccessor(rowA.id, rowB.id);
          await linkSuccessor(rowB.id, rowC.id);

          // Move A forward: start=Jan 6, end=Jan 15
          await updateRow(rowA.id, { 'Start Date': '2025-01-06', 'End Date': '2025-01-15' });

          // B: new_end = A.start + 0 = Jan 6; dur_diff = Jan 10 − Jan 1 = 9; new_start = Jan 6 − 9 = Dec 28
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-06');
          expect(afterB.fields['Start Date'], 'B start').to.equal('2024-12-28');

          // C: new_end = B.new_start + 0 = Dec 28; new_start = Dec 28 − 9 = Dec 19
          const afterC = await getRow(rowC.id);
          expect(afterC.fields['End Date'],   'C end').to.equal('2024-12-28');
          expect(afterC.fields['Start Date'], 'C start').to.equal('2024-12-19');
        });

        it('[fixed, buffer=2] successor end = predecessor start + 2 days', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-end',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        2,
          });

          const rowA = await insertRow({ 'Start Date': '2025-01-10', 'End Date': '2025-01-19' });
          const rowB = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move A: start=Jan 15, end=Jan 24
          await updateRow(rowA.id, { 'Start Date': '2025-01-15', 'End Date': '2025-01-24' });

          // B: new_end = Jan 15 + 2 = Jan 17; dur_diff = Jan 10 − Jan 1 = 9; new_start = Jan 17 − 9 = Jan 8
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-17');
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-08');
        });

        it('[flexible] successor end already after predecessor start → no shift', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-end',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 15-24 (B.end=Jan 24 > A.start=Jan 1)
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-15', 'End Date': '2025-01-24' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move A: start=Jan 5, end=Jan 14 — B.end=Jan 24 > Jan 5 → no shift
          await updateRow(rowA.id, { 'Start Date': '2025-01-05', 'End Date': '2025-01-14' });

          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end unchanged').to.equal('2025-01-24');
          expect(afterB.fields['Start Date'], 'B start unchanged').to.equal('2025-01-15');
        });

        it('[flexible] successor end before predecessor start → shift to align', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-end',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // A: Jan 10-19, B: Jan 1-5 (B.end=Jan 5 < A.start=Jan 10)
          const rowA = await insertRow({ 'Start Date': '2025-01-10', 'End Date': '2025-01-19' });
          const rowB = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-05' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move A later: start=Jan 15, end=Jan 24; B.end=Jan 5 < Jan 15 → SHIFT
          await updateRow(rowA.id, { 'Start Date': '2025-01-15', 'End Date': '2025-01-24' });

          // B: new_end = Jan 15; dur_diff = Jan 5 − Jan 1 = 4; new_start = Jan 15 − 4 = Jan 11
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-15');
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-11');
        });
      });

      // ── 2.7  is_active: false → cascade completely disabled ───────────────

      describe('is_active: false → no cascade', () => {
        it('linked successor stays unchanged when rule is inactive', async function () {
          this.timeout(30_000);
          await configureRule({
            is_active:                      false,
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-11', 'End Date': '2025-01-20' });
          await linkSuccessor(rowA.id, rowB.id);

          await updateRow(rowA.id, { 'End Date': '2025-01-20' });

          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B unchanged (inactive)').to.equal('2025-01-11');
          expect(afterB.fields['End Date'],   'B unchanged (inactive)').to.equal('2025-01-20');
        });
      });

      // ── 2.8  no predecessor link → no cascade ─────────────────────────────

      describe('no predecessor link field configured', () => {
        it('update fires within-record sync only, cascade does not run', async function () {
          this.timeout(30_000);
          // Rule without a predecessor link field — only within-record sync
          await configureRule();   // no fk_dependency_linkrow_field_id

          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-11', 'End Date': '2025-01-20' });
          // Even if rows exist, no cascade without the link column in the rule
          await updateRow(rowA.id, { 'End Date': '2025-01-20' });

          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start unchanged').to.equal('2025-01-11');
          expect(afterB.fields['End Date'],   'B end unchanged').to.equal('2025-01-20');
        });
      });

      // ── 2.6  cycle detection ─────────────────────────────────────────────

      describe('cycle detection (A→B→A)', () => {
        it('circular link does not cause infinite recursion', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 11-20, create a cycle: A→B and B→A
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-11', 'End Date': '2025-01-20' });
          await linkSuccessor(rowA.id, rowB.id);
          await linkSuccessor(rowB.id, rowA.id);

          // Update A — should propagate to B but NOT loop back to A infinitely
          // The CTE's path-based cycle detection should stop the recursion
          await updateRow(rowA.id, { 'End Date': '2025-01-15' });

          // B should be shifted: new_start = Jan 15 + 1 = Jan 16; dur = 9; new_end = Jan 25
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start shifted').to.equal('2025-01-16');
          expect(afterB.fields['End Date'],   'B end shifted').to.equal('2025-01-25');

          // A should NOT have been re-shifted by the cycle — it keeps the values we set
          const afterA = await getRow(rowA.id);
          expect(afterA.fields['Start Date'], 'A start unchanged').to.equal('2025-01-01');
          expect(afterA.fields['End Date'],   'A end = what we set').to.equal('2025-01-15');
        });

        it('3-node cycle (A→B→C→A) terminates safely', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-11', 'End Date': '2025-01-20' });
          const rowC = await insertRow({ 'Start Date': '2025-01-21', 'End Date': '2025-01-30' });
          await linkSuccessor(rowA.id, rowB.id);
          await linkSuccessor(rowB.id, rowC.id);
          await linkSuccessor(rowC.id, rowA.id); // close the cycle

          // Should not hang or error — the request completes within timeout
          await updateRow(rowA.id, { 'End Date': '2025-01-15' });

          // B and C propagate forward; A is NOT re-touched
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B shifted').to.equal('2025-01-16');

          const afterC = await getRow(rowC.id);
          expect(afterC.fields['Start Date'], 'C shifted').to.equal('2025-01-26');

          const afterA = await getRow(rowA.id);
          expect(afterA.fields['End Date'], 'A end unchanged').to.equal('2025-01-15');
        });
      });

      // ── 2.9  include_weekends: false → business-day propagation ───────────

      describe('include_weekends: false — business-day cascade', () => {

        it('[end-to-start, fixed, buffer=0] shifts successor to next business day', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
            include_weekends:              false,
          });

          // A: Mon Jan 6 – Fri Jan 10 (5 biz days), B: Mon Jan 13 – Fri Jan 17 (5 biz days)
          const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-13', 'End Date': '2025-01-17' });
          await linkSuccessor(rowA.id, rowB.id);

          // Extend A's end to Fri Jan 17 → B must shift past the weekend
          await updateRow(rowA.id, { 'End Date': '2025-01-17' });

          // B: new_start = addBizDays(Jan 17, 1) = Mon Jan 20
          //    biz_dur of B = bizDaysBetween(Jan 13, Jan 17) = 4
          //    new_end   = addBizDays(Jan 20, 4) = Fri Jan 24
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-20');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-24');
        });

        it('[end-to-start, fixed, buffer=1] adds 1 business-day gap', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        1,
            include_weekends:              false,
          });

          // A: Mon Jan 6 – Fri Jan 10, B: Mon Jan 13 – Fri Jan 17
          const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-13', 'End Date': '2025-01-17' });
          await linkSuccessor(rowA.id, rowB.id);

          // Extend A to Fri Jan 17
          await updateRow(rowA.id, { 'End Date': '2025-01-17' });

          // B: new_start = addBizDays(Jan 17, 1+1=2) = Tue Jan 21
          //    biz_dur = 4; new_end = addBizDays(Jan 21, 4) = Mon Jan 27
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-21');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-27');
        });

        it('[end-to-start, flexible, buffer=0] overlap across weekend shifts successor', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
            include_weekends:              false,
          });

          // A: Mon Jan 6 – Thu Jan 9, B: Wed Jan 8 – Mon Jan 13
          const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-09' });
          const rowB = await insertRow({ 'Start Date': '2025-01-08', 'End Date': '2025-01-13' });
          await linkSuccessor(rowA.id, rowB.id);

          // Extend A to Fri Jan 10; B.start=Jan 8 ≤ addBizDays(Jan 10, 0) = Jan 10 → shift
          await updateRow(rowA.id, { 'End Date': '2025-01-10' });

          // B: new_start = addBizDays(Jan 10, 1) = Mon Jan 13
          //    biz_dur = bizDaysBetween(Jan 8, Jan 13) = 3; new_end = addBizDays(Jan 13, 3) = Thu Jan 16
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-13');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-16');
        });

        it('[end-to-start, flexible, buffer=0] no overlap → no shift', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
            include_weekends:              false,
          });

          // A: Mon Jan 6 – Fri Jan 10, B: Mon Jan 20 – Fri Jan 24 (big gap)
          const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-20', 'End Date': '2025-01-24' });
          await linkSuccessor(rowA.id, rowB.id);

          // Extend A to Jan 15 — B.start=Jan 20 > addBizDays(Jan 15, 0) = Jan 15 → no shift
          await updateRow(rowA.id, { 'End Date': '2025-01-15' });

          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B unchanged').to.equal('2025-01-20');
          expect(afterB.fields['End Date'],   'B unchanged').to.equal('2025-01-24');
        });

        it('[end-to-start, fixed, buffer=0] 2-level chain skips weekends at each level', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
            include_weekends:              false,
          });

          // A: Mon Jan 6 – Fri Jan 10, B: Mon Jan 13 – Fri Jan 17, C: Mon Jan 20 – Fri Jan 24
          const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-13', 'End Date': '2025-01-17' });
          const rowC = await insertRow({ 'Start Date': '2025-01-20', 'End Date': '2025-01-24' });
          await linkSuccessor(rowA.id, rowB.id);
          await linkSuccessor(rowB.id, rowC.id);

          // Extend A to Fri Jan 17
          await updateRow(rowA.id, { 'End Date': '2025-01-17' });

          // B: start = Mon Jan 20, end = Fri Jan 24 (4 biz dur preserved)
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-20');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-24');

          // C: start = Mon Jan 27, end = Fri Jan 31
          const afterC = await getRow(rowC.id);
          expect(afterC.fields['Start Date'], 'C start').to.equal('2025-01-27');
          expect(afterC.fields['End Date'],   'C end').to.equal('2025-01-31');
        });

        // ── end-to-end with business days ─────────────────────────────────

        it('[end-to-end, fixed, buffer=0] successor end aligns, skipping weekends', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-end',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
            include_weekends:              false,
          });

          // A: Mon Jan 6 – Fri Jan 10, B: Mon Jan 13 – Fri Jan 17
          const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-13', 'End Date': '2025-01-17' });
          await linkSuccessor(rowA.id, rowB.id);

          // Extend A's end to Thu Jan 23
          await updateRow(rowA.id, { 'End Date': '2025-01-23' });

          // B: new_end = addBizDays(Jan 23, 0) = Jan 23 (Thu)
          //    biz_dur = bizDaysBetween(Jan 13, Jan 17) = 4
          //    new_start = subBizDays(Jan 23, 4) = Thu Jan 23 - 4 biz = Fri Jan 17
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-23');
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-17');
        });

        it('[end-to-end, fixed, buffer=1] adds 1 biz day gap to end alignment', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-end',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        1,
            include_weekends:              false,
          });

          // A: Mon Jan 6 – Fri Jan 10, B: Mon Jan 13 – Fri Jan 17
          const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-13', 'End Date': '2025-01-17' });
          await linkSuccessor(rowA.id, rowB.id);

          // Extend A to Fri Jan 17
          await updateRow(rowA.id, { 'End Date': '2025-01-17' });

          // B: new_end = addBizDays(Jan 17(Fri), 1) = Mon Jan 20
          //    biz_dur = 4; new_start = subBizDays(Jan 20(Mon), 4) = Tue Jan 14
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-20');
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-14');
        });

        // ── start-to-start with business days ─────────────────────────────

        it('[start-to-start, fixed, buffer=0] successor starts on same biz day', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
            include_weekends:              false,
          });

          // A: Mon Jan 6 – Fri Jan 10, B: Mon Jan 6 – Fri Jan 10
          const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move A to start Mon Jan 20
          await updateRow(rowA.id, { 'Start Date': '2025-01-20', 'End Date': '2025-01-24' });

          // B: new_start = addBizDays(Jan 20(Mon), 0) = Mon Jan 20
          //    biz_dur = bizDaysBetween(Jan 6, Jan 10) = 4
          //    new_end = addBizDays(Jan 20, 4) = Fri Jan 24
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-20');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-24');
        });

        it('[start-to-start, fixed, buffer=1] successor starts 1 biz day later', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        1,
            include_weekends:              false,
          });

          // A: Mon Jan 6 – Fri Jan 10, B: Mon Jan 6 – Fri Jan 10
          const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move A to start Fri Jan 17
          await updateRow(rowA.id, { 'Start Date': '2025-01-17', 'End Date': '2025-01-24' });

          // B: new_start = addBizDays(Jan 17(Fri), 1) = Mon Jan 20
          //    biz_dur = 4; new_end = addBizDays(Jan 20(Mon), 4) = Fri Jan 24
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-20');
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-24');
        });

        // ── start-to-end with business days ───────────────────────────────

        it('[start-to-end, fixed, buffer=0] successor end aligns with pred start, biz days', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-end',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
            include_weekends:              false,
          });

          // A: Mon Jan 13 – Fri Jan 17, B: Mon Jan 6 – Fri Jan 10
          const rowA = await insertRow({ 'Start Date': '2025-01-13', 'End Date': '2025-01-17' });
          const rowB = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move A: start=Mon Jan 20
          await updateRow(rowA.id, { 'Start Date': '2025-01-20', 'End Date': '2025-01-24' });

          // B: new_end = addBizDays(Jan 20(Mon), 0) = Mon Jan 20
          //    biz_dur = bizDaysBetween(Jan 6, Jan 10) = 4
          //    new_start = subBizDays(Jan 20(Mon), 4) = Tue Jan 14
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-20');
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-14');
        });

        it('[start-to-end, fixed, buffer=1] successor end = pred start + 1 biz day', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-end',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        1,
            include_weekends:              false,
          });

          // A: Mon Jan 13 – Fri Jan 17, B: Mon Jan 6 – Fri Jan 10
          const rowA = await insertRow({ 'Start Date': '2025-01-13', 'End Date': '2025-01-17' });
          const rowB = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move A: start=Fri Jan 17
          await updateRow(rowA.id, { 'Start Date': '2025-01-17', 'End Date': '2025-01-24' });

          // B: new_end = addBizDays(Jan 17(Fri), 1) = Mon Jan 20
          //    biz_dur = 4; new_start = subBizDays(Jan 20(Mon), 4) = Tue Jan 14
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-20');
          expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-14');
        });
      });

      // ── backward propagation ─────────────────────────────────────────────
      //
      // When a successor (child) is moved backward so its dates collide with
      // its predecessor (parent), the predecessor should be pushed earlier.

      describe('backward propagation', () => {

        it('[end-to-start, fixed, buffer=0] child moved backward pushes parent earlier', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 11-20 (B is successor of A)
          const { rowA, rowB } = await insertChain();

          // Move B backward to Jan 5-14 → overlaps with A (A ends Jan 10)
          await updateRow(rowB.id, { 'Start Date': '2025-01-05', 'End Date': '2025-01-14' });

          // A should be pushed backward: A.end = B.start - 1 = Jan 4
          // A.start = A.end - duration = Jan 4 - 9 = Dec 26
          const afterA = await getRow(rowA.id);
          expect(afterA.fields['End Date'],   'A end').to.equal('2025-01-04');
          expect(afterA.fields['Start Date'], 'A start').to.equal('2024-12-26');
        });

        it('[end-to-start, fixed, buffer=2] child moved backward pushes parent with gap', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        2,
          });

          // A: Jan 1-10, B: Jan 14-23 (3-day gap between A and B)
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-14', 'End Date': '2025-01-23' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move B backward to Jan 8-17 → overlaps with A+buffer
          await updateRow(rowB.id, { 'Start Date': '2025-01-08', 'End Date': '2025-01-17' });

          // A.end = B.start - buffer - 1 = Jan 8 - 3 = Jan 5
          // duration = 9 days → A.start = Jan 5 - 9 = Dec 27
          const afterA = await getRow(rowA.id);
          expect(afterA.fields['End Date'],   'A end').to.equal('2025-01-05');
          expect(afterA.fields['Start Date'], 'A start').to.equal('2024-12-27');
        });

        it('[end-to-start, flexible, buffer=0] no overlap → parent stays put', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 15-24 (4-day gap)
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-15', 'End Date': '2025-01-24' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move B backward to Jan 12-21 → still after A.end (Jan 10), no overlap
          await updateRow(rowB.id, { 'Start Date': '2025-01-12', 'End Date': '2025-01-21' });

          // A should NOT be moved
          const afterA = await getRow(rowA.id);
          expect(afterA.fields['End Date'],   'A end unchanged').to.equal('2025-01-10');
          expect(afterA.fields['Start Date'], 'A start unchanged').to.equal('2025-01-01');
        });

        it('[end-to-start, flexible, buffer=0] overlap → parent pushed backward', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          const { rowA, rowB } = await insertChain();

          // Move B backward to Jan 8-17 → overlaps with A (A ends Jan 10)
          await updateRow(rowB.id, { 'Start Date': '2025-01-08', 'End Date': '2025-01-17' });

          // A.end = B.start - 1 = Jan 7, A.start = Jan 7 - 9 = Dec 29
          const afterA = await getRow(rowA.id);
          expect(afterA.fields['End Date'],   'A end').to.equal('2025-01-07');
          expect(afterA.fields['Start Date'], 'A start').to.equal('2024-12-29');
        });

        it('[end-to-start, fixed, buffer=0] 2-level backward cascade (C→B→A)', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 11-20, C: Jan 21-30
          const { rowA, rowB, rowC } = await insertChain();

          // Move C backward to Jan 5-14 → overlaps with B
          await updateRow(rowC.id, { 'Start Date': '2025-01-05', 'End Date': '2025-01-14' });

          // B.end = C.start - 1 = Jan 4, B.start = Jan 4 - 9 = Dec 26
          // A.end = B.start - 1 = Dec 25, A.start = Dec 25 - 9 = Dec 16
          const afterB = await getRow(rowB.id);
          expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-04');
          expect(afterB.fields['Start Date'], 'B start').to.equal('2024-12-26');

          const afterA = await getRow(rowA.id);
          expect(afterA.fields['End Date'],   'A end').to.equal('2024-12-25');
          expect(afterA.fields['Start Date'], 'A start').to.equal('2024-12-16');
        });

        it('[end-to-end, fixed, buffer=0] child moved backward pushes parent end earlier', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-end',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 5-10 (both end Jan 10)
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-05', 'End Date': '2025-01-10' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move B backward so it ends Jan 5 → A.end must also move to Jan 5
          await updateRow(rowB.id, { 'Start Date': '2025-01-01', 'End Date': '2025-01-05' });

          // A.end = B.end - buffer = Jan 5, dur = 9 → A.start = Jan 5 - 9 = Dec 27
          const afterA = await getRow(rowA.id);
          expect(afterA.fields['End Date'],   'A end').to.equal('2025-01-05');
          expect(afterA.fields['Start Date'], 'A start').to.equal('2024-12-27');
        });

        it('[end-to-end, flexible, buffer=0] no overlap → parent stays put', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-end',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // A: Jan 1-10, B: Jan 5-15 (B ends after A → no overlap)
          const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-05', 'End Date': '2025-01-15' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move B so it ends Jan 12 → still after A.end (Jan 10), A.end <= B.end, no violation
          await updateRow(rowB.id, { 'Start Date': '2025-01-02', 'End Date': '2025-01-12' });

          const afterA = await getRow(rowA.id);
          expect(afterA.fields['End Date'],   'A end unchanged').to.equal('2025-01-10');
          expect(afterA.fields['Start Date'], 'A start unchanged').to.equal('2025-01-01');
        });

        it('[start-to-start, fixed, buffer=0] child moved backward pushes parent start earlier', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          // A: Jan 10-20, B: Jan 10-15 (both start Jan 10)
          const rowA = await insertRow({ 'Start Date': '2025-01-10', 'End Date': '2025-01-20' });
          const rowB = await insertRow({ 'Start Date': '2025-01-10', 'End Date': '2025-01-15' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move B backward to start Jan 5 → A.start must also move to Jan 5
          await updateRow(rowB.id, { 'Start Date': '2025-01-05', 'End Date': '2025-01-10' });

          // A.start = B.start - buffer = Jan 5, dur = 10 → A.end = Jan 5 + 10 = Jan 15
          const afterA = await getRow(rowA.id);
          expect(afterA.fields['Start Date'], 'A start').to.equal('2025-01-05');
          expect(afterA.fields['End Date'],   'A end').to.equal('2025-01-15');
        });

        it('[start-to-start, flexible, buffer=0] no overlap → parent stays put', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-start',
            dependency_buffer_type:        'flexible',
            dependency_buffer_days:        0,
          });

          // A: Jan 5-15, B: Jan 10-20 (B starts after A)
          const rowA = await insertRow({ 'Start Date': '2025-01-05', 'End Date': '2025-01-15' });
          const rowB = await insertRow({ 'Start Date': '2025-01-10', 'End Date': '2025-01-20' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move B backward to Jan 7 → still after A.start (Jan 5), no violation
          await updateRow(rowB.id, { 'Start Date': '2025-01-07', 'End Date': '2025-01-17' });

          const afterA = await getRow(rowA.id);
          expect(afterA.fields['Start Date'], 'A start unchanged').to.equal('2025-01-05');
          expect(afterA.fields['End Date'],   'A end unchanged').to.equal('2025-01-15');
        });

        it('[start-to-end, fixed, buffer=0] child moved backward pushes parent start earlier', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'start-to-end',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
          });

          // A: Jan 10-20, B: Jan 5-10 (B.end = A.start)
          const rowA = await insertRow({ 'Start Date': '2025-01-10', 'End Date': '2025-01-20' });
          const rowB = await insertRow({ 'Start Date': '2025-01-05', 'End Date': '2025-01-10' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move B backward so B.end = Jan 5 → A.start must move to Jan 5
          await updateRow(rowB.id, { 'Start Date': '2025-01-01', 'End Date': '2025-01-05' });

          // A.start = B.end - buffer = Jan 5, dur = 10 → A.end = Jan 5 + 10 = Jan 15
          const afterA = await getRow(rowA.id);
          expect(afterA.fields['Start Date'], 'A start').to.equal('2025-01-05');
          expect(afterA.fields['End Date'],   'A end').to.equal('2025-01-15');
        });

        it('[end-to-start, fixed, buffer=0, weekends=false] backward biz days', async function () {
          this.timeout(30_000);
          await configureRule({
            fk_dependency_linkrow_field_id: linkColId,
            dependency_linkrow_role:       'successors',
            dependency_connection_type:    'end-to-start',
            dependency_buffer_type:        'fixed',
            dependency_buffer_days:        0,
            include_weekends:              false,
          });

          // A: Mon Jan 6 – Fri Jan 10 (5 biz days), B: Mon Jan 13 – Fri Jan 17
          const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
          const rowB = await insertRow({ 'Start Date': '2025-01-13', 'End Date': '2025-01-17' });
          await linkSuccessor(rowA.id, rowB.id);

          // Move B backward to Wed Jan 8 – Tue Jan 14 → overlaps with A (A ends Fri Jan 10)
          await updateRow(rowB.id, { 'Start Date': '2025-01-08', 'End Date': '2025-01-14' });

          // A.end = subBizDays(B.start=Jan 8(Wed), 1) = Tue Jan 7
          // biz_dur = 4; A.start = subBizDays(Jan 7(Tue), 4) = Wed Jan 1
          const afterA = await getRow(rowA.id);
          expect(afterA.fields['End Date'],   'A end').to.equal('2025-01-07');
          expect(afterA.fields['Start Date'], 'A start').to.equal('2025-01-01');
        });
      });

      // ── Shared test suite for alternative link types (V2 om, V1 oo) ─────
      //
      // Runs the full matrix (all connection types, buffer modes, business days,
      // cycle detection, backward propagation) for each link type.

      function defineLinkTypeTests(
        suiteName: string,
        linkSetup: { title: string; column_name: string; type: string; version: number },
      ) {
        describe(suiteName, () => {
          let altLinkColId: string;

          beforeEach(async function () {
            await request(context.app)
              .post(`/api/v1/db/meta/tables/${tableId}/columns`)
              .set('xc-auth', context.token)
              .send({
                ...linkSetup,
                uidt:     UITypes.LinkToAnotherRecord,
                parentId: tableId,
                childId:  tableId,
              })
              .expect(200);

            const ctx  = { base_id: baseId, workspace_id: workspaceId };
            const table = await Model.getByAliasOrId(ctx, {
              source_id: (await (await Base.getByTitleOrId(
                { workspace_id: RootScopes.BASE, base_id: RootScopes.BASE } as any,
                baseId,
              )).getSources())[0].id,
              aliasOrId: tableId,
              base_id:   baseId,
            });
            const cols = await table.getColumns(ctx);
            altLinkColId = cols.find((c: any) => c.title === linkSetup.title)?.id as string;
            expect(altLinkColId, 'altLinkColId').to.be.a('string');
          });

          async function linkAlt(parentId: number, childId: number) {
            const { post } = api(context);
            await post(`${DATA_BASE}/links/${altLinkColId}/${parentId}`, [{ id: childId }]).expect(200);
          }

          function rule(overrides: Record<string, any> = {}) {
            return configureRule({
              fk_dependency_linkrow_field_id: altLinkColId,
              dependency_linkrow_role:       'successors',
              ...overrides,
            });
          }

          // ── end-to-start ──────────────────────────────────────────────

          describe('end-to-start', () => {
            it('[fixed, buffer=0] 2-level cascade', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'end-to-start', dependency_buffer_type: 'fixed', dependency_buffer_days: 0 });

              const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              const rowB = await insertRow({ 'Start Date': '2025-01-11', 'End Date': '2025-01-20' });
              const rowC = await insertRow({ 'Start Date': '2025-01-21', 'End Date': '2025-01-30' });
              await linkAlt(rowA.id, rowB.id);
              await linkAlt(rowB.id, rowC.id);

              await updateRow(rowA.id, { 'End Date': '2025-01-20' });

              const afterB = await getRow(rowB.id);
              expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-21');
              expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-30');
              const afterC = await getRow(rowC.id);
              expect(afterC.fields['Start Date'], 'C start').to.equal('2025-01-31');
              expect(afterC.fields['End Date'],   'C end').to.equal('2025-02-09');
            });

            it('[fixed, buffer=2] inserts gap', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'end-to-start', dependency_buffer_type: 'fixed', dependency_buffer_days: 2 });

              const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              const rowB = await insertRow({ 'Start Date': '2025-01-11', 'End Date': '2025-01-20' });
              await linkAlt(rowA.id, rowB.id);

              await updateRow(rowA.id, { 'End Date': '2025-01-20' });

              const afterB = await getRow(rowB.id);
              expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-23');
              expect(afterB.fields['End Date'],   'B end').to.equal('2025-02-01');
            });

            it('[flexible, buffer=0] overlap shifts', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'end-to-start', dependency_buffer_type: 'flexible', dependency_buffer_days: 0 });

              const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              const rowB = await insertRow({ 'Start Date': '2025-01-05', 'End Date': '2025-01-14' });
              await linkAlt(rowA.id, rowB.id);

              await updateRow(rowA.id, { 'End Date': '2025-01-10' });

              const afterB = await getRow(rowB.id);
              expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-11');
              expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-20');
            });

            it('[flexible, buffer=0] no overlap → no shift', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'end-to-start', dependency_buffer_type: 'flexible', dependency_buffer_days: 0 });

              const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              const rowB = await insertRow({ 'Start Date': '2025-01-15', 'End Date': '2025-01-24' });
              await linkAlt(rowA.id, rowB.id);

              await updateRow(rowA.id, { 'End Date': '2025-01-10' });

              const afterB = await getRow(rowB.id);
              expect(afterB.fields['Start Date'], 'B unchanged').to.equal('2025-01-15');
            });
          });

          // ── end-to-end ────────────────────────────────────────────────

          describe('end-to-end', () => {
            it('[fixed, buffer=0] successor end aligns with predecessor end', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'end-to-end', dependency_buffer_type: 'fixed', dependency_buffer_days: 0 });

              const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              const rowB = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-15' });
              await linkAlt(rowA.id, rowB.id);

              await updateRow(rowA.id, { 'End Date': '2025-01-20' });

              const afterB = await getRow(rowB.id);
              expect(afterB.fields['End Date'],   'B end').to.equal('2025-01-20');
              expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-11');
            });
          });

          // ── start-to-start ────────────────────────────────────────────

          describe('start-to-start', () => {
            it('[fixed, buffer=0] successor starts on same day', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'start-to-start', dependency_buffer_type: 'fixed', dependency_buffer_days: 0 });

              const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              const rowB = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              await linkAlt(rowA.id, rowB.id);

              await updateRow(rowA.id, { 'Start Date': '2025-01-05' });

              const afterB = await getRow(rowB.id);
              expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-05');
            });
          });

          // ── start-to-end ──────────────────────────────────────────────

          describe('start-to-end', () => {
            it('[fixed, buffer=0] successor end aligns with predecessor start', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'start-to-end', dependency_buffer_type: 'fixed', dependency_buffer_days: 0 });

              const rowA = await insertRow({ 'Start Date': '2025-01-10', 'End Date': '2025-01-20' });
              const rowB = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              await linkAlt(rowA.id, rowB.id);

              await updateRow(rowA.id, { 'Start Date': '2025-01-15' });

              const afterB = await getRow(rowB.id);
              expect(afterB.fields['End Date'], 'B end').to.equal('2025-01-15');
            });
          });

          // ── buffer_type: none ─────────────────────────────────────────

          describe('buffer_type: none', () => {
            it('no cascade when buffer_type is none', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'end-to-start', dependency_buffer_type: 'none', dependency_buffer_days: 0 });

              const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              const rowB = await insertRow({ 'Start Date': '2025-01-11', 'End Date': '2025-01-20' });
              await linkAlt(rowA.id, rowB.id);

              await updateRow(rowA.id, { 'End Date': '2025-01-20' });

              const afterB = await getRow(rowB.id);
              expect(afterB.fields['Start Date'], 'B unchanged').to.equal('2025-01-11');
            });
          });

          // ── backward propagation ──────────────────────────────────────

          describe('backward', () => {
            it('[fixed, buffer=0] backward pushes parent earlier', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'end-to-start', dependency_buffer_type: 'fixed', dependency_buffer_days: 0 });

              const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              const rowB = await insertRow({ 'Start Date': '2025-01-11', 'End Date': '2025-01-20' });
              await linkAlt(rowA.id, rowB.id);

              await updateRow(rowB.id, { 'Start Date': '2025-01-06', 'End Date': '2025-01-15' });

              const afterA = await getRow(rowA.id);
              expect(afterA.fields['End Date'],   'A end').to.equal('2025-01-05');
              expect(afterA.fields['Start Date'], 'A start').to.equal('2024-12-27');
            });
          });

          // ── business days (weekends=false) ────────────────────────────

          describe('business days', () => {
            it('[end-to-start, fixed, buffer=0] skips weekends', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'end-to-start', dependency_buffer_type: 'fixed', dependency_buffer_days: 0, include_weekends: false });

              // A: Mon Jan 6 – Fri Jan 10, B: Mon Jan 13 – Fri Jan 17
              const rowA = await insertRow({ 'Start Date': '2025-01-06', 'End Date': '2025-01-10' });
              const rowB = await insertRow({ 'Start Date': '2025-01-13', 'End Date': '2025-01-17' });
              await linkAlt(rowA.id, rowB.id);

              // Extend A to Fri Jan 17 → B.start = next biz day = Mon Jan 20
              await updateRow(rowA.id, { 'End Date': '2025-01-17' });

              const afterB = await getRow(rowB.id);
              expect(afterB.fields['Start Date'], 'B start').to.equal('2025-01-20');
            });
          });

          // ── cycle detection ───────────────────────────────────────────

          describe('cycle detection', () => {
            it('circular link does not cause infinite recursion', async function () {
              this.timeout(30_000);
              await rule({ dependency_connection_type: 'end-to-start', dependency_buffer_type: 'fixed', dependency_buffer_days: 0 });

              const rowA = await insertRow({ 'Start Date': '2025-01-01', 'End Date': '2025-01-10' });
              const rowB = await insertRow({ 'Start Date': '2025-01-11', 'End Date': '2025-01-20' });
              await linkAlt(rowA.id, rowB.id);
              await linkAlt(rowB.id, rowA.id);

              // Should terminate without error
              await updateRow(rowA.id, { 'End Date': '2025-01-15' });

              const afterB = await getRow(rowB.id);
              expect(afterB.fields['Start Date'], 'B shifted').to.equal('2025-01-16');
            });
          });
        });
      }

      defineLinkTypeTests('V2 om link (junction table)', {
        title: 'OM Successors', column_name: 'om_successors', type: 'hm', version: 2,
      });

      defineLinkTypeTests('oo link (one-to-one)', {
        title: 'OO Successor', column_name: 'oo_successor', type: 'oo', version: 1,
      });
    });
  });
};

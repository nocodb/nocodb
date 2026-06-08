import 'mocha';
import { expect } from 'chai';
import init from '../../../../init';
import { createProject } from '../../../../factory/base';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

type Context = Awaited<ReturnType<typeof init>>;

/**
 * Guards `MetaService` against running a satellite table inside a meta-DB
 * transaction. A satellite (NC_AUDIT_DB / NC_CHAT_DB / NC_DOCS_DB /
 * NC_OP_LOG_DB) lives on a connection distinct from the meta pool, so
 * forwarding the meta transaction would write to the wrong DB — or fail — once
 * a satellite is configured. The guard fires only when (a) a transaction is
 * active, (b) the target is a satellite table, and (c) that satellite has its
 * own pool that differs from this service's pool.
 *
 * Unit runs have no satellite DB configured, so we temporarily fake
 * `Noco._ncChatMessages` to a stub with a chosen `knexInstance` to drive both
 * branches deterministically.
 */
export function metaSatelliteTrxGuardTests() {
  describe('MetaService satellite-transaction guard', () => {
    let context: Context;
    let ctx: { workspace_id: string; base_id: string };

    beforeEach(async () => {
      context = await init();
      const base = await createProject(context, {
        title: 'SatelliteGuardBase',
      });
      ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
    });

    it('throws when a meta transaction targets a satellite table on a different pool', async () => {
      const trx = await Noco.ncMeta.startTransaction();
      const original = Noco._ncChatMessages;
      let threw = false;
      try {
        // Pretend NC_CHAT_DB is configured on a pool distinct from the meta trx.
        Noco._ncChatMessages = { knexInstance: {} };
        await trx.metaList2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.CHAT_MESSAGES,
          {},
        );
      } catch (e) {
        threw = true;
        expect((e as Error).message).to.match(/satellite table/i);
      } finally {
        Noco._ncChatMessages = original;
        await trx.rollback();
      }
      expect(threw, 'expected the guard to throw').to.eq(true);
    });

    it('does not throw when the transaction pool matches the satellite pool', async () => {
      const trx = await Noco.ncMeta.startTransaction();
      const original = Noco._ncChatMessages;
      try {
        // Satellite resolves to the same underlying pool as the trx → allowed.
        Noco._ncChatMessages = { knexInstance: trx.knexInstance };
        await trx.metaDelete(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.CHAT_MESSAGES,
          { base_id: '__none__' },
        );
      } finally {
        Noco._ncChatMessages = original;
        await trx.rollback();
      }
    });

    it('does not throw without an active transaction', async () => {
      const original = Noco._ncChatMessages;
      try {
        // Distinct satellite pool, but the root meta service has no transaction.
        Noco._ncChatMessages = { knexInstance: {} };
        await Noco.ncMeta.metaDelete(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.CHAT_MESSAGES,
          { base_id: '__none__' },
        );
      } finally {
        Noco._ncChatMessages = original;
      }
    });
  });
}

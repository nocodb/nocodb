import { expect } from 'chai';
import request from 'supertest';
import { AuditV1OperationTypes, ViewTypes } from 'nocodb-sdk';
import {
  beforeEach as dataApiV3BeforeEach,
  beforeEachTextBased,
} from './beforeEach';
import { createView } from '../../../factory/view';
import Noco from '~/Noco';
import { View } from '~/models';
import { MetaTable } from '~/utils/globals';
import type { Column, Model } from '~/models';
import type { ITestContext } from '../../../init';

// Regression coverage for the audit NULL-actor fix: anonymous public
// shared-form submissions must record the ANONYMOUS_USER actor (usranonymous /
// anonymous@nocodb.com) and stamp the originating shared view id into
// nc_audit.fk_ref_id — instead of leaving fk_user_id / user NULL.
describe('public-shared-form-audit-actor', () => {
  let testContext: ITestContext;
  let table: Model;
  let _columns: Column[];

  beforeEach(async () => {
    testContext = await dataApiV3BeforeEach();
    const initResult = await beforeEachTextBased(testContext);
    table = initResult.table;
    _columns = initResult.columns;
  });

  const queryAnonAudit = async (fkRefId: string) =>
    Noco.ncAudit
      .knex(MetaTable.AUDIT)
      .where('base_id', testContext.ctx.base_id)
      .where('fk_model_id', table.id)
      .where('fk_ref_id', fkRefId)
      .orderBy('id', 'desc')
      .first();

  it('attributes anonymous shared-form submissions to ANONYMOUS_USER + fk_ref_id', async () => {
    // create a FORM view and share it (gives it a uuid)
    const formView = await createView(testContext.context, {
      title: 'AnonForm',
      table,
      type: ViewTypes.FORM,
    });

    await request(testContext.context.app)
      .post(`/api/v1/db/meta/views/${formView.id}/share`)
      .set('xc-auth', testContext.context.token)
      .expect(200);

    const sharedView = await View.get(testContext.ctx, formView.id);
    expect(sharedView.uuid, 'shared form should have a uuid').to.be.a('string');

    // submit to the PUBLIC endpoint with NO auth header — mirrors an
    // anonymous browser form submission (req.user is empty)
    const submitRes = await request(testContext.context.app)
      .post(`/api/v2/public/shared-view/${sharedView.uuid}/rows`)
      .send({
        data: { SingleLineText: 'anon-submit', Email: 'anon@example.com' },
      });

    expect(submitRes.status, JSON.stringify(submitRes.body)).to.equal(200);

    // audit may be written fire-and-forget; poll briefly
    let auditRow: any;
    for (let i = 0; i < 50; i++) {
      auditRow = await queryAnonAudit(formView.id);
      if (auditRow) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(auditRow, 'DATA_INSERT audit for the public submission should exist')
      .to.exist;
    expect(auditRow.op_type).to.equal(AuditV1OperationTypes.DATA_INSERT);
    expect(auditRow.fk_user_id).to.equal('usranonymous');
    expect(auditRow.user).to.equal('anonymous@nocodb.com');
    expect(auditRow.fk_ref_id).to.equal(formView.id);
  });
});

import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes, UITypes } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { overrideFeature } from '../../../utils/plan.utils';
import { createProject } from '../../../factory/base';

export default function () {
  if (!isEE()) {
    return true;
  }

  describe('Comments v3', () => {
    let context: Awaited<ReturnType<typeof init>>;
    let baseId: string;
    let tableId: string;
    let rowId: string;
    let API_PREFIX: string;
    let featureMock: any;

    async function _createComment(comment: string) {
      const response = await request(context.app)
        .post(`${API_PREFIX}/tables/${tableId}/records/${rowId}/comments`)
        .set('xc-auth', context.token)
        .send({ comment })
        .expect(200);

      return response.body;
    }

    function _validateComment(comment: any) {
      expect(comment).to.be.an('object');
      expect(comment).to.have.property('id').that.is.a('string');
      expect(comment).to.have.property('record_id');
      expect(comment).to.have.property('table_id');
      expect(comment).to.have.property('comment').that.is.a('string');
      expect(comment).to.have.property('created_by');
      expect(comment).to.have.property('created_at');
      expect(comment).to.have.property('updated_at');
    }

    beforeEach(async () => {
      context = await init();

      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_API_COMMENT_V3}`,
        allowed: true,
      });

      const base = await createProject(context);
      baseId = base.id;
      API_PREFIX = `/api/v3/meta/bases/${baseId}`;

      // Create a table
      const tableResponse = await request(context.app)
        .post(`/api/v1/db/meta/projects/${baseId}/tables`)
        .set('xc-token', context.xc_token)
        .send({
          table_name: 'comment_test_table',
          title: 'Comment Test Table',
          columns: [
            {
              title: 'Title',
              uidt: UITypes.SingleLineText,
            },
          ],
        })
        .expect(200);
      tableId = tableResponse.body.id;

      // Create a row
      const rowResponse = await request(context.app)
        .post(`/api/v1/db/data/noco/${baseId}/${tableId}`)
        .set('xc-token', context.xc_token)
        .send({ Title: 'Test Record' })
        .expect(200);
      rowId = rowResponse.body.Id;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    it('List comments - empty', async () => {
      const response = await request(context.app)
        .get(`${API_PREFIX}/tables/${tableId}/records/${rowId}/comments`)
        .set('xc-auth', context.token)
        .expect(200);

      expect(response.body).to.have.property('list');
      expect(response.body.list).to.be.an('array').with.lengthOf(0);
    });

    it('Create comment', async () => {
      const comment = await _createComment('Hello world');

      _validateComment(comment);
      expect(comment.comment).to.equal('Hello world');
      expect(comment.record_id).to.equal(`${rowId}`);
      expect(comment.table_id).to.equal(tableId);
    });

    it('List comments after create', async () => {
      await _createComment('Comment 1');
      await _createComment('Comment 2');

      const response = await request(context.app)
        .get(`${API_PREFIX}/tables/${tableId}/records/${rowId}/comments`)
        .set('xc-auth', context.token)
        .expect(200);

      expect(response.body.list).to.be.an('array').with.lengthOf(2);
      response.body.list.forEach(_validateComment);
    });

    it('Update comment', async () => {
      const created = await _createComment('Original text');

      const updateResponse = await request(context.app)
        .patch(`${API_PREFIX}/comments/${created.id}`)
        .set('xc-auth', context.token)
        .send({ comment: 'Updated text' })
        .expect(200);

      _validateComment(updateResponse.body);
      expect(updateResponse.body.comment).to.equal('Updated text');

      // Verify via list
      const listResponse = await request(context.app)
        .get(`${API_PREFIX}/tables/${tableId}/records/${rowId}/comments`)
        .set('xc-auth', context.token)
        .expect(200);

      const updated = listResponse.body.list.find(
        (c: any) => c.id === created.id,
      );
      expect(updated.comment).to.equal('Updated text');
    });

    it('Delete comment', async () => {
      const created = await _createComment('To be deleted');

      await request(context.app)
        .delete(`${API_PREFIX}/comments/${created.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // Verify deleted (soft-delete: should not appear in list)
      const listResponse = await request(context.app)
        .get(`${API_PREFIX}/tables/${tableId}/records/${rowId}/comments`)
        .set('xc-auth', context.token)
        .expect(200);

      expect(listResponse.body.list).to.be.an('array').with.lengthOf(0);
    });

    it('Resolve comment', async () => {
      const created = await _createComment('To be resolved');

      // Resolve
      const resolveResponse = await request(context.app)
        .post(`${API_PREFIX}/comments/${created.id}/resolve`)
        .set('xc-auth', context.token)
        .expect(200);

      _validateComment(resolveResponse.body);
      expect(resolveResponse.body.resolved_by).to.be.a('string');

      // Unresolve (toggle)
      const unresolveResponse = await request(context.app)
        .post(`${API_PREFIX}/comments/${created.id}/resolve`)
        .set('xc-auth', context.token)
        .expect(200);

      expect(unresolveResponse.body.resolved_by).to.not.be.ok;
    });

    it('Count comments', async () => {
      await _createComment('Count test 1');
      await _createComment('Count test 2');

      const response = await request(context.app)
        .get(`${API_PREFIX}/tables/${tableId}/comments/count`)
        .query({ ids: rowId })
        .set('xc-auth', context.token)
        .expect(200);

      expect(response.body).to.be.an('array').with.lengthOf(1);
      expect(response.body[0]).to.have.property('record_id', `${rowId}`);
      expect(response.body[0]).to.have.property('count');
      expect(Number(response.body[0].count)).to.equal(2);
    });

    it('Create comment - missing comment field', async () => {
      await request(context.app)
        .post(`${API_PREFIX}/tables/${tableId}/records/${rowId}/comments`)
        .set('xc-auth', context.token)
        .send({})
        .expect(400);
    });

    it('Forbidden when feature not in plan', async () => {
      await featureMock?.restore?.();

      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_API_COMMENT_V3}`,
        allowed: false,
      });

      const response = await request(context.app)
        .get(`${API_PREFIX}/tables/${tableId}/records/${rowId}/comments`)
        .set('xc-auth', context.token)
        .expect(403);

      expect(response.body).to.have.property(
        'error',
        'ERR_FEATURE_NOT_SUPPORTED',
      );
    });

    it('CRUD flow', async () => {
      // Create
      const c1 = await _createComment('First');
      const c2 = await _createComment('Second');
      const c3 = await _createComment('Third');

      // List - 3 comments
      let list = (
        await request(context.app)
          .get(`${API_PREFIX}/tables/${tableId}/records/${rowId}/comments`)
          .set('xc-auth', context.token)
          .expect(200)
      ).body.list;
      expect(list).to.have.lengthOf(3);

      // Update second
      await request(context.app)
        .patch(`${API_PREFIX}/comments/${c2.id}`)
        .set('xc-auth', context.token)
        .send({ comment: 'Second updated' })
        .expect(200);

      // Delete third
      await request(context.app)
        .delete(`${API_PREFIX}/comments/${c3.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // List - 2 comments, second is updated
      list = (
        await request(context.app)
          .get(`${API_PREFIX}/tables/${tableId}/records/${rowId}/comments`)
          .set('xc-auth', context.token)
          .expect(200)
      ).body.list;
      expect(list).to.have.lengthOf(2);

      const updated = list.find((c: any) => c.id === c2.id);
      expect(updated.comment).to.equal('Second updated');

      // Count
      const countResponse = await request(context.app)
        .get(`${API_PREFIX}/tables/${tableId}/comments/count`)
        .query({ ids: rowId })
        .set('xc-auth', context.token)
        .expect(200);
      expect(Number(countResponse.body[0].count)).to.equal(2);
    });
  });
}

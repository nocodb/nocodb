import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { isEE } from '../../../utils/helpers';
import init from '../../../init';
import { overrideFeature } from '../../../utils/plan.utils';

export default function () {
  if (!isEE()) {
    return true;
  }

  describe.only(`Dashboards v3`, () => {
    let context: Awaited<ReturnType<typeof init>>;
    let initBase: any;
    let API_PREFIX: string;
    let featureMock: any;

    async function _createDashboard(args: {
      title: string;
      description?: string;
    }) {
      const response = await request(context.app)
        .post(
          `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=dashboardCreate`,
        )
        .set('xc-auth', context.token)
        .send(args)
        .expect(200);

      return response.body;
    }

    async function _createWidget(args: {
      title: string;
      fk_dashboard_id: string;
      type: string;
      description?: string;
      config?: any;
    }) {
      const response = await request(context.app)
        .post(
          `/api/v2/internal/${context.fk_workspace_id}/${initBase.id}?operation=widgetCreate`,
        )
        .set('xc-auth', context.token)
        .send(args)
        .expect(200);

      return response.body;
    }

    beforeEach(async () => {
      context = await init();
      const workspaceId = context.fk_workspace_id;

      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_API_DASHBOARD_V3}`,
        allowed: true,
      });

      const baseResult = await request(context.app)
        .post(`/api/v3/meta/workspaces/${workspaceId}/bases`)
        .set('xc-token', context.xc_token)
        .send({
          title: 'DashboardTestBase',
        })
        .expect(200);
      initBase = baseResult.body;
      API_PREFIX = `/api/v3/meta/bases/${initBase.id}`;
    });

    afterEach(async () => {
      await featureMock?.restore?.();
    });

    it('List Dashboards v3', async () => {
      await _createDashboard({ title: 'Dashboard 1' });
      await _createDashboard({
        title: 'Dashboard 2',
        description: 'Second dashboard',
      });

      const listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .expect(200);

      const dashboards = listResponse.body.list;
      expect(dashboards).to.be.an('array');
      expect(dashboards).to.have.lengthOf(2);

      const first = dashboards.find((d) => d.title === 'Dashboard 1');
      expect(first).to.exist;
      expect(first).to.have.property('id');
      expect(first).to.have.property('title', 'Dashboard 1');
      expect(first).to.have.property('base_id', initBase.id);
      expect(first).to.have.property('workspace_id');
      expect(first).to.have.property('created_at');
      expect(first).to.have.property('updated_at');

      // Should use v3 naming (workspace_id, not fk_workspace_id)
      expect(first).to.not.have.property('fk_workspace_id');

      const second = dashboards.find((d) => d.title === 'Dashboard 2');
      expect(second).to.exist;
      expect(second).to.have.property('description', 'Second dashboard');
    });

    it('Get Dashboard v3', async () => {
      const dashboard = await _createDashboard({
        title: 'Get Test Dashboard',
        description: 'Dashboard for get test',
      });

      const getResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      const body = getResponse.body;
      expect(body).to.have.property('id', dashboard.id);
      expect(body).to.have.property('title', 'Get Test Dashboard');
      expect(body).to.have.property('description', 'Dashboard for get test');
      expect(body).to.have.property('base_id', initBase.id);
      expect(body).to.have.property('workspace_id');
      expect(body).to.have.property('created_at');
      expect(body).to.have.property('updated_at');

      // Without includeWidgets, widgets should not be present
      expect(body).to.not.have.property('widgets');
    });

    it('Get Dashboard v3 - with includeWidgets', async () => {
      const dashboard = await _createDashboard({
        title: 'Dashboard with Widgets',
      });
      await _createWidget({
        title: 'Widget A',
        fk_dashboard_id: dashboard.id,
        type: 'text',
      });
      await _createWidget({
        title: 'Widget B',
        fk_dashboard_id: dashboard.id,
        type: 'text',
      });

      const getResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}`)
        .query({ include: 'widgets' })
        .set('xc-auth', context.token)
        .expect(200);

      const body = getResponse.body;
      expect(body).to.have.property('id', dashboard.id);
      expect(body).to.have.property('widgets');
      expect(body.widgets).to.be.an('array').that.has.lengthOf(2);

      const widgetA = body.widgets.find((w) => w.title === 'Widget A');
      expect(widgetA).to.exist;
      expect(widgetA).to.have.property('id');
      expect(widgetA).to.have.property('dashboard_id', dashboard.id);
      expect(widgetA).to.have.property('type', 'text');
      expect(widgetA).to.have.property('created_at');
      expect(widgetA).to.have.property('updated_at');

      // Should use v3 naming
      expect(widgetA).to.not.have.property('fk_dashboard_id');
      expect(widgetA).to.not.have.property('fk_model_id');
      expect(widgetA).to.not.have.property('fk_view_id');
    });

    it('Get Dashboard v3 - not found', async () => {
      const errNotFound = await request(context.app)
        .get(`${API_PREFIX}/dashboards/nonexistent_id`)
        .set('xc-auth', context.token)
        .expect(422);

      expect(errNotFound.body).to.have.property('error');
      expect(errNotFound.body).to.have.property('message');
    });

    it('List Widgets v3', async () => {
      const dashboard = await _createDashboard({ title: 'Widget List Test' });
      await _createWidget({
        title: 'Widget 1',
        fk_dashboard_id: dashboard.id,
        type: 'text',
      });
      await _createWidget({
        title: 'Widget 2',
        fk_dashboard_id: dashboard.id,
        type: 'text',
        description: 'Second widget',
      });

      const listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .expect(200);

      const widgets = listResponse.body.list;
      expect(widgets).to.be.an('array');
      expect(widgets).to.have.lengthOf(2);

      const first = widgets.find((w) => w.title === 'Widget 1');
      expect(first).to.exist;
      expect(first).to.have.property('id');
      expect(first).to.have.property('dashboard_id', dashboard.id);
      expect(first).to.have.property('type', 'text');
      expect(first).to.have.property('created_at');
      expect(first).to.have.property('updated_at');

      // v3 naming
      expect(first).to.not.have.property('fk_dashboard_id');

      const second = widgets.find((w) => w.title === 'Widget 2');
      expect(second).to.have.property('description', 'Second widget');
    });

    it('Get Widget v3', async () => {
      const dashboard = await _createDashboard({ title: 'Widget Get Test' });
      const widget = await _createWidget({
        title: 'Single Widget',
        fk_dashboard_id: dashboard.id,
        type: 'text',
        description: 'A single widget',
      });

      const getResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}/widgets/${widget.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      const body = getResponse.body;
      expect(body).to.have.property('id', widget.id);
      expect(body).to.have.property('title', 'Single Widget');
      expect(body).to.have.property('description', 'A single widget');
      expect(body).to.have.property('dashboard_id', dashboard.id);
      expect(body).to.have.property('type', 'text');
      expect(body).to.have.property('created_at');
      expect(body).to.have.property('updated_at');
      expect(body).to.have.property('error');
      expect(body.error).to.be.a('boolean');

      // v3 naming
      expect(body).to.not.have.property('fk_dashboard_id');
      expect(body).to.not.have.property('fk_model_id');
      expect(body).to.not.have.property('fk_view_id');
    });

    it('Get Widget v3 - not found', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Not Found Test',
      });

      await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}/widgets/nonexistent_id`)
        .set('xc-auth', context.token)
        .expect(404);
    });

    it('Dashboard Data v3', async () => {
      const dashboard = await _createDashboard({
        title: 'Dashboard Data Test',
      });
      const widget = await _createWidget({
        title: 'Data Widget',
        fk_dashboard_id: dashboard.id,
        type: 'text',
      });

      const dataResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}/data`)
        .set('xc-auth', context.token)
        .expect(200);

      const body = dataResponse.body;
      expect(body).to.have.property('widgets');
      expect(body.widgets).to.be.an('object');
      expect(body.widgets).to.have.property(widget.id);
    });

    it('Widget Data v3', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Data Test',
      });
      const widget = await _createWidget({
        title: 'Data Widget',
        fk_dashboard_id: dashboard.id,
        type: 'text',
      });

      const dataResponse = await request(context.app)
        .get(
          `${API_PREFIX}/dashboards/${dashboard.id}/widgets/${widget.id}/data`,
        )
        .set('xc-auth', context.token)
        .expect(200);

      // Widget data shape varies by widget type; just verify it returns
      expect(dataResponse.body).to.exist;
    });

    it('Forbidden due to plan not sufficient', async () => {
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_API_DASHBOARD_V3}`,
        allowed: false,
      });

      const listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .expect(403);

      const error = listResponse.body;
      expect(error).to.be.an('object');
      expect(error).to.have.property('error', 'ERR_FEATURE_NOT_SUPPORTED');
    });

    it('Empty dashboard list', async () => {
      const listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .expect(200);

      expect(listResponse.body.list).to.be.an('array').that.is.empty;
    });

    it('Empty widget list', async () => {
      const dashboard = await _createDashboard({
        title: 'Empty Widget Test',
      });

      const listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .expect(200);

      expect(listResponse.body.list).to.be.an('array').that.is.empty;
    });

    // --- Phase 2: Mutation endpoints ---

    it('Create Dashboard v3', async () => {
      const createResponse = await request(context.app)
        .post(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .send({ title: 'New Dashboard', description: 'Created via v3 API' })
        .expect(200);

      const body = createResponse.body;
      expect(body).to.have.property('id');
      expect(body).to.have.property('title', 'New Dashboard');
      expect(body).to.have.property('description', 'Created via v3 API');
      expect(body).to.have.property('base_id', initBase.id);
      expect(body).to.have.property('workspace_id');
      expect(body).to.have.property('created_at');
      expect(body).to.have.property('updated_at');

      // v3 naming
      expect(body).to.not.have.property('fk_workspace_id');

      // Verify it shows up in the list
      const listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .expect(200);

      const found = listResponse.body.list.find((d: any) => d.id === body.id);
      expect(found).to.exist;
      expect(found).to.have.property('title', 'New Dashboard');
    });

    it('Create Dashboard v3 - minimal (title only)', async () => {
      const createResponse = await request(context.app)
        .post(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .send({ title: 'Minimal Dashboard' })
        .expect(200);

      expect(createResponse.body).to.have.property('id');
      expect(createResponse.body).to.have.property(
        'title',
        'Minimal Dashboard',
      );
    });

    it('Create Dashboard v3 - missing title', async () => {
      await request(context.app)
        .post(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .send({ description: 'No title provided' })
        .expect(400);
    });

    it('Update Dashboard v3', async () => {
      const dashboard = await _createDashboard({ title: 'Before Update' });

      const updateResponse = await request(context.app)
        .patch(`${API_PREFIX}/dashboards/${dashboard.id}`)
        .set('xc-auth', context.token)
        .send({
          title: 'After Update',
          description: 'Updated description',
        })
        .expect(200);

      const body = updateResponse.body;
      expect(body).to.have.property('id', dashboard.id);
      expect(body).to.have.property('title', 'After Update');
      expect(body).to.have.property('description', 'Updated description');

      // Verify by fetching
      const getResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      expect(getResponse.body).to.have.property('title', 'After Update');
      expect(getResponse.body).to.have.property(
        'description',
        'Updated description',
      );
    });

    it('Update Dashboard v3 - partial update', async () => {
      const dashboard = await _createDashboard({
        title: 'Partial Update Test',
        description: 'Original description',
      });

      const updateResponse = await request(context.app)
        .patch(`${API_PREFIX}/dashboards/${dashboard.id}`)
        .set('xc-auth', context.token)
        .send({ title: 'Updated Title Only' })
        .expect(200);

      expect(updateResponse.body).to.have.property(
        'title',
        'Updated Title Only',
      );
    });

    it('Update Dashboard v3 - not found', async () => {
      const errNotFound = await request(context.app)
        .patch(`${API_PREFIX}/dashboards/nonexistent_id`)
        .set('xc-auth', context.token)
        .send({ title: 'Updated' })
        .expect(422);

      expect(errNotFound.body).to.have.property('error');
    });

    it('Delete Dashboard v3', async () => {
      const dashboard = await _createDashboard({
        title: 'Dashboard to Delete',
      });

      await request(context.app)
        .delete(`${API_PREFIX}/dashboards/${dashboard.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // Verify it's deleted
      await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}`)
        .set('xc-auth', context.token)
        .expect(422);
    });

    it('Delete Dashboard v3 - not found', async () => {
      const errNotFound = await request(context.app)
        .delete(`${API_PREFIX}/dashboards/nonexistent_id`)
        .set('xc-auth', context.token)
        .expect(422);

      expect(errNotFound.body).to.have.property('error');
    });

    it('Create Widget v3', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Create Test',
      });

      const createResponse = await request(context.app)
        .post(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .send({
          title: 'New Widget',
          type: 'text',
          description: 'Created via v3 API',
        })
        .expect(200);

      const body = createResponse.body;
      expect(body).to.have.property('id');
      expect(body).to.have.property('title', 'New Widget');
      expect(body).to.have.property('description', 'Created via v3 API');
      expect(body).to.have.property('dashboard_id', dashboard.id);
      expect(body).to.have.property('type', 'text');
      expect(body).to.have.property('created_at');
      expect(body).to.have.property('updated_at');
      expect(body).to.have.property('error');
      expect(body.error).to.be.a('boolean');

      // v3 naming
      expect(body).to.not.have.property('fk_dashboard_id');
      expect(body).to.not.have.property('fk_model_id');
      expect(body).to.not.have.property('fk_view_id');

      // Verify it shows up in the widget list
      const listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .expect(200);

      const found = listResponse.body.list.find((w: any) => w.id === body.id);
      expect(found).to.exist;
      expect(found).to.have.property('title', 'New Widget');
    });

    it('Create Widget v3 - with position', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Position Test',
      });

      const createResponse = await request(context.app)
        .post(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .send({
          title: 'Positioned Widget',
          type: 'text',
          position: { x: 0, y: 0, w: 6, h: 4 },
        })
        .expect(200);

      const body = createResponse.body;
      expect(body).to.have.property('title', 'Positioned Widget');
      expect(body).to.have.property('position');
      expect(body.position).to.deep.include({ x: 0, y: 0, w: 6, h: 4 });
    });

    it('Create Widget v3 - missing required fields', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Validation Test',
      });

      // Missing type
      await request(context.app)
        .post(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .send({ title: 'No Type' })
        .expect(400);

      // Missing title
      await request(context.app)
        .post(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .send({ type: 'text' })
        .expect(400);
    });

    it('Update Widget v3', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Update Test',
      });
      const widget = await _createWidget({
        title: 'Before Update',
        fk_dashboard_id: dashboard.id,
        type: 'text',
      });

      const updateResponse = await request(context.app)
        .patch(`${API_PREFIX}/dashboards/${dashboard.id}/widgets/${widget.id}`)
        .set('xc-auth', context.token)
        .send({
          title: 'After Update',
          description: 'Updated widget',
        })
        .expect(200);

      const body = updateResponse.body;
      expect(body).to.have.property('id', widget.id);
      expect(body).to.have.property('title', 'After Update');
      expect(body).to.have.property('description', 'Updated widget');
      expect(body).to.have.property('dashboard_id', dashboard.id);

      // v3 naming
      expect(body).to.not.have.property('fk_dashboard_id');

      // Verify by fetching
      const getResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}/widgets/${widget.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      expect(getResponse.body).to.have.property('title', 'After Update');
    });

    it('Update Widget v3 - partial update', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Partial Update',
      });
      const widget = await _createWidget({
        title: 'Original Title',
        fk_dashboard_id: dashboard.id,
        type: 'text',
        description: 'Original desc',
      });

      const updateResponse = await request(context.app)
        .patch(`${API_PREFIX}/dashboards/${dashboard.id}/widgets/${widget.id}`)
        .set('xc-auth', context.token)
        .send({ title: 'Updated Title Only' })
        .expect(200);

      expect(updateResponse.body).to.have.property(
        'title',
        'Updated Title Only',
      );
    });

    it('Update Widget v3 - not found', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Not Found Update',
      });

      await request(context.app)
        .patch(
          `${API_PREFIX}/dashboards/${dashboard.id}/widgets/nonexistent_id`,
        )
        .set('xc-auth', context.token)
        .send({ title: 'Updated' })
        .expect(404);
    });

    it('Delete Widget v3', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Delete Test',
      });
      const widget = await _createWidget({
        title: 'Widget to Delete',
        fk_dashboard_id: dashboard.id,
        type: 'text',
      });

      await request(context.app)
        .delete(`${API_PREFIX}/dashboards/${dashboard.id}/widgets/${widget.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // Verify it's deleted
      await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}/widgets/${widget.id}`)
        .set('xc-auth', context.token)
        .expect(404);
    });

    it('Delete Widget v3 - not found', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Not Found Delete',
      });

      await request(context.app)
        .delete(
          `${API_PREFIX}/dashboards/${dashboard.id}/widgets/nonexistent_id`,
        )
        .set('xc-auth', context.token)
        .expect(404);
    });

    it('Multiple dashboard operations v3', async () => {
      // Create via v3
      await request(context.app)
        .post(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .send({ title: 'Dashboard 1' })
        .expect(200);

      const d2 = await request(context.app)
        .post(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .send({ title: 'Dashboard 2' })
        .expect(200);

      const d3 = await request(context.app)
        .post(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .send({ title: 'Dashboard 3' })
        .expect(200);

      // List — should have 3
      let listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .expect(200);
      expect(listResponse.body.list).to.have.lengthOf(3);

      // Update one
      await request(context.app)
        .patch(`${API_PREFIX}/dashboards/${d2.body.id}`)
        .set('xc-auth', context.token)
        .send({ title: 'Dashboard 2 Updated' })
        .expect(200);

      // Delete one
      await request(context.app)
        .delete(`${API_PREFIX}/dashboards/${d3.body.id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // List — should have 2
      listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .expect(200);
      expect(listResponse.body.list).to.have.lengthOf(2);

      const updated = listResponse.body.list.find(
        (d: any) => d.id === d2.body.id,
      );
      expect(updated).to.have.property('title', 'Dashboard 2 Updated');
    });

    it('Multiple widget operations v3', async () => {
      const dashboard = await _createDashboard({
        title: 'Widget Ops Test',
      });

      // Create widgets via v3
      await request(context.app)
        .post(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .send({ title: 'Widget 1', type: 'text' })
        .expect(200);

      const w2 = await request(context.app)
        .post(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .send({ title: 'Widget 2', type: 'text' })
        .expect(200);

      const w3 = await request(context.app)
        .post(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .send({ title: 'Widget 3', type: 'text' })
        .expect(200);

      // List — should have 3
      let listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .expect(200);
      expect(listResponse.body.list).to.have.lengthOf(3);

      // Update one
      await request(context.app)
        .patch(`${API_PREFIX}/dashboards/${dashboard.id}/widgets/${w2.body.id}`)
        .set('xc-auth', context.token)
        .send({ title: 'Widget 2 Updated' })
        .expect(200);

      // Delete one
      await request(context.app)
        .delete(
          `${API_PREFIX}/dashboards/${dashboard.id}/widgets/${w3.body.id}`,
        )
        .set('xc-auth', context.token)
        .expect(200);

      // List — should have 2
      listResponse = await request(context.app)
        .get(`${API_PREFIX}/dashboards/${dashboard.id}/widgets`)
        .set('xc-auth', context.token)
        .expect(200);
      expect(listResponse.body.list).to.have.lengthOf(2);

      const updated = listResponse.body.list.find(
        (w: any) => w.id === w2.body.id,
      );
      expect(updated).to.have.property('title', 'Widget 2 Updated');
    });

    it('Forbidden mutations due to plan not sufficient', async () => {
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: `${PlanFeatureTypes.FEATURE_API_DASHBOARD_V3}`,
        allowed: false,
      });

      const createResponse = await request(context.app)
        .post(`${API_PREFIX}/dashboards`)
        .set('xc-auth', context.token)
        .send({ title: 'Should Fail' })
        .expect(403);

      expect(createResponse.body).to.have.property(
        'error',
        'ERR_FEATURE_NOT_SUPPORTED',
      );
    });
  });
}

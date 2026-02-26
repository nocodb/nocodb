import { expect } from 'chai';
import request from 'supertest';
import { createProject } from '../../../factory/base';
import init from '../../../init';
import type { IInitContext, ITestContext } from '../../../init';

const API_VERSION = 'v3';

describe.only('workflowApiV3', () => {
  let testContext: ITestContext;
  let app: any;
  let token: string;
  let baseId: string;

  beforeEach(async () => {
    const context = await init();
    const base = await createProject(context);

    testContext = {
      context,
      ctx: {
        workspace_id: base.fk_workspace_id!,
        base_id: base.id,
      },
      base,
    } as ITestContext;

    app = context.app;
    token = context.token;
    baseId = base.id;
  });

  const workflowUrlPrefix = () =>
    `/api/${API_VERSION}/meta/bases/${baseId}/workflows`;

  async function ncGet(url: string, status = 200) {
    const response = await request(app).get(url).set('xc-auth', token).send({});
    expect(response.status).to.equal(status);
    return response;
  }

  async function ncPost(url: string, body: any = {}, status = 200) {
    const response = await request(app)
      .post(url)
      .set('xc-auth', token)
      .send(body);
    expect(response.status).to.equal(status);
    return response;
  }

  async function ncPatch(url: string, body: any = {}, status = 200) {
    const response = await request(app)
      .patch(url)
      .set('xc-auth', token)
      .send(body);
    expect(response.status).to.equal(status);
    return response;
  }

  async function ncDelete(url: string, status = 200) {
    const response = await request(app)
      .delete(url)
      .set('xc-auth', token)
      .send({});
    expect(response.status).to.equal(status);
    return response;
  }

  describe('GET endpoints', () => {
    it('List workflows - empty', async function () {
      const rsp = await ncGet(workflowUrlPrefix());
      expect(rsp.body).to.have.property('list');
      expect(rsp.body.list).to.be.an('array');
      expect(rsp.body.list).to.have.length(0);
    });

    it('List workflows - after create', async function () {
      // Create a workflow first
      const createRsp = await ncPost(workflowUrlPrefix(), {
        title: 'Test Workflow',
        description: 'A test workflow',
      });
      expect(createRsp.body).to.have.property('id');

      const rsp = await ncGet(workflowUrlPrefix());
      expect(rsp.body.list).to.have.length(1);
      expect(rsp.body.list[0]).to.have.property('id');
      expect(rsp.body.list[0]).to.have.property('title', 'Test Workflow');
      expect(rsp.body.list[0]).to.have.property(
        'description',
        'A test workflow',
      );
      expect(rsp.body.list[0]).to.have.property('base_id', baseId);
      expect(rsp.body.list[0]).to.have.property('workspace_id');
      expect(rsp.body.list[0]).to.have.property('enabled');
      expect(rsp.body.list[0]).to.have.property('created_at');
      expect(rsp.body.list[0]).to.have.property('updated_at');
    });

    it('Get workflow by ID', async function () {
      const createRsp = await ncPost(workflowUrlPrefix(), {
        title: 'Get Test Workflow',
      });
      const workflowId = createRsp.body.id;

      const rsp = await ncGet(`${workflowUrlPrefix()}/${workflowId}`);
      expect(rsp.body).to.have.property('id', workflowId);
      expect(rsp.body).to.have.property('title', 'Get Test Workflow');
      expect(rsp.body).to.have.property('base_id', baseId);
      expect(rsp.body).to.have.property('workspace_id');
      expect(rsp.body).to.have.property('enabled');
      expect(rsp.body).to.have.property('created_at');
      expect(rsp.body).to.have.property('updated_at');
    });

    it('Get workflow - not found', async function () {
      await ncGet(`${workflowUrlPrefix()}/nonexistent123`, 422);
    });

    it('List executions - empty', async function () {
      const createRsp = await ncPost(workflowUrlPrefix(), {
        title: 'Exec Test Workflow',
      });
      const workflowId = createRsp.body.id;

      const rsp = await ncGet(
        `${workflowUrlPrefix()}/${workflowId}/executions`,
      );
      expect(rsp.body).to.have.property('list');
      expect(rsp.body.list).to.be.an('array');
    });

    it('List executions - with pagination params', async function () {
      const createRsp = await ncPost(workflowUrlPrefix(), {
        title: 'Paginated Exec Workflow',
      });
      const workflowId = createRsp.body.id;

      const rsp = await ncGet(
        `${workflowUrlPrefix()}/${workflowId}/executions?limit=10&offset=0`,
      );
      expect(rsp.body).to.have.property('list');
      expect(rsp.body.list).to.be.an('array');
    });

    it('No auth token - returns 401', async function () {
      const response = await request(app).get(workflowUrlPrefix()).send({});
      expect(response.status).to.equal(401);
    });
  });

  describe('POST endpoints', () => {
    it('Create workflow - minimal', async function () {
      const rsp = await ncPost(workflowUrlPrefix(), {
        title: 'Minimal Workflow',
      });
      expect(rsp.body).to.have.property('id');
      expect(rsp.body).to.have.property('title', 'Minimal Workflow');
      expect(rsp.body).to.have.property('base_id', baseId);
      expect(rsp.body).to.have.property('workspace_id');
      expect(rsp.body).to.have.property('enabled', false);
      expect(rsp.body).to.have.property('created_at');
      expect(rsp.body).to.have.property('updated_at');
    });

    it('Create workflow - with description', async function () {
      const rsp = await ncPost(workflowUrlPrefix(), {
        title: 'Described Workflow',
        description: 'This is a workflow with a description',
      });
      expect(rsp.body).to.have.property('title', 'Described Workflow');
      expect(rsp.body).to.have.property(
        'description',
        'This is a workflow with a description',
      );
    });

    it('Create workflow - missing title', async function () {
      await ncPost(workflowUrlPrefix(), {}, 400);
    });

    it('Duplicate workflow', async function () {
      const createRsp = await ncPost(workflowUrlPrefix(), {
        title: 'Original Workflow',
        description: 'Original description',
      });
      const workflowId = createRsp.body.id;

      const dupRsp = await ncPost(
        `${workflowUrlPrefix()}/${workflowId}/duplicate`,
      );
      expect(dupRsp.body).to.have.property('id');
      expect(dupRsp.body.id).to.not.equal(workflowId);
      expect(dupRsp.body).to.have.property('title');
      expect(dupRsp.body.title).to.include('Original Workflow');
      expect(dupRsp.body).to.have.property(
        'description',
        'Original description',
      );
    });
  });

  describe('PATCH endpoints', () => {
    it('Update workflow title', async function () {
      const createRsp = await ncPost(workflowUrlPrefix(), {
        title: 'Before Update',
      });
      const workflowId = createRsp.body.id;

      const rsp = await ncPatch(`${workflowUrlPrefix()}/${workflowId}`, {
        title: 'After Update',
      });
      expect(rsp.body).to.have.property('title', 'After Update');
    });

    it('Update workflow description', async function () {
      const createRsp = await ncPost(workflowUrlPrefix(), {
        title: 'Desc Update Workflow',
      });
      const workflowId = createRsp.body.id;

      const rsp = await ncPatch(`${workflowUrlPrefix()}/${workflowId}`, {
        description: 'Updated description',
      });
      expect(rsp.body).to.have.property('description', 'Updated description');
    });

    it('Update workflow - not found', async function () {
      await ncPatch(
        `${workflowUrlPrefix()}/nonexistent123`,
        {
          title: 'Test',
        },
        422,
      );
    });
  });

  describe('DELETE endpoints', () => {
    it('Delete workflow', async function () {
      const createRsp = await ncPost(workflowUrlPrefix(), {
        title: 'To Delete Workflow',
      });
      const workflowId = createRsp.body.id;

      await ncDelete(`${workflowUrlPrefix()}/${workflowId}`);

      // Verify it's gone
      await ncGet(`${workflowUrlPrefix()}/${workflowId}`, 422);
    });

    it('Delete workflow - not found', async function () {
      await ncDelete(`${workflowUrlPrefix()}/nonexistent123`, 422);
    });
  });

  describe('Full CRUD lifecycle', () => {
    it('Create, List, Get, Update, Duplicate, Delete', async function () {
      // Create
      const createRsp = await ncPost(workflowUrlPrefix(), {
        title: 'CRUD Workflow',
        description: 'Test full lifecycle',
      });
      const workflowId = createRsp.body.id;
      expect(createRsp.body.title).to.equal('CRUD Workflow');

      // List
      const listRsp = await ncGet(workflowUrlPrefix());
      expect(listRsp.body.list.length).to.be.greaterThan(0);
      const found = listRsp.body.list.find((w: any) => w.id === workflowId);
      expect(found).to.exist;

      // Get
      const getRsp = await ncGet(`${workflowUrlPrefix()}/${workflowId}`);
      expect(getRsp.body.id).to.equal(workflowId);

      // Update
      const updateRsp = await ncPatch(`${workflowUrlPrefix()}/${workflowId}`, {
        title: 'Updated CRUD Workflow',
        description: 'Updated lifecycle',
      });
      expect(updateRsp.body.title).to.equal('Updated CRUD Workflow');
      expect(updateRsp.body.description).to.equal('Updated lifecycle');

      // Duplicate
      const dupRsp = await ncPost(
        `${workflowUrlPrefix()}/${workflowId}/duplicate`,
      );
      expect(dupRsp.body.id).to.not.equal(workflowId);
      expect(dupRsp.body.description).to.equal('Updated lifecycle');

      // Delete original
      await ncDelete(`${workflowUrlPrefix()}/${workflowId}`);

      // Delete duplicate
      await ncDelete(`${workflowUrlPrefix()}/${dupRsp.body.id}`);

      // Verify both gone
      const finalList = await ncGet(workflowUrlPrefix());
      const remaining = finalList.body.list.filter(
        (w: any) => w.id === workflowId || w.id === dupRsp.body.id,
      );
      expect(remaining).to.have.length(0);
    });
  });
});

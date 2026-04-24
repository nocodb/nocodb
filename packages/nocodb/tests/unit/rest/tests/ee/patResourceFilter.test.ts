import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { createProject } from '../../../factory/base';
import init from '../../../init';

// End-to-end tests for PAT resource filtering across list endpoints.
// See src/ee/helpers/patResourceFilter.ts
//
// Note: V1 flat `/api/v1/db/meta/projects/` is not exercised here — in EE mode
// that endpoint has ACL scope=workspace and falls back to the default workspace
// when no context is supplied, which test users have no role in. Production
// n8n/Make flows use the workspace-scoped V3 endpoint and the workspace list.
function patResourceFilterTests() {
  let context: any;
  let ws1: any;
  let ws2: any;
  let baseA: any;
  let baseB: any;
  let baseC: any;

  beforeEach(async function () {
    console.time('#### patResourceFilterTests');
    context = await init();

    ws1 = { id: context.fk_workspace_id };
    baseA = await createProject(context, { title: 'BaseA' });
    baseB = await createProject(context, { title: 'BaseB' });

    // Second workspace with its own base
    const ws2Res = await request(context.app)
      .post('/api/v1/workspaces')
      .set('xc-auth', context.token)
      .send({ title: 'Workspace2', meta: { color: '#ff0000' } });
    ws2 = ws2Res.body;

    const baseCRes = await request(context.app)
      .post('/api/v1/db/meta/projects/')
      .set('xc-auth', context.token)
      .send({ title: 'BaseC', fk_workspace_id: ws2.id });
    baseC = baseCRes.body;

    console.timeEnd('#### patResourceFilterTests');
  });

  /**
   * Create a fine-grained API token via the internal API and return its plaintext value.
   */
  const createFineGrainedToken = async (scopes: any[]): Promise<string> => {
    const res = await request(context.app)
      .post('/api/v2/internal/nc/nc?operation=apiTokenCreateWithScopes')
      .set('xc-auth', context.token)
      .send({
        title: `test-token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        scopes,
      })
      .expect(200);
    return res.body.token as string;
  };

  // ─────────────────────────────────────────────
  // V3 base list — /api/v3/meta/workspaces/:ws/bases
  // Workspace-scoped endpoint. The auth strategy enforces workspace scope
  // matching for fine-grained tokens, so only workspace- or all-scoped tokens
  // (and JWT users) can reach this endpoint.
  // ─────────────────────────────────────────────
  describe('V3 base list (/api/v3/meta/workspaces/:ws/bases)', () => {
    it('JWT user sees BaseA and BaseB', async () => {
      const res = await request(context.app)
        .get(`/api/v3/meta/workspaces/${ws1.id}/bases`)
        .set('xc-auth', context.token)
        .expect(200);

      const ids = res.body.list.map((b: any) => b.id);
      expect(ids).to.include.members([baseA.id, baseB.id]);
    });

    it('PAT scoped to workspace ws1 sees BaseA and BaseB', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'workspace', resource_id: ws1.id },
      ]);

      const res = await request(context.app)
        .get(`/api/v3/meta/workspaces/${ws1.id}/bases`)
        .set('xc-token', token)
        .expect(200);

      const ids = res.body.list.map((b: any) => b.id);
      expect(ids).to.include.members([baseA.id, baseB.id]);
    });

    it('PAT with "all resources" sees all bases in ws1', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'all', resource_id: '*' } as any,
      ]);

      const res = await request(context.app)
        .get(`/api/v3/meta/workspaces/${ws1.id}/bases`)
        .set('xc-token', token)
        .expect(200);

      const ids = res.body.list.map((b: any) => b.id);
      expect(ids).to.include.members([baseA.id, baseB.id]);
    });

    it('PAT scoped to workspace ws2 cannot list ws1 bases', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'workspace', resource_id: ws2.id },
      ]);

      // Auth strategy rejects scope mismatch at workspace-scoped endpoint
      const res = await request(context.app)
        .get(`/api/v3/meta/workspaces/${ws1.id}/bases`)
        .set('xc-token', token);

      expect([401, 403]).to.include(res.status);
    });
  });

  // ─────────────────────────────────────────────
  // V1 workspace list — /api/v1/workspaces
  // Scope = 'org', so all auth types (JWT, legacy, scoped PAT) can reach it.
  // ─────────────────────────────────────────────
  describe('V1 workspace list (/api/v1/workspaces)', () => {
    it('JWT user sees all workspaces', async () => {
      const res = await request(context.app)
        .get('/api/v1/workspaces')
        .set('xc-auth', context.token)
        .expect(200);

      const ids = res.body.list.map((w: any) => w.id);
      expect(ids).to.include.members([ws1.id, ws2.id]);
    });

    it('legacy token (xc_token) sees all workspaces', async () => {
      const res = await request(context.app)
        .get('/api/v1/workspaces')
        .set('xc-token', context.xc_token)
        .expect(200);

      const ids = res.body.list.map((w: any) => w.id);
      expect(ids).to.include.members([ws1.id, ws2.id]);
    });

    it('PAT scoped to BaseA (in ws1) returns only ws1', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'base', resource_id: baseA.id },
      ]);

      const res = await request(context.app)
        .get('/api/v1/workspaces')
        .set('xc-token', token)
        .expect(200);

      const ids = res.body.list.map((w: any) => w.id);
      expect(ids).to.deep.equal([ws1.id]);
    });

    it('PAT scoped to BaseA + BaseC returns both workspaces', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'base', resource_id: baseA.id },
        { resource_type: 'base', resource_id: baseC.id },
      ]);

      const res = await request(context.app)
        .get('/api/v1/workspaces')
        .set('xc-token', token)
        .expect(200);

      const ids = res.body.list.map((w: any) => w.id).sort();
      expect(ids).to.deep.equal([ws1.id, ws2.id].sort());
    });

    it('PAT with explicit workspace scope returns that workspace', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'workspace', resource_id: ws2.id },
      ]);

      const res = await request(context.app)
        .get('/api/v1/workspaces')
        .set('xc-token', token)
        .expect(200);

      const ids = res.body.list.map((w: any) => w.id);
      expect(ids).to.deep.equal([ws2.id]);
    });

    it('PAT with "all resources" sees every workspace', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'all', resource_id: '*' } as any,
      ]);

      const res = await request(context.app)
        .get('/api/v1/workspaces')
        .set('xc-token', token)
        .expect(200);

      const ids = res.body.list.map((w: any) => w.id);
      expect(ids).to.include.members([ws1.id, ws2.id]);
    });
  });

  // ─────────────────────────────────────────────
  // Internal baseListAll — /api/v2/internal/nc/nc?operation=baseListAll
  // Scope = 'org', context-free — used by the n8n/Make discovery flow.
  // ─────────────────────────────────────────────
  describe('internal baseListAll', () => {
    it('JWT user sees all workspaces with all bases', async () => {
      const res = await request(context.app)
        .get('/api/v2/internal/nc/nc?operation=baseListAll')
        .set('xc-auth', context.token)
        .expect(200);

      const wsIds = res.body.workspaces.map((w: any) => w.id);
      expect(wsIds).to.include.members([ws1.id, ws2.id]);
    });

    it('PAT scoped to BaseA returns only ws1 with only BaseA inside', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'base', resource_id: baseA.id },
      ]);

      const res = await request(context.app)
        .get('/api/v2/internal/nc/nc?operation=baseListAll')
        .set('xc-token', token)
        .expect(200);

      expect(res.body.workspaces).to.have.lengthOf(1);
      expect(res.body.workspaces[0].id).to.equal(ws1.id);
      const baseIds = res.body.workspaces[0].bases.map((b: any) => b.id);
      expect(baseIds).to.deep.equal([baseA.id]);
    });

    it('PAT scoped to workspace ws1 returns ws1 with all its bases', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'workspace', resource_id: ws1.id },
      ]);

      const res = await request(context.app)
        .get('/api/v2/internal/nc/nc?operation=baseListAll')
        .set('xc-token', token)
        .expect(200);

      const ws1Entry = res.body.workspaces.find((w: any) => w.id === ws1.id);
      expect(ws1Entry).to.not.be.undefined;
      const baseIds = ws1Entry.bases.map((b: any) => b.id);
      expect(baseIds).to.include.members([baseA.id, baseB.id]);
    });

    it('PAT scoped to BaseA + BaseC returns two workspaces, each filtered', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'base', resource_id: baseA.id },
        { resource_type: 'base', resource_id: baseC.id },
      ]);

      const res = await request(context.app)
        .get('/api/v2/internal/nc/nc?operation=baseListAll')
        .set('xc-token', token)
        .expect(200);

      expect(res.body.workspaces).to.have.lengthOf(2);
      const wsIds = res.body.workspaces.map((w: any) => w.id).sort();
      expect(wsIds).to.deep.equal([ws1.id, ws2.id].sort());

      for (const ws of res.body.workspaces) {
        const allowedBases = ws.id === ws1.id ? [baseA.id] : [baseC.id];
        const gotBases = ws.bases.map((b: any) => b.id);
        expect(gotBases).to.deep.equal(allowedBases);
      }
    });

    it('PAT with "all resources" sees every workspace with all bases', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'all', resource_id: '*' } as any,
      ]);

      const res = await request(context.app)
        .get('/api/v2/internal/nc/nc?operation=baseListAll')
        .set('xc-token', token)
        .expect(200);

      const wsIds = res.body.workspaces.map((w: any) => w.id);
      expect(wsIds).to.include.members([ws1.id, ws2.id]);
    });
  });
}

export default function () {
  describe('PAT Resource Filter', patResourceFilterTests);
}

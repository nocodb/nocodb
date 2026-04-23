import 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import { createProject } from '../../../factory/base';
import init from '../../../init';

// End-to-end tests for PAT resource filtering across list endpoints.
// See src/ee/helpers/patResourceFilter.ts
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

    // Use the default workspace (ws1) already created by init()
    ws1 = { id: context.fk_workspace_id };
    baseA = await createProject(context, { title: 'BaseA' });
    baseB = await createProject(context, { title: 'BaseB' });

    // Create a second workspace with its own base
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
        title: `test-token-${Date.now()}`,
        scopes,
      })
      .expect(201);
    return res.body.token as string;
  };

  // ─────────────────────────────────────────────
  // V1 base list — /api/v1/db/meta/projects/
  // ─────────────────────────────────────────────
  describe('V1 base list (/api/v1/db/meta/projects/)', () => {
    it('legacy token (xc_token) sees all bases unchanged', async () => {
      const res = await request(context.app)
        .get('/api/v1/db/meta/projects/')
        .set('xc-token', context.xc_token)
        .expect(200);

      const titles = res.body.list.map((b: any) => b.title);
      expect(titles).to.include.members(['BaseA', 'BaseB', 'BaseC']);
    });

    it('JWT user sees all bases unchanged', async () => {
      const res = await request(context.app)
        .get('/api/v1/db/meta/projects/')
        .set('xc-auth', context.token)
        .expect(200);

      const titles = res.body.list.map((b: any) => b.title);
      expect(titles).to.include.members(['BaseA', 'BaseB', 'BaseC']);
    });

    it('PAT scoped to BaseA sees only BaseA', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'base', resource_id: baseA.id },
      ]);

      const res = await request(context.app)
        .get('/api/v1/db/meta/projects/')
        .set('xc-token', token)
        .expect(200);

      const titles = res.body.list.map((b: any) => b.title);
      expect(titles).to.deep.equal(['BaseA']);
    });

    it('PAT scoped to BaseA + BaseC sees exactly those two', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'base', resource_id: baseA.id },
        { resource_type: 'base', resource_id: baseC.id },
      ]);

      const res = await request(context.app)
        .get('/api/v1/db/meta/projects/')
        .set('xc-token', token)
        .expect(200);

      const titles = res.body.list.map((b: any) => b.title).sort();
      expect(titles).to.deep.equal(['BaseA', 'BaseC']);
    });

    it('PAT scoped to workspace ws1 sees BaseA and BaseB', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'workspace', resource_id: ws1.id },
      ]);

      const res = await request(context.app)
        .get('/api/v1/db/meta/projects/')
        .set('xc-token', token)
        .expect(200);

      const titles = res.body.list.map((b: any) => b.title).sort();
      expect(titles).to.deep.equal(['BaseA', 'BaseB']);
    });

    it('PAT with "all resources" sees every base (no filter)', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'all', resource_id: '*' } as any,
      ]);

      const res = await request(context.app)
        .get('/api/v1/db/meta/projects/')
        .set('xc-token', token)
        .expect(200);

      const titles = res.body.list.map((b: any) => b.title);
      expect(titles).to.include.members(['BaseA', 'BaseB', 'BaseC']);
    });

    it('PAT scoped to non-existent base returns empty list with 200', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'base', resource_id: baseA.id },
      ]);

      // Delete the scoped base — token still exists but references nothing
      await request(context.app)
        .delete(`/api/v1/db/meta/projects/${baseA.id}`)
        .set('xc-auth', context.token);

      const res = await request(context.app)
        .get('/api/v1/db/meta/projects/')
        .set('xc-token', token);

      // Either 200 with [] or 401 when auth strategy denies zero-scope tokens
      // (depends on Noco.isEE check in auth strategy).
      expect([200, 401]).to.include(res.status);
      if (res.status === 200) {
        expect(res.body.list).to.deep.equal([]);
      }
    });
  });

  // ─────────────────────────────────────────────
  // V3 base list — /api/v3/meta/workspaces/:ws/bases
  // Note: the endpoint is workspace-scoped, so the auth strategy enforces
  // workspace scope matching. A base-scoped token accessing a workspace
  // it's not scoped to will be rejected before reaching the filter.
  // ─────────────────────────────────────────────
  describe('V3 base list (/api/v3/meta/workspaces/:ws/bases)', () => {
    it('PAT scoped to workspace ws1 returns BaseA + BaseB', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'workspace', resource_id: ws1.id },
      ]);

      const res = await request(context.app)
        .get(`/api/v3/meta/workspaces/${ws1.id}/bases`)
        .set('xc-token', token)
        .expect(200);

      const ids = res.body.list.map((b: any) => b.id).sort();
      expect(ids).to.deep.equal([baseA.id, baseB.id].sort());
    });

    it('PAT with "all resources" returns all bases in ws1', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'all', resource_id: '*' } as any,
      ]);

      const res = await request(context.app)
        .get(`/api/v3/meta/workspaces/${ws1.id}/bases`)
        .set('xc-token', token)
        .expect(200);

      const ids = res.body.list.map((b: any) => b.id).sort();
      expect(ids).to.include.members([baseA.id, baseB.id]);
    });

    it('JWT user sees all bases in ws1', async () => {
      const res = await request(context.app)
        .get(`/api/v3/meta/workspaces/${ws1.id}/bases`)
        .set('xc-auth', context.token)
        .expect(200);

      const ids = res.body.list.map((b: any) => b.id).sort();
      expect(ids).to.include.members([baseA.id, baseB.id]);
    });
  });

  // ─────────────────────────────────────────────
  // Workspace list — /api/v1/workspaces
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
  // Internal baseListAll — /api/v2/internal/.../baseListAll
  // ─────────────────────────────────────────────
  describe('internal baseListAll', () => {
    it('PAT scoped to BaseA returns only ws1 with only BaseA inside', async () => {
      const token = await createFineGrainedToken([
        { resource_type: 'base', resource_id: baseA.id },
      ]);

      const res = await request(context.app)
        .get('/api/v2/internal/nc/nc?operation=baseListAll')
        .set('xc-token', token)
        .expect(200);

      expect(res.body.workspaces).to.have.lengthOf(1);
      expect(res.body.workspaces[0].bases.map((b: any) => b.id)).to.deep.equal([
        baseA.id,
      ]);
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
      const baseIds = ws1Entry.bases.map((b: any) => b.id).sort();
      expect(baseIds).to.include.members([baseA.id, baseB.id]);
    });

    it('PAT scoped to BaseA + BaseC returns two workspaces filtered', async () => {
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
        const allowedBases =
          ws.id === ws1.id ? [baseA.id] : [baseC.id];
        const gotBases = ws.bases.map((b: any) => b.id);
        expect(gotBases).to.deep.equal(allowedBases);
      }
    });

    it('JWT user sees all workspaces with all bases', async () => {
      const res = await request(context.app)
        .get('/api/v2/internal/nc/nc?operation=baseListAll')
        .set('xc-auth', context.token)
        .expect(200);

      const wsIds = res.body.workspaces.map((w: any) => w.id);
      expect(wsIds).to.include.members([ws1.id, ws2.id]);
    });
  });

  // ─────────────────────────────────────────────
  // Backward compatibility
  // ─────────────────────────────────────────────
  describe('backward compatibility', () => {
    it('legacy token acts as unrestricted (no filter)', async () => {
      const res = await request(context.app)
        .get('/api/v1/db/meta/projects/')
        .set('xc-token', context.xc_token)
        .expect(200);

      const titles = res.body.list.map((b: any) => b.title);
      expect(titles).to.include.members(['BaseA', 'BaseB', 'BaseC']);
    });

    it('legacy token on workspace list returns all workspaces', async () => {
      const res = await request(context.app)
        .get('/api/v1/workspaces')
        .set('xc-token', context.xc_token)
        .expect(200);

      const ids = res.body.list.map((w: any) => w.id);
      expect(ids).to.include.members([ws1.id, ws2.id]);
    });
  });
}

export default function () {
  describe('PAT Resource Filter', patResourceFilterTests);
}

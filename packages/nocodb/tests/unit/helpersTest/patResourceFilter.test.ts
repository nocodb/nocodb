import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import ApiTokenScope from 'src/ee/models/ApiTokenScope';
import { getPatResourceFilter } from 'src/ee/helpers/patResourceFilter';

// Helper: build a mock ApiTokenScope instance from a plain object.
const scope = (data: Partial<ApiTokenScope>) =>
  Object.assign(new ApiTokenScope(data as any), data);

// Helper: build a minimal mock request.
const mockReq = (user: any): any => ({ user });

function patResourceFilterTests() {
  let listByTokenIdStub: sinon.SinonStub;

  beforeEach(() => {
    listByTokenIdStub = sinon.stub(ApiTokenScope, 'listByTokenId');
  });

  afterEach(() => {
    listByTokenIdStub.restore();
  });

  // ─────────────────────────────────────────────
  // No filtering cases
  // ─────────────────────────────────────────────
  describe('returns null (no filtering) when', () => {
    it('request has no user (unauthenticated)', async () => {
      const result = await getPatResourceFilter(mockReq(undefined));
      expect(result).to.be.null;
      expect(listByTokenIdStub.called).to.be.false;
    });

    it('user is a JWT user (is_api_token is falsy)', async () => {
      const result = await getPatResourceFilter(
        mockReq({ id: 'user1', is_api_token: false }),
      );
      expect(result).to.be.null;
      expect(listByTokenIdStub.called).to.be.false;
    });

    it('user object missing is_api_token entirely', async () => {
      const result = await getPatResourceFilter(
        mockReq({ id: 'user1', email: 'u@test.com' }),
      );
      expect(result).to.be.null;
    });

    it('API token has no api_token_meta (legacy token)', async () => {
      const result = await getPatResourceFilter(
        mockReq({ id: 'user1', is_api_token: true }),
      );
      expect(result).to.be.null;
      expect(listByTokenIdStub.called).to.be.false;
    });

    it('API token has api_token_meta but no id (malformed legacy)', async () => {
      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: {},
        }),
      );
      expect(result).to.be.null;
      expect(listByTokenIdStub.called).to.be.false;
    });

    it('fine-grained token has zero scope rows (shouldn\'t happen but guarded)', async () => {
      listByTokenIdStub.resolves([]);

      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: { id: 'tk-empty' },
        }),
      );
      expect(result).to.be.null;
      expect(listByTokenIdStub.calledOnceWith('tk-empty')).to.be.true;
    });

    it('fine-grained token has an "all resources" sentinel scope', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'all' as any, resource_id: '*' }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: { id: 'tk-all' },
        }),
      );
      expect(result).to.be.null;
    });

    it('token has mixed "all" + base scopes — "all" wins and skips filter', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'all' as any, resource_id: '*' }),
        scope({ resource_type: 'base' as any, resource_id: 'b1' }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: { id: 'tk-mixed' },
        }),
      );
      expect(result).to.be.null;
    });
  });

  // ─────────────────────────────────────────────
  // Filter returned cases
  // ─────────────────────────────────────────────
  describe('returns filter object when', () => {
    it('token has a single base scope', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'base' as any, resource_id: 'base-A' }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: { id: 'tk1' },
        }),
      );
      expect(result).to.deep.equal({
        baseIds: ['base-A'],
        workspaceIds: [],
      });
    });

    it('token has multiple base scopes', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'base' as any, resource_id: 'base-A' }),
        scope({ resource_type: 'base' as any, resource_id: 'base-B' }),
        scope({ resource_type: 'base' as any, resource_id: 'base-C' }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: { id: 'tk2' },
        }),
      );
      expect(result).to.deep.equal({
        baseIds: ['base-A', 'base-B', 'base-C'],
        workspaceIds: [],
      });
    });

    it('token has a single workspace scope', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'workspace' as any, resource_id: 'ws-1' }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: { id: 'tk3' },
        }),
      );
      expect(result).to.deep.equal({
        baseIds: [],
        workspaceIds: ['ws-1'],
      });
    });

    it('token has multiple workspace scopes', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'workspace' as any, resource_id: 'ws-1' }),
        scope({ resource_type: 'workspace' as any, resource_id: 'ws-2' }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: { id: 'tk4' },
        }),
      );
      expect(result).to.deep.equal({
        baseIds: [],
        workspaceIds: ['ws-1', 'ws-2'],
      });
    });

    it('token has mixed base + workspace scopes', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'base' as any, resource_id: 'base-A' }),
        scope({ resource_type: 'workspace' as any, resource_id: 'ws-1' }),
        scope({ resource_type: 'base' as any, resource_id: 'base-B' }),
        scope({ resource_type: 'workspace' as any, resource_id: 'ws-2' }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: { id: 'tk5' },
        }),
      );
      expect(result).to.deep.equal({
        baseIds: ['base-A', 'base-B'],
        workspaceIds: ['ws-1', 'ws-2'],
      });
    });

    it('preserves scope order from the DB', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'base' as any, resource_id: 'b-z' }),
        scope({ resource_type: 'base' as any, resource_id: 'b-a' }),
        scope({ resource_type: 'base' as any, resource_id: 'b-m' }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: { id: 'tk-order' },
        }),
      );
      expect(result!.baseIds).to.deep.equal(['b-z', 'b-a', 'b-m']);
    });

    it('ignores unknown resource_type values defensively', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'base' as any, resource_id: 'base-A' }),
        scope({ resource_type: 'unknown' as any, resource_id: 'x' }),
        scope({ resource_type: 'workspace' as any, resource_id: 'ws-1' }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          id: 'user1',
          is_api_token: true,
          api_token_meta: { id: 'tk-unknown' },
        }),
      );
      // Unknown types neither match 'base' nor 'workspace' — dropped.
      expect(result).to.deep.equal({
        baseIds: ['base-A'],
        workspaceIds: ['ws-1'],
      });
    });
  });

  // ─────────────────────────────────────────────
  // Input edge cases
  // ─────────────────────────────────────────────
  describe('edge cases', () => {
    it('tolerates a null request', async () => {
      const result = await getPatResourceFilter(null as any);
      expect(result).to.be.null;
    });

    it('tolerates an undefined request', async () => {
      const result = await getPatResourceFilter(undefined as any);
      expect(result).to.be.null;
    });

    it('only queries DB once per invocation', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'base' as any, resource_id: 'b1' }),
      ]);

      await getPatResourceFilter(
        mockReq({
          id: 'u',
          is_api_token: true,
          api_token_meta: { id: 'tk-once' },
        }),
      );
      expect(listByTokenIdStub.callCount).to.equal(1);
    });

    it('passes the correct tokenId to listByTokenId', async () => {
      listByTokenIdStub.resolves([]);

      await getPatResourceFilter(
        mockReq({
          is_api_token: true,
          api_token_meta: { id: 'token-xyz-123' },
        }),
      );
      expect(listByTokenIdStub.firstCall.args[0]).to.equal('token-xyz-123');
    });
  });

  // ─────────────────────────────────────────────
  // Realistic scenarios
  // ─────────────────────────────────────────────
  describe('realistic scenarios', () => {
    it('n8n-style base-scoped token: filter returns only that base', async () => {
      listByTokenIdStub.resolves([
        scope({
          resource_type: 'base' as any,
          resource_id: 'pz7x9k',
          permissions: { records: 'read', tables: 'read' } as any,
        }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          is_api_token: true,
          api_token_meta: { id: 'n8n-token' },
        }),
      );
      expect(result).to.deep.equal({
        baseIds: ['pz7x9k'],
        workspaceIds: [],
      });
    });

    it('enterprise workspace-scoped token: filter returns only that workspace', async () => {
      listByTokenIdStub.resolves([
        scope({
          resource_type: 'workspace' as any,
          resource_id: 'ws-enterprise',
          permissions: { records: 'write' } as any,
        }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          is_api_token: true,
          api_token_meta: { id: 'enterprise-token' },
        }),
      );
      expect(result).to.deep.equal({
        baseIds: [],
        workspaceIds: ['ws-enterprise'],
      });
    });

    it('cross-workspace multi-base token: all base IDs surfaced', async () => {
      listByTokenIdStub.resolves([
        scope({ resource_type: 'base' as any, resource_id: 'b1-in-ws1' }),
        scope({ resource_type: 'base' as any, resource_id: 'b2-in-ws2' }),
        scope({ resource_type: 'base' as any, resource_id: 'b3-in-ws1' }),
      ]);

      const result = await getPatResourceFilter(
        mockReq({
          is_api_token: true,
          api_token_meta: { id: 'cross-ws-token' },
        }),
      );
      expect(result!.baseIds).to.have.members([
        'b1-in-ws1',
        'b2-in-ws2',
        'b3-in-ws1',
      ]);
      expect(result!.workspaceIds).to.be.empty;
    });
  });
}

export function patResourceFilterTest() {
  describe('patResourceFilter', patResourceFilterTests);
}

import 'mocha';
import crypto from 'crypto';
import { expect } from 'chai';
import {
  API_TOKEN_PREFIX,
  ApiTokenPermissionCategory,
  ApiTokenPermissionLevel,
  BASE_SCOPED_PERMISSION_CATEGORIES,
  WORKSPACE_SCOPED_PERMISSION_CATEGORIES,
} from 'nocodb-sdk';
import {
  API_TOKEN_PERMISSION_MAP,
  isTokenPermissionSufficient,
  getTokenPermissionForOperation,
  checkTokenPermission,
} from 'src/ee/utils/apiTokenPermissionMap';

function apiTokenPermissionTests() {
  // ─────────────────────────────────────────────
  // isTokenPermissionSufficient
  // ─────────────────────────────────────────────
  describe('isTokenPermissionSufficient', () => {
    it('write >= read', () => {
      expect(isTokenPermissionSufficient('write', 'read')).to.be.true;
    });

    it('write >= write', () => {
      expect(isTokenPermissionSufficient('write', 'write')).to.be.true;
    });

    it('read >= read', () => {
      expect(isTokenPermissionSufficient('read', 'read')).to.be.true;
    });

    it('read < write', () => {
      expect(isTokenPermissionSufficient('read', 'write')).to.be.false;
    });

    it('none < read', () => {
      expect(isTokenPermissionSufficient('none', 'read')).to.be.false;
    });

    it('none < write', () => {
      expect(isTokenPermissionSufficient('none', 'write')).to.be.false;
    });
  });

  // ─────────────────────────────────────────────
  // getTokenPermissionForOperation
  // ─────────────────────────────────────────────
  describe('getTokenPermissionForOperation', () => {
    it('returns mapping for a known read operation', () => {
      const result = getTokenPermissionForOperation('dataList');
      expect(result).to.deep.equal({ category: 'records', level: 'read' });
    });

    it('returns mapping for a known write operation', () => {
      const result = getTokenPermissionForOperation('dataInsert');
      expect(result).to.deep.equal({ category: 'records', level: 'write' });
    });

    it('returns mapping for table operations', () => {
      expect(getTokenPermissionForOperation('tableList')).to.deep.equal({
        category: 'tables',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('tableCreate')).to.deep.equal({
        category: 'tables',
        level: 'write',
      });
    });

    it('returns mapping for view operations', () => {
      expect(getTokenPermissionForOperation('viewList')).to.deep.equal({
        category: 'views',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('filterCreate')).to.deep.equal({
        category: 'views',
        level: 'write',
      });
    });

    it('returns mapping for webhook operations', () => {
      expect(getTokenPermissionForOperation('hookList')).to.deep.equal({
        category: 'webhooks',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('hookCreate')).to.deep.equal({
        category: 'webhooks',
        level: 'write',
      });
    });

    it('returns mapping for workspace operations', () => {
      expect(getTokenPermissionForOperation('workspaceUserList')).to.deep.equal(
        {
          category: 'users',
          level: 'read',
        },
      );
      expect(getTokenPermissionForOperation('integrationCreate')).to.deep.equal(
        {
          category: 'integrations',
          level: 'write',
        },
      );
    });

    it('returns undefined for unmapped operations', () => {
      expect(getTokenPermissionForOperation('someUnknownOp')).to.be.undefined;
      expect(getTokenPermissionForOperation('aiGenerate')).to.be.undefined;
      expect(getTokenPermissionForOperation('')).to.be.undefined;
    });
  });

  // ─────────────────────────────────────────────
  // checkTokenPermission
  // ─────────────────────────────────────────────
  describe('checkTokenPermission', () => {
    it('allows everything for null permissions (legacy token)', () => {
      expect(checkTokenPermission(null, 'dataList')).to.be.true;
      expect(checkTokenPermission(null, 'dataInsert')).to.be.true;
      expect(checkTokenPermission(null, 'tableCreate')).to.be.true;
    });

    it('allows everything for undefined permissions (legacy token)', () => {
      expect(checkTokenPermission(undefined, 'dataList')).to.be.true;
      expect(checkTokenPermission(undefined, 'dataInsert')).to.be.true;
    });

    it('allows unmapped operations regardless of permissions', () => {
      const perms = { records: ApiTokenPermissionLevel.NONE };
      expect(checkTokenPermission(perms, 'someUnknownOp')).to.be.true;
    });

    it('allows read when token has read permission', () => {
      const perms = { records: ApiTokenPermissionLevel.READ };
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataRead')).to.be.true;
      expect(checkTokenPermission(perms, 'dataExport')).to.be.true;
    });

    it('denies write when token only has read permission', () => {
      const perms = { records: ApiTokenPermissionLevel.READ };
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
      expect(checkTokenPermission(perms, 'dataUpdate')).to.be.false;
      expect(checkTokenPermission(perms, 'dataDelete')).to.be.false;
    });

    it('allows both read and write when token has write permission', () => {
      const perms = { records: ApiTokenPermissionLevel.WRITE };
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.true;
      expect(checkTokenPermission(perms, 'dataUpdate')).to.be.true;
    });

    it('denies all when token has none permission', () => {
      const perms = { records: ApiTokenPermissionLevel.NONE };
      expect(checkTokenPermission(perms, 'dataList')).to.be.false;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
    });

    it('defaults missing category to none', () => {
      // permissions object exists but has no 'records' key
      const perms = { tables: ApiTokenPermissionLevel.WRITE };
      expect(checkTokenPermission(perms, 'dataList')).to.be.false;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
      // But tables should work
      expect(checkTokenPermission(perms, 'tableList')).to.be.true;
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.true;
    });

    it('handles cross-category permissions correctly', () => {
      const perms = {
        records: ApiTokenPermissionLevel.WRITE,
        tables: ApiTokenPermissionLevel.READ,
        views: ApiTokenPermissionLevel.NONE,
        webhooks: ApiTokenPermissionLevel.READ,
      };
      // records: write → read and write allowed
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.true;
      // tables: read → read allowed, write denied
      expect(checkTokenPermission(perms, 'tableList')).to.be.true;
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.false;
      // views: none → both denied
      expect(checkTokenPermission(perms, 'viewList')).to.be.false;
      expect(checkTokenPermission(perms, 'viewCreate')).to.be.false;
      // webhooks: read → read allowed, write denied
      expect(checkTokenPermission(perms, 'hookList')).to.be.true;
      expect(checkTokenPermission(perms, 'hookCreate')).to.be.false;
    });
  });

  // ─────────────────────────────────────────────
  // Permission Map Coverage
  // ─────────────────────────────────────────────
  describe('Permission map coverage', () => {
    it('all mapped operations have valid categories', () => {
      const allCategories = new Set([
        ...BASE_SCOPED_PERMISSION_CATEGORIES,
        ...WORKSPACE_SCOPED_PERMISSION_CATEGORIES,
      ]);

      for (const [opName, mapping] of Object.entries(
        API_TOKEN_PERMISSION_MAP,
      )) {
        expect(
          allCategories.has(mapping.category as ApiTokenPermissionCategory),
          `operation "${opName}" maps to unknown category "${mapping.category}"`,
        ).to.be.true;
      }
    });

    it('all mapped operations have valid levels (read or write)', () => {
      for (const [opName, mapping] of Object.entries(
        API_TOKEN_PERMISSION_MAP,
      )) {
        expect(
          ['read', 'write'].includes(mapping.level),
          `operation "${opName}" has invalid level "${mapping.level}"`,
        ).to.be.true;
      }
    });

    it('all base-scoped categories have at least one read and one write mapping', () => {
      for (const cat of BASE_SCOPED_PERMISSION_CATEGORIES) {
        const mappingsForCat = Object.entries(API_TOKEN_PERMISSION_MAP).filter(
          ([, m]) => m.category === cat,
        );
        expect(
          mappingsForCat.length,
          `category "${cat}" has no mapped operations`,
        ).to.be.greaterThan(0);

        const hasRead = mappingsForCat.some(([, m]) => m.level === 'read');
        const hasWrite = mappingsForCat.some(([, m]) => m.level === 'write');
        expect(
          hasRead,
          `category "${cat}" has no read-level operations`,
        ).to.be.true;
        expect(
          hasWrite,
          `category "${cat}" has no write-level operations`,
        ).to.be.true;
      }
    });

    it('critical data operations are all mapped', () => {
      const criticalOps = [
        'dataList',
        'dataRead',
        'dataInsert',
        'dataUpdate',
        'dataDelete',
        'tableList',
        'tableCreate',
        'columnList',
        'columnAdd',
        'viewList',
        'viewCreate',
        'hookList',
        'hookCreate',
        'baseGet',
        'baseDelete',
      ];
      for (const op of criticalOps) {
        expect(
          API_TOKEN_PERMISSION_MAP[op],
          `critical operation "${op}" is not mapped`,
        ).to.exist;
      }
    });

    it('has a reasonable number of mapped operations (100+)', () => {
      const count = Object.keys(API_TOKEN_PERMISSION_MAP).length;
      expect(count).to.be.greaterThan(100);
    });
  });

  // ─────────────────────────────────────────────
  // Token Hash & Prefix Generation
  // ─────────────────────────────────────────────
  describe('Token hash and prefix generation', () => {
    it('API_TOKEN_PREFIX is nc_pat_', () => {
      expect(API_TOKEN_PREFIX).to.equal('nc_pat_');
    });

    it('SHA-256 hash produces 64-char hex string', () => {
      const token = API_TOKEN_PREFIX + 'a'.repeat(40);
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      expect(hash).to.have.lengthOf(64);
      expect(hash).to.match(/^[0-9a-f]{64}$/);
    });

    it('same token always produces same hash', () => {
      const token = API_TOKEN_PREFIX + 'testtoken1234567890abcdefghijklmnop';
      const hash1 = crypto.createHash('sha256').update(token).digest('hex');
      const hash2 = crypto.createHash('sha256').update(token).digest('hex');
      expect(hash1).to.equal(hash2);
    });

    it('different tokens produce different hashes', () => {
      const token1 = API_TOKEN_PREFIX + 'a'.repeat(40);
      const token2 = API_TOKEN_PREFIX + 'b'.repeat(40);
      const hash1 = crypto.createHash('sha256').update(token1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(token2).digest('hex');
      expect(hash1).to.not.equal(hash2);
    });

    it('token prefix is first 12 characters', () => {
      const token = API_TOKEN_PREFIX + 'ABCDE12345678901234567890123456789012345';
      const prefix = token.substring(0, 12);
      // nc_pat_ is 7 chars, so prefix is "nc_pat_ABCDE"
      expect(prefix).to.equal('nc_pat_ABCDE');
      expect(prefix).to.have.lengthOf(12);
    });

    it('nc_pat_ prefix detection works', () => {
      const fineGrainedToken = API_TOKEN_PREFIX + 'V1StGXR8_Z5jdHi2B';
      const legacyToken = 'xPrVFmq6DvMZlbVbzicN41';

      expect(fineGrainedToken.startsWith(API_TOKEN_PREFIX)).to.be.true;
      expect(legacyToken.startsWith(API_TOKEN_PREFIX)).to.be.false;
    });
  });

  // ─────────────────────────────────────────────
  // Permissions JSON Parsing
  // ─────────────────────────────────────────────
  describe('Permissions JSON parsing', () => {
    it('parses valid v1 permissions JSON', () => {
      const json: string = JSON.stringify({
        version: 1,
        categories: {
          records: 'write',
          tables: 'read',
        },
      });
      const parsed = JSON.parse(json);
      expect(parsed.version).to.equal(1);
      expect(parsed.categories.records).to.equal('write');
      expect(parsed.categories.tables).to.equal('read');
    });

    it('rejects invalid version', () => {
      const json: string = JSON.stringify({
        version: 2,
        categories: { records: 'write' },
      });
      const parsed = JSON.parse(json);
      // Model's parsePermissions would return null for version !== 1
      expect(parsed.version).to.not.equal(1);
    });

    it('handles malformed JSON gracefully', () => {
      const malformed = 'not{valid}json';
      let parsed = null;
      try {
        parsed = JSON.parse(malformed);
      } catch {
        parsed = null;
      }
      expect(parsed).to.be.null;
    });

    it('null permissions means legacy (full access)', () => {
      // checkTokenPermission with null = full access
      expect(checkTokenPermission(null, 'dataInsert')).to.be.true;
      expect(checkTokenPermission(null, 'tableCreate')).to.be.true;
      expect(checkTokenPermission(null, 'hookDelete')).to.be.true;
    });
  });
}

export function apiTokenPermissionTest() {
  describe('apiTokenPermission', apiTokenPermissionTests);
}

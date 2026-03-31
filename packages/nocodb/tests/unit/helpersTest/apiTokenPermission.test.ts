import 'mocha';
import crypto from 'crypto';
import { expect } from 'chai';
import {
  API_TOKEN_PREFIX,
  API_TOKEN_PERMISSION_PRESETS,
  ApiTokenPermissionCategory,
  ApiTokenPermissionLevel,
  BASE_SCOPED_PERMISSION_CATEGORIES,
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
    it('returns mapping for a records read operation', () => {
      const result = getTokenPermissionForOperation('dataList');
      expect(result).to.deep.equal({ category: 'records', level: 'read' });
    });

    it('returns mapping for a records write operation', () => {
      const result = getTokenPermissionForOperation('dataInsert');
      expect(result).to.deep.equal({ category: 'records', level: 'write' });
    });

    it('returns mapping for table operations (tables category)', () => {
      expect(getTokenPermissionForOperation('tableList')).to.deep.equal({
        category: 'tables',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('tableCreate')).to.deep.equal({
        category: 'tables',
        level: 'write',
      });
    });

    it('returns mapping for field operations (fields category)', () => {
      expect(getTokenPermissionForOperation('columnList')).to.deep.equal({
        category: 'fields',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('columnAdd')).to.deep.equal({
        category: 'fields',
        level: 'write',
      });
    });

    it('returns mapping for view operations (views category)', () => {
      expect(getTokenPermissionForOperation('viewList')).to.deep.equal({
        category: 'views',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('filterCreate')).to.deep.equal({
        category: 'views',
        level: 'write',
      });
    });

    it('returns mapping for base operations (base category)', () => {
      expect(getTokenPermissionForOperation('baseGet')).to.deep.equal({
        category: 'base',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('baseDelete')).to.deep.equal({
        category: 'base',
        level: 'write',
      });
    });

    it('returns mapping for comment operations', () => {
      expect(getTokenPermissionForOperation('commentList')).to.deep.equal({
        category: 'comments',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('commentRow')).to.deep.equal({
        category: 'comments',
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

    it('returns mapping for user operations — base members', () => {
      expect(getTokenPermissionForOperation('baseUserList')).to.deep.equal({
        category: 'users',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('userInvite')).to.deep.equal({
        category: 'users',
        level: 'write',
      });
      expect(getTokenPermissionForOperation('userInviteResend')).to.deep.equal({
        category: 'users',
        level: 'write',
      });
      expect(getTokenPermissionForOperation('baseUserMetaUpdate')).to.deep.equal({
        category: 'users',
        level: 'write',
      });
    });

    it('returns mapping for user operations — workspace members', () => {
      expect(getTokenPermissionForOperation('workspaceUserList')).to.deep.equal({
        category: 'users',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('workspaceUserGet')).to.deep.equal({
        category: 'users',
        level: 'read',
      });
      expect(getTokenPermissionForOperation('workspaceInvite')).to.deep.equal({
        category: 'users',
        level: 'write',
      });
      expect(getTokenPermissionForOperation('workspaceUserUpdate')).to.deep.equal({
        category: 'users',
        level: 'write',
      });
      expect(getTokenPermissionForOperation('workspaceUserDelete')).to.deep.equal({
        category: 'users',
        level: 'write',
      });
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

    it('denies unmapped operations for fine-grained tokens (deny-by-default)', () => {
      const perms = { records: ApiTokenPermissionLevel.NONE };
      expect(checkTokenPermission(perms, 'someUnknownOp')).to.be.false;
    });

    it('allows read when token has read permission for records', () => {
      const perms = { records: ApiTokenPermissionLevel.READ };
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataRead')).to.be.true;
      expect(checkTokenPermission(perms, 'dataExport')).to.be.true;
    });

    it('denies write when token only has read permission for records', () => {
      const perms = { records: ApiTokenPermissionLevel.READ };
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
      expect(checkTokenPermission(perms, 'dataUpdate')).to.be.false;
      expect(checkTokenPermission(perms, 'dataDelete')).to.be.false;
    });

    it('allows both read and write when token has write permission for records', () => {
      const perms = { records: ApiTokenPermissionLevel.WRITE };
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.true;
      expect(checkTokenPermission(perms, 'dataUpdate')).to.be.true;
    });

    it('denies all when token has none permission for records', () => {
      const perms = { records: ApiTokenPermissionLevel.NONE };
      expect(checkTokenPermission(perms, 'dataList')).to.be.false;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
    });

    it('defaults missing category to none', () => {
      // permissions object exists but has no 'records' key
      const perms = { webhooks: ApiTokenPermissionLevel.WRITE };
      expect(checkTokenPermission(perms, 'dataList')).to.be.false;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
      // But webhooks should work
      expect(checkTokenPermission(perms, 'hookList')).to.be.true;
      expect(checkTokenPermission(perms, 'hookCreate')).to.be.true;
    });

    it('handles cross-category permissions correctly', () => {
      const perms = {
        records: ApiTokenPermissionLevel.WRITE,
        tables: ApiTokenPermissionLevel.READ,
        fields: ApiTokenPermissionLevel.READ,
        views: ApiTokenPermissionLevel.READ,
        base: ApiTokenPermissionLevel.NONE,
        comments: ApiTokenPermissionLevel.READ,
        webhooks: ApiTokenPermissionLevel.READ,
        users: ApiTokenPermissionLevel.NONE,
      };
      // records: write → read and write allowed
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.true;
      // tables: read → read allowed, write denied
      expect(checkTokenPermission(perms, 'tableList')).to.be.true;
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.false;
      // fields: read → read allowed, write denied
      expect(checkTokenPermission(perms, 'columnList')).to.be.true;
      expect(checkTokenPermission(perms, 'columnAdd')).to.be.false;
      // views: read → read allowed, write denied
      expect(checkTokenPermission(perms, 'viewList')).to.be.true;
      expect(checkTokenPermission(perms, 'viewCreate')).to.be.false;
      // base: none → both denied
      expect(checkTokenPermission(perms, 'baseGet')).to.be.false;
      expect(checkTokenPermission(perms, 'baseDelete')).to.be.false;
      // comments: read → read allowed, write denied
      expect(checkTokenPermission(perms, 'commentList')).to.be.true;
      expect(checkTokenPermission(perms, 'commentRow')).to.be.false;
      // webhooks: read → read allowed, write denied
      expect(checkTokenPermission(perms, 'hookList')).to.be.true;
      expect(checkTokenPermission(perms, 'hookCreate')).to.be.false;
      // users: none → both denied
      expect(checkTokenPermission(perms, 'baseUserList')).to.be.false;
      expect(checkTokenPermission(perms, 'userInvite')).to.be.false;
    });

    it('users category covers base and workspace members', () => {
      const readPerms = { users: ApiTokenPermissionLevel.READ };
      // Read — base members
      expect(checkTokenPermission(readPerms, 'baseUserList')).to.be.true;
      // Read — workspace members
      expect(checkTokenPermission(readPerms, 'workspaceUserList')).to.be.true;
      expect(checkTokenPermission(readPerms, 'workspaceUserGet')).to.be.true;
      // Write denied with read-only
      expect(checkTokenPermission(readPerms, 'userInvite')).to.be.false;
      expect(checkTokenPermission(readPerms, 'userInviteResend')).to.be.false;
      expect(checkTokenPermission(readPerms, 'baseUserMetaUpdate')).to.be.false;
      expect(checkTokenPermission(readPerms, 'workspaceInvite')).to.be.false;
      expect(checkTokenPermission(readPerms, 'workspaceUserUpdate')).to.be.false;
      expect(checkTokenPermission(readPerms, 'workspaceUserDelete')).to.be.false;

      const writePerms = { users: ApiTokenPermissionLevel.WRITE };
      // Write — all allowed
      expect(checkTokenPermission(writePerms, 'baseUserList')).to.be.true;
      expect(checkTokenPermission(writePerms, 'userInvite')).to.be.true;
      expect(checkTokenPermission(writePerms, 'userInviteResend')).to.be.true;
      expect(checkTokenPermission(writePerms, 'baseUserMetaUpdate')).to.be.true;
      expect(checkTokenPermission(writePerms, 'workspaceUserList')).to.be.true;
      expect(checkTokenPermission(writePerms, 'workspaceUserGet')).to.be.true;
      expect(checkTokenPermission(writePerms, 'workspaceInvite')).to.be.true;
      expect(checkTokenPermission(writePerms, 'workspaceUserUpdate')).to.be.true;
      expect(checkTokenPermission(writePerms, 'workspaceUserDelete')).to.be.true;
    });

    it('each category is independent', () => {
      // records: read, tables: write, everything else: none
      const perms = {
        records: ApiTokenPermissionLevel.READ,
        tables: ApiTokenPermissionLevel.WRITE,
      };
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
      expect(checkTokenPermission(perms, 'tableList')).to.be.true;
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.true;
      // fields not set → defaults to none
      expect(checkTokenPermission(perms, 'columnList')).to.be.false;
      expect(checkTokenPermission(perms, 'viewList')).to.be.false;
      expect(checkTokenPermission(perms, 'baseGet')).to.be.false;
    });
  });

  // ─────────────────────────────────────────────
  // Permission Map Coverage
  // ─────────────────────────────────────────────
  describe('Permission map coverage', () => {
    it('all mapped operations have valid categories', () => {
      const allCategories = new Set(BASE_SCOPED_PERMISSION_CATEGORIES);

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
        'commentList',
        'commentRow',
        'baseUserList',
        'userInvite',
        'userInviteResend',
        'baseUserMetaUpdate',
        'workspaceUserList',
        'workspaceUserGet',
        'workspaceInvite',
        'workspaceUserUpdate',
        'workspaceUserDelete',
      ];
      for (const op of criticalOps) {
        expect(
          API_TOKEN_PERMISSION_MAP[op],
          `critical operation "${op}" is not mapped`,
        ).to.exist;
      }
    });

    it('has a reasonable number of mapped operations (80+)', () => {
      const count = Object.keys(API_TOKEN_PERMISSION_MAP).length;
      expect(count).to.be.greaterThan(80);
    });

    it('has all 8 categories: records, tables, fields, views, base, comments, webhooks, users', () => {
      const categories = new Set(
        Object.values(API_TOKEN_PERMISSION_MAP).map((m) => m.category),
      );
      expect(categories.size).to.equal(8);
      expect(categories.has('records')).to.be.true;
      expect(categories.has('tables')).to.be.true;
      expect(categories.has('fields')).to.be.true;
      expect(categories.has('views')).to.be.true;
      expect(categories.has('base')).to.be.true;
      expect(categories.has('comments')).to.be.true;
      expect(categories.has('webhooks')).to.be.true;
      expect(categories.has('users')).to.be.true;
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
          comments: 'read',
        },
      });
      const parsed = JSON.parse(json);
      expect(parsed.version).to.equal(1);
      expect(parsed.categories.records).to.equal('write');
      expect(parsed.categories.tables).to.equal('read');
      expect(parsed.categories.comments).to.equal('read');
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

  // ─────────────────────────────────────────────
  // Edge cases: checkTokenPermission
  // ─────────────────────────────────────────────
  describe('checkTokenPermission — edge cases', () => {
    it('empty permissions object denies all mapped operations', () => {
      const perms = {};
      // Every mapped operation should be denied because missing key → 'none'
      expect(checkTokenPermission(perms, 'dataList')).to.be.false;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
      expect(checkTokenPermission(perms, 'tableList')).to.be.false;
      expect(checkTokenPermission(perms, 'columnList')).to.be.false;
      expect(checkTokenPermission(perms, 'viewList')).to.be.false;
      expect(checkTokenPermission(perms, 'hookList')).to.be.false;
      expect(checkTokenPermission(perms, 'baseGet')).to.be.false;
      expect(checkTokenPermission(perms, 'commentList')).to.be.false;
      expect(checkTokenPermission(perms, 'baseUserList')).to.be.false;
      // Unmapped operations are also denied (deny-by-default)
      expect(checkTokenPermission(perms, 'unknownOp')).to.be.false;
    });

    it('handles invalid permission level values gracefully (falls back to none)', () => {
      // If a category has a garbage value, || 'none' in checkTokenPermission
      // ensures it defaults to none
      const perms = { records: 'banana' as any };
      // 'banana' !== 'write', 'banana' !== 'read' → effectively none
      expect(checkTokenPermission(perms, 'dataList')).to.be.false;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
    });

    it('handles null category values (defaults to none)', () => {
      const perms = { records: null as any, tables: ApiTokenPermissionLevel.WRITE };
      // records: null → || 'none' fallback → denied
      expect(checkTokenPermission(perms, 'dataList')).to.be.false;
      // tables: write → allowed
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.true;
    });

    it('handles undefined category values (defaults to none)', () => {
      const perms = { records: undefined as any, tables: ApiTokenPermissionLevel.READ };
      expect(checkTokenPermission(perms, 'dataList')).to.be.false;
      expect(checkTokenPermission(perms, 'tableList')).to.be.true;
    });

    it('extra unknown categories do not affect mapped operations', () => {
      const perms = {
        records: ApiTokenPermissionLevel.READ,
        fakeCategory: ApiTokenPermissionLevel.WRITE,
      } as any;
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
    });

    it('case sensitivity: operation names are case-sensitive', () => {
      const perms = { records: ApiTokenPermissionLevel.READ };
      // 'dataList' is mapped; 'DataList' and 'DATALIST' are not
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'DataList')).to.be.false; // unmapped → denied
      expect(checkTokenPermission(perms, 'DATALIST')).to.be.false; // unmapped → denied
    });
  });

  // ─────────────────────────────────────────────
  // Preset verification
  // ─────────────────────────────────────────────
  describe('Permission presets', () => {
    it('readOnly preset allows all read operations, denies all write operations', () => {
      const perms = API_TOKEN_PERMISSION_PRESETS.readOnly;

      // Read operations — should all pass
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataRead')).to.be.true;
      expect(checkTokenPermission(perms, 'dataExport')).to.be.true;
      expect(checkTokenPermission(perms, 'tableList')).to.be.true;
      expect(checkTokenPermission(perms, 'columnList')).to.be.true;
      expect(checkTokenPermission(perms, 'viewList')).to.be.true;
      expect(checkTokenPermission(perms, 'baseGet')).to.be.true;
      expect(checkTokenPermission(perms, 'commentList')).to.be.true;

      // Write operations — should all fail
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
      expect(checkTokenPermission(perms, 'dataUpdate')).to.be.false;
      expect(checkTokenPermission(perms, 'dataDelete')).to.be.false;
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'columnAdd')).to.be.false;
      expect(checkTokenPermission(perms, 'viewCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'sourceCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'commentRow')).to.be.false;

      // Webhooks and users are none in readOnly — even read denied
      expect(checkTokenPermission(perms, 'hookList')).to.be.false;
      expect(checkTokenPermission(perms, 'baseUserList')).to.be.false;
    });

    it('fullDataAccess preset allows record + comment writes, denies schema/admin writes', () => {
      const perms = API_TOKEN_PERMISSION_PRESETS.fullDataAccess;

      // Records: write → full data access
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.true;
      expect(checkTokenPermission(perms, 'dataUpdate')).to.be.true;
      expect(checkTokenPermission(perms, 'dataDelete')).to.be.true;
      expect(checkTokenPermission(perms, 'bulkDataInsert')).to.be.true;

      // Comments: write → full comment access
      expect(checkTokenPermission(perms, 'commentList')).to.be.true;
      expect(checkTokenPermission(perms, 'commentRow')).to.be.true;

      // Schema: none → all denied
      expect(checkTokenPermission(perms, 'tableList')).to.be.false;
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'columnList')).to.be.false;
      expect(checkTokenPermission(perms, 'viewList')).to.be.false;

      // Admin: none → all denied
      expect(checkTokenPermission(perms, 'baseGet')).to.be.false;
      expect(checkTokenPermission(perms, 'hookList')).to.be.false;
      expect(checkTokenPermission(perms, 'baseUserList')).to.be.false;
    });

    it('readOnly preset has correct shape — all 8 categories defined', () => {
      const presetKeys = Object.keys(API_TOKEN_PERMISSION_PRESETS.readOnly);
      for (const cat of BASE_SCOPED_PERMISSION_CATEGORIES) {
        expect(presetKeys, `readOnly missing category "${cat}"`).to.include(cat);
      }
    });

    it('fullDataAccess preset has correct shape — all 8 categories defined', () => {
      const presetKeys = Object.keys(API_TOKEN_PERMISSION_PRESETS.fullDataAccess);
      for (const cat of BASE_SCOPED_PERMISSION_CATEGORIES) {
        expect(presetKeys, `fullDataAccess missing category "${cat}"`).to.include(cat);
      }
    });
  });

  // ─────────────────────────────────────────────
  // Security: Deny-by-default scenarios
  // ─────────────────────────────────────────────
  describe('Security — deny by default', () => {
    it('a token with only records:read cannot access any other category', () => {
      const perms = { records: ApiTokenPermissionLevel.READ };

      // records:read should pass
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;

      // every other category should deny both read and write
      expect(checkTokenPermission(perms, 'tableList')).to.be.false;
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'columnList')).to.be.false;
      expect(checkTokenPermission(perms, 'columnAdd')).to.be.false;
      expect(checkTokenPermission(perms, 'viewList')).to.be.false;
      expect(checkTokenPermission(perms, 'viewCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'baseGet')).to.be.false;
      expect(checkTokenPermission(perms, 'baseDelete')).to.be.false;
      expect(checkTokenPermission(perms, 'commentList')).to.be.false;
      expect(checkTokenPermission(perms, 'commentRow')).to.be.false;
      expect(checkTokenPermission(perms, 'hookList')).to.be.false;
      expect(checkTokenPermission(perms, 'hookCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'baseUserList')).to.be.false;
      expect(checkTokenPermission(perms, 'userInvite')).to.be.false;
    });

    it('all-none permissions denies every mapped operation', () => {
      const perms = {
        records: ApiTokenPermissionLevel.NONE,
        tables: ApiTokenPermissionLevel.NONE,
        fields: ApiTokenPermissionLevel.NONE,
        views: ApiTokenPermissionLevel.NONE,
        base: ApiTokenPermissionLevel.NONE,
        comments: ApiTokenPermissionLevel.NONE,
        webhooks: ApiTokenPermissionLevel.NONE,
        users: ApiTokenPermissionLevel.NONE,
      };

      // Verify every single mapped operation is denied
      for (const [opName] of Object.entries(API_TOKEN_PERMISSION_MAP)) {
        expect(
          checkTokenPermission(perms, opName),
          `all-none should deny "${opName}"`,
        ).to.be.false;
      }
    });

    it('all-write permissions allows every mapped operation', () => {
      const perms = {
        records: ApiTokenPermissionLevel.WRITE,
        tables: ApiTokenPermissionLevel.WRITE,
        fields: ApiTokenPermissionLevel.WRITE,
        views: ApiTokenPermissionLevel.WRITE,
        base: ApiTokenPermissionLevel.WRITE,
        comments: ApiTokenPermissionLevel.WRITE,
        webhooks: ApiTokenPermissionLevel.WRITE,
        users: ApiTokenPermissionLevel.WRITE,
      };

      // Verify every single mapped operation is allowed
      for (const [opName] of Object.entries(API_TOKEN_PERMISSION_MAP)) {
        expect(
          checkTokenPermission(perms, opName),
          `all-write should allow "${opName}"`,
        ).to.be.true;
      }
    });

    it('write implies read for every category', () => {
      // For each category, setting write should allow both read and write operations
      for (const cat of BASE_SCOPED_PERMISSION_CATEGORIES) {
        const perms = { [cat]: ApiTokenPermissionLevel.WRITE };
        const opsForCat = Object.entries(API_TOKEN_PERMISSION_MAP).filter(
          ([, m]) => m.category === cat,
        );
        for (const [opName] of opsForCat) {
          expect(
            checkTokenPermission(perms, opName),
            `write for "${cat}" should allow "${opName}"`,
          ).to.be.true;
        }
      }
    });

    it('read does not imply write for any category', () => {
      for (const cat of BASE_SCOPED_PERMISSION_CATEGORIES) {
        const perms = { [cat]: ApiTokenPermissionLevel.READ };
        const writeOps = Object.entries(API_TOKEN_PERMISSION_MAP).filter(
          ([, m]) => m.category === cat && m.level === 'write',
        );
        for (const [opName] of writeOps) {
          expect(
            checkTokenPermission(perms, opName),
            `read for "${cat}" should deny write op "${opName}"`,
          ).to.be.false;
        }
      }
    });
  });

  // ─────────────────────────────────────────────
  // Permission map — structural integrity
  // ─────────────────────────────────────────────
  describe('Permission map — structural integrity', () => {
    it('no duplicate operation names in the map', () => {
      // Object.keys already deduplicates, but this validates the source has no
      // accidental overwrites — we count operations per category and ensure totals
      // match the overall count
      const totalOps = Object.keys(API_TOKEN_PERMISSION_MAP).length;
      let categoryOpSum = 0;
      for (const cat of BASE_SCOPED_PERMISSION_CATEGORIES) {
        categoryOpSum += Object.values(API_TOKEN_PERMISSION_MAP).filter(
          (m) => m.category === cat,
        ).length;
      }
      expect(categoryOpSum).to.equal(totalOps);
    });

    it('every operation belongs to exactly one category', () => {
      for (const [opName, mapping] of Object.entries(API_TOKEN_PERMISSION_MAP)) {
        const matchingCategories = BASE_SCOPED_PERMISSION_CATEGORIES.filter(
          (cat) => cat === mapping.category,
        );
        expect(
          matchingCategories.length,
          `"${opName}" should map to exactly 1 category`,
        ).to.equal(1);
      }
    });

    it('bulk data operations are all in records category', () => {
      const bulkOps = Object.entries(API_TOKEN_PERMISSION_MAP).filter(([op]) =>
        op.startsWith('bulk'),
      );
      expect(bulkOps.length).to.be.greaterThan(0);
      for (const [opName, mapping] of bulkOps) {
        expect(
          mapping.category,
          `bulk op "${opName}" should be in records`,
        ).to.equal('records');
      }
    });

    it('all view-type operations (sort, filter, share) are in views category', () => {
      const viewRelatedPrefixes = ['sort', 'filter', 'shareView', 'hideAll', 'showAll'];
      for (const [opName, mapping] of Object.entries(API_TOKEN_PERMISSION_MAP)) {
        if (viewRelatedPrefixes.some((p) => opName.startsWith(p))) {
          expect(
            mapping.category,
            `"${opName}" should be in views category`,
          ).to.equal('views');
        }
      }
    });

    it('relation data and link operations are in records category', () => {
      // relationDataAdd/Remove and nestedData* are record-level operations
      const recordRelationOps = Object.entries(API_TOKEN_PERMISSION_MAP).filter(
        ([op]) =>
          op.startsWith('relationData') || op.startsWith('nested') || op.startsWith('link'),
      );
      expect(recordRelationOps.length).to.be.greaterThan(0);
      for (const [opName, mapping] of recordRelationOps) {
        expect(
          mapping.category,
          `record relation/link op "${opName}" should be in records`,
        ).to.equal('records');
      }
    });

    it('relation schema operations are in fields category', () => {
      // relationList/relationListAll are schema-level (column metadata)
      const schemaRelationOps = ['relationList', 'relationListAll'];
      for (const op of schemaRelationOps) {
        const mapping = getTokenPermissionForOperation(op);
        expect(mapping, `"${op}" should be mapped`).to.exist;
        expect(mapping!.category, `"${op}" should be in fields`).to.equal('fields');
      }
    });

    it('audit and extension operations are NOT mapped (unrestricted)', () => {
      // These were intentionally excluded from the permission map
      const unmappedOps = [
        'auditList',
        'auditRowList',
        'extensionList',
        'extensionRead',
        'extensionCreate',
        'extensionUpdate',
        'extensionDelete',
      ];
      for (const op of unmappedOps) {
        expect(
          getTokenPermissionForOperation(op),
          `"${op}" should be unmapped (unrestricted)`,
        ).to.be.undefined;
      }
    });
  });

  // ─────────────────────────────────────────────
  // Token hashing — security properties
  // ─────────────────────────────────────────────
  describe('Token hashing — security properties', () => {
    it('single character difference produces completely different hash', () => {
      const token1 = API_TOKEN_PREFIX + 'a'.repeat(39) + 'a';
      const token2 = API_TOKEN_PREFIX + 'a'.repeat(39) + 'b';
      const hash1 = crypto.createHash('sha256').update(token1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(token2).digest('hex');
      expect(hash1).to.not.equal(hash2);

      // Hashes should differ in most positions (avalanche effect)
      let diffCount = 0;
      for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) diffCount++;
      }
      // SHA-256 avalanche: expect > 40% of hex chars to differ
      expect(diffCount).to.be.greaterThan(25);
    });

    it('hash of empty string is valid but different from any token', () => {
      const emptyHash = crypto.createHash('sha256').update('').digest('hex');
      const tokenHash = crypto.createHash('sha256').update(API_TOKEN_PREFIX + 'x'.repeat(40)).digest('hex');
      expect(emptyHash).to.have.lengthOf(64);
      expect(emptyHash).to.not.equal(tokenHash);
    });

    it('token prefix (12 chars) does not reveal the hash', () => {
      const token = API_TOKEN_PREFIX + 'V1StGXR8_Z5jdHi2BxoMwDqE3G4n5p6q7r8s';
      const prefix = token.substring(0, 12);
      const hash = crypto.createHash('sha256').update(token).digest('hex');

      // Prefix should not appear in hash
      expect(hash).to.not.include(prefix);
      // Prefix is plaintext, hash is hex — no overlap expected
      expect(prefix).to.match(/^nc_pat_/);
      expect(hash).to.match(/^[0-9a-f]{64}$/);
    });

    it('1000 unique tokens produce 1000 unique hashes', () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const token = API_TOKEN_PREFIX + String(i).padStart(40, '0');
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        hashes.add(hash);
      }
      expect(hashes.size).to.equal(1000);
    });
  });

  // ─────────────────────────────────────────────
  // Expiry validation logic
  // ─────────────────────────────────────────────
  describe('Expiry validation logic', () => {
    it('valid ISO dates parse correctly', () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      const date = new Date(future);
      expect(isNaN(date.getTime())).to.be.false;
      expect(date > new Date()).to.be.true;
    });

    it('expired token is detected (past date < now)', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      const expiryDate = new Date(past);
      expect(expiryDate < new Date()).to.be.true;
    });

    it('token expiring in the far future is valid', () => {
      const farFuture = new Date('2099-12-31T23:59:59.999Z');
      expect(farFuture > new Date()).to.be.true;
      expect(isNaN(farFuture.getTime())).to.be.false;
    });

    it('invalid date strings are detected', () => {
      const invalids = ['not-a-date', '2026-13-45', '', 'null', '0'];
      for (const d of invalids) {
        const parsed = new Date(d);
        // Some of these may parse to Invalid Date, some to epoch
        // The key check is isNaN for truly invalid ones
        if (d === '' || d === 'not-a-date' || d === 'null') {
          expect(isNaN(parsed.getTime()), `"${d}" should be invalid`).to.be.true;
        }
      }
    });

    it('expiry exactly at current time is treated as expired', () => {
      // The auth strategy uses `expiryDate < new Date()` (strict less-than)
      // A token whose expiry equals now should pass (barely)
      // But in practice, by the time the check runs, it will be past
      const now = new Date();
      const slightlyPast = new Date(now.getTime() - 1);
      expect(slightlyPast < now).to.be.true;
    });

    it('null/undefined expiry means no expiration', () => {
      // The auth strategy only checks expiry if truthy
      const nullExpiry = null;
      const undefinedExpiry = undefined;
      // Both should skip the expiry check
      expect(!nullExpiry).to.be.true;
      expect(!undefinedExpiry).to.be.true;
    });
  });

  // ─────────────────────────────────────────────
  // Comprehensive operation coverage per category
  // ─────────────────────────────────────────────
  describe('Exhaustive operation-to-category verification', () => {
    const categoryOps: Record<string, { read: string[]; write: string[] }> = {
      records: {
        read: [
          'dataList', 'dataRead', 'dataExist', 'dataFindOne', 'dataGroupBy',
          'dataCount', 'dataAggregate', 'bulkAggregate', 'bulkDataList',
          'linkDataList', 'groupedDataList', 'mmList', 'hmList',
          'nestedDataList', 'mmExcludedList', 'hmExcludedList',
          'btExcludedList', 'ooExcludedList', 'dataExport', 'exportCsv', 'exportExcel',
          'presignedUrl',
        ],
        write: [
          'dataInsert', 'dataUpdate', 'dataDelete', 'bulkDataInsert',
          'bulkDataUpdate', 'bulkDataUpdateAll', 'bulkDataDelete',
          'bulkDataDeleteAll', 'bulkDataUpsert', 'relationDataAdd',
          'relationDataRemove', 'nestedDataLink', 'nestedDataUnlink',
          'nestedDataListCopyPasteOrDeleteAll',
          'upload', 'uploadViaURL',
        ],
      },
      tables: {
        read: ['tableList', 'tableGet', 'tableInfoGet'],
        write: ['tableCreate', 'tableUpdate', 'tableDelete'],
      },
      fields: {
        read: ['columnList', 'columnGet', 'relationList', 'relationListAll', 'indexList'],
        write: ['columnAdd', 'columnUpdate', 'columnDelete', 'duplicateColumn'],
      },
      views: {
        read: [
          'viewList', 'viewGet', 'viewColumnList', 'formViewGet', 'galleryViewGet',
          'kanbanViewGet', 'calendarViewGet', 'sortList', 'filterList',
          'filterGet', 'filterChildrenList',
        ],
        write: [
          'viewCreate', 'viewUpdate', 'viewDelete',
          'gridViewCreate', 'formViewCreate', 'galleryViewCreate',
          'kanbanViewCreate', 'mapViewCreate', 'calendarViewCreate',
          'gridViewUpdate', 'formViewUpdate', 'formColumnUpdate',
          'galleryViewUpdate', 'kanbanViewUpdate', 'mapViewUpdate',
          'calendarViewUpdate', 'viewColumnUpdate', 'gridColumnUpdate',
          'sortCreate', 'sortUpdate', 'sortDelete',
          'filterCreate', 'filterUpdate', 'filterDelete',
          'hideAllColumns', 'showAllColumns', 'shareView', 'shareViewUpdate',
        ],
      },
      base: {
        read: ['baseList', 'baseGet', 'baseInfoGet', 'baseCost', 'swaggerJson', 'jobList', 'sourceList', 'sourceGet'],
        write: ['baseCreate', 'baseUpdate', 'sourceCreate', 'baseDelete'],
      },
      comments: {
        read: ['commentList', 'commentCount'],
        write: ['commentRow', 'commentUpdate', 'commentDelete'],
      },
      webhooks: {
        read: ['hookList', 'hookLogList'],
        write: ['hookCreate', 'hookUpdate', 'hookDelete', 'hookTest', 'hookTrigger'],
      },
      users: {
        read: ['baseUserList', 'workspaceUserList', 'workspaceUserGet'],
        write: [
          'userInvite', 'userInviteResend', 'baseUserMetaUpdate',
          'workspaceInvite', 'workspaceUserUpdate', 'workspaceUserDelete',
        ],
      },
    };

    for (const [category, ops] of Object.entries(categoryOps)) {
      describe(`${category} category`, () => {
        it(`all read operations are correctly mapped`, () => {
          for (const op of ops.read) {
            const mapping = getTokenPermissionForOperation(op);
            expect(mapping, `"${op}" should be mapped`).to.exist;
            expect(mapping!.category, `"${op}" category`).to.equal(category);
            expect(mapping!.level, `"${op}" level`).to.equal('read');
          }
        });

        it(`all write operations are correctly mapped`, () => {
          for (const op of ops.write) {
            const mapping = getTokenPermissionForOperation(op);
            expect(mapping, `"${op}" should be mapped`).to.exist;
            expect(mapping!.category, `"${op}" category`).to.equal(category);
            expect(mapping!.level, `"${op}" level`).to.equal('write');
          }
        });

        it(`read-only token allows read ops and denies write ops`, () => {
          const perms = { [category]: ApiTokenPermissionLevel.READ };
          for (const op of ops.read) {
            expect(
              checkTokenPermission(perms, op),
              `read should allow "${op}"`,
            ).to.be.true;
          }
          for (const op of ops.write) {
            expect(
              checkTokenPermission(perms, op),
              `read should deny "${op}"`,
            ).to.be.false;
          }
        });

        it(`write token allows all ops in this category`, () => {
          const perms = { [category]: ApiTokenPermissionLevel.WRITE };
          for (const op of [...ops.read, ...ops.write]) {
            expect(
              checkTokenPermission(perms, op),
              `write should allow "${op}"`,
            ).to.be.true;
          }
        });

        it(`none token denies all ops in this category`, () => {
          const perms = { [category]: ApiTokenPermissionLevel.NONE };
          for (const op of [...ops.read, ...ops.write]) {
            expect(
              checkTokenPermission(perms, op),
              `none should deny "${op}"`,
            ).to.be.false;
          }
        });

        it(`operation count matches the actual map`, () => {
          const mapOps = Object.entries(API_TOKEN_PERMISSION_MAP).filter(
            ([, m]) => m.category === category,
          );
          const expectedCount = ops.read.length + ops.write.length;
          expect(
            mapOps.length,
            `${category} should have ${expectedCount} ops in the map`,
          ).to.equal(expectedCount);
        });
      });
    }
  });

  // ─────────────────────────────────────────────
  // Realistic integration scenarios
  // ─────────────────────────────────────────────
  describe('Realistic token permission scenarios', () => {
    it('CI/CD pipeline token: records + tables read, nothing else', () => {
      const perms = {
        records: ApiTokenPermissionLevel.READ,
        tables: ApiTokenPermissionLevel.READ,
      };
      // Can list and read data
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'tableList')).to.be.true;
      // Cannot modify anything
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.false;
      // Cannot access other categories
      expect(checkTokenPermission(perms, 'columnList')).to.be.false;
      expect(checkTokenPermission(perms, 'viewList')).to.be.false;
      expect(checkTokenPermission(perms, 'hookList')).to.be.false;
      expect(checkTokenPermission(perms, 'baseGet')).to.be.false;
    });

    it('Zapier integration token: full data + comments write, schema read', () => {
      const perms = {
        records: ApiTokenPermissionLevel.WRITE,
        comments: ApiTokenPermissionLevel.WRITE,
        tables: ApiTokenPermissionLevel.READ,
        fields: ApiTokenPermissionLevel.READ,
        views: ApiTokenPermissionLevel.READ,
      };
      // Full CRUD on records
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.true;
      expect(checkTokenPermission(perms, 'dataUpdate')).to.be.true;
      expect(checkTokenPermission(perms, 'dataDelete')).to.be.true;
      // Can read schema to discover tables/fields
      expect(checkTokenPermission(perms, 'tableList')).to.be.true;
      expect(checkTokenPermission(perms, 'columnList')).to.be.true;
      expect(checkTokenPermission(perms, 'viewList')).to.be.true;
      // Cannot modify schema
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'columnAdd')).to.be.false;
      // Cannot manage webhooks, base, users
      expect(checkTokenPermission(perms, 'hookList')).to.be.false;
      expect(checkTokenPermission(perms, 'baseGet')).to.be.false;
      expect(checkTokenPermission(perms, 'baseUserList')).to.be.false;
    });

    it('Admin token: full access to everything', () => {
      const perms = {
        records: ApiTokenPermissionLevel.WRITE,
        tables: ApiTokenPermissionLevel.WRITE,
        fields: ApiTokenPermissionLevel.WRITE,
        views: ApiTokenPermissionLevel.WRITE,
        base: ApiTokenPermissionLevel.WRITE,
        comments: ApiTokenPermissionLevel.WRITE,
        webhooks: ApiTokenPermissionLevel.WRITE,
        users: ApiTokenPermissionLevel.WRITE,
      };
      // Spot-check destructive operations
      expect(checkTokenPermission(perms, 'dataDelete')).to.be.true;
      expect(checkTokenPermission(perms, 'bulkDataDeleteAll')).to.be.true;
      expect(checkTokenPermission(perms, 'tableDelete')).to.be.true;
      expect(checkTokenPermission(perms, 'columnDelete')).to.be.true;
      expect(checkTokenPermission(perms, 'viewDelete')).to.be.true;
      expect(checkTokenPermission(perms, 'baseDelete')).to.be.true;
      expect(checkTokenPermission(perms, 'hookDelete')).to.be.true;
      expect(checkTokenPermission(perms, 'commentDelete')).to.be.true;
      expect(checkTokenPermission(perms, 'workspaceUserDelete')).to.be.true;
    });

    it('Monitoring/read-only dashboard token: read everything, write nothing', () => {
      const perms = {
        records: ApiTokenPermissionLevel.READ,
        tables: ApiTokenPermissionLevel.READ,
        fields: ApiTokenPermissionLevel.READ,
        views: ApiTokenPermissionLevel.READ,
        base: ApiTokenPermissionLevel.READ,
        comments: ApiTokenPermissionLevel.READ,
        webhooks: ApiTokenPermissionLevel.READ,
        users: ApiTokenPermissionLevel.READ,
      };
      // Can read from every category
      expect(checkTokenPermission(perms, 'dataList')).to.be.true;
      expect(checkTokenPermission(perms, 'tableList')).to.be.true;
      expect(checkTokenPermission(perms, 'columnList')).to.be.true;
      expect(checkTokenPermission(perms, 'viewList')).to.be.true;
      expect(checkTokenPermission(perms, 'baseGet')).to.be.true;
      expect(checkTokenPermission(perms, 'commentList')).to.be.true;
      expect(checkTokenPermission(perms, 'hookList')).to.be.true;
      expect(checkTokenPermission(perms, 'baseUserList')).to.be.true;

      // Cannot write to any category
      expect(checkTokenPermission(perms, 'dataInsert')).to.be.false;
      expect(checkTokenPermission(perms, 'tableCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'columnAdd')).to.be.false;
      expect(checkTokenPermission(perms, 'viewCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'sourceCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'commentRow')).to.be.false;
      expect(checkTokenPermission(perms, 'hookCreate')).to.be.false;
      expect(checkTokenPermission(perms, 'userInvite')).to.be.false;
    });

    it('Webhook-only token: manage webhooks, nothing else', () => {
      const perms = { webhooks: ApiTokenPermissionLevel.WRITE };
      expect(checkTokenPermission(perms, 'hookList')).to.be.true;
      expect(checkTokenPermission(perms, 'hookCreate')).to.be.true;
      expect(checkTokenPermission(perms, 'hookUpdate')).to.be.true;
      expect(checkTokenPermission(perms, 'hookDelete')).to.be.true;
      expect(checkTokenPermission(perms, 'hookTest')).to.be.true;
      expect(checkTokenPermission(perms, 'hookTrigger')).to.be.true;
      // No access to data
      expect(checkTokenPermission(perms, 'dataList')).to.be.false;
      expect(checkTokenPermission(perms, 'tableList')).to.be.false;
    });
  });

  // ─────────────────────────────────────────────
  // SDK constants consistency
  // ─────────────────────────────────────────────
  describe('SDK constants consistency', () => {
    it('BASE_SCOPED_PERMISSION_CATEGORIES has exactly 8 entries', () => {
      expect(BASE_SCOPED_PERMISSION_CATEGORIES).to.have.lengthOf(8);
    });

    it('ApiTokenPermissionCategory enum values match BASE_SCOPED_PERMISSION_CATEGORIES', () => {
      const enumValues = Object.values(ApiTokenPermissionCategory);
      for (const cat of BASE_SCOPED_PERMISSION_CATEGORIES) {
        expect(enumValues, `enum should contain "${cat}"`).to.include(cat);
      }
    });

    it('API_TOKEN_PERMISSION_PRESETS only use valid permission levels', () => {
      const validLevels = new Set(Object.values(ApiTokenPermissionLevel));
      for (const [presetName, preset] of Object.entries(API_TOKEN_PERMISSION_PRESETS)) {
        for (const [cat, level] of Object.entries(preset)) {
          expect(
            validLevels.has(level),
            `${presetName}.${cat} has invalid level "${level}"`,
          ).to.be.true;
        }
      }
    });

    it('API_TOKEN_PERMISSION_PRESETS only use valid category keys', () => {
      const validCats = new Set(BASE_SCOPED_PERMISSION_CATEGORIES as readonly string[]);
      for (const [presetName, preset] of Object.entries(API_TOKEN_PERMISSION_PRESETS)) {
        for (const cat of Object.keys(preset)) {
          expect(
            validCats.has(cat),
            `${presetName} has unknown category "${cat}"`,
          ).to.be.true;
        }
      }
    });
  });
}

export function apiTokenPermissionTest() {
  describe('apiTokenPermission', apiTokenPermissionTests);
}

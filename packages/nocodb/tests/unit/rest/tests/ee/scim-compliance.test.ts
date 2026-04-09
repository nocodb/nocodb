/**
 * SCIM v2 RFC Compliance Tests
 *
 * Validates NocoDB's SCIM implementation against RFC 7643 (Schema) and
 * RFC 7644 (Protocol) using:
 *   - Ajv          – JSON Schema validation for every SCIM response
 *   - scim-patch   – PATCH operation validation (RFC 7644 §3.5.2)
 *   - scim2-parse-filter – filter query validation (RFC 7644 §3.4.2.2)
 */

import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { patchBodyValidation } from 'scim-patch';
import { parse as parseScimFilter } from 'scim2-parse-filter';
import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import init from '../../../init';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

async function createTestOrg(context: any): Promise<string> {
  const orgId = `ot${Date.now().toString(36)}`;
  await Noco.ncMeta.knexConnection(MetaTable.ORG).insert({ id: orgId, title: 'SCIM Compliance Org' });
  await Noco.ncMeta.knexConnection(MetaTable.ORG_USERS).insert({
    fk_org_id: orgId,
    fk_user_id: context.user.id,
    roles: EnterpriseOrgUserRoles.ADMIN,
  });
  return orgId;
}

// ═══════════════════════════════════════════════════════════════════════
//  SCIM JSON Schemas (RFC 7643)
// ═══════════════════════════════════════════════════════════════════════

const scimUserSchema = {
  $id: 'scim-user',
  type: 'object',
  required: ['schemas', 'id', 'userName'],
  properties: {
    schemas: {
      type: 'array',
      items: { type: 'string' },
      contains: {
        const: 'urn:ietf:params:scim:schemas:core:2.0:User',
      },
    },
    id: { type: 'string', minLength: 1 },
    externalId: { type: 'string' },
    userName: { type: 'string', minLength: 1 },
    name: {
      type: 'object',
      properties: {
        formatted: { type: 'string' },
        familyName: { type: 'string' },
        givenName: { type: 'string' },
        middleName: { type: 'string' },
        honorificPrefix: { type: 'string' },
        honorificSuffix: { type: 'string' },
      },
    },
    displayName: { type: 'string' },
    emails: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          type: { type: 'string' },
          primary: { type: 'boolean' },
        },
      },
    },
    active: { type: 'boolean' },
    meta: {
      type: 'object',
      properties: {
        resourceType: { type: 'string', const: 'User' },
        created: { type: 'string' },
        lastModified: { type: 'string' },
        location: { type: 'string' },
      },
    },
  },
  additionalProperties: true,
};

const scimGroupSchema = {
  $id: 'scim-group',
  type: 'object',
  required: ['schemas', 'id', 'displayName'],
  properties: {
    schemas: {
      type: 'array',
      items: { type: 'string' },
      contains: {
        const: 'urn:ietf:params:scim:schemas:core:2.0:Group',
      },
    },
    id: { type: 'string', minLength: 1 },
    externalId: { type: 'string' },
    displayName: { type: 'string', minLength: 1 },
    members: {
      type: 'array',
      items: {
        type: 'object',
        required: ['value'],
        properties: {
          value: { type: 'string' },
          $ref: { type: 'string' },
          type: { type: 'string' },
          display: { type: 'string' },
        },
      },
    },
    meta: {
      type: 'object',
      properties: {
        resourceType: { type: 'string', const: 'Group' },
        location: { type: 'string' },
      },
    },
  },
  additionalProperties: true,
};

const scimListResponseSchema = {
  $id: 'scim-list-response',
  type: 'object',
  required: ['schemas', 'totalResults'],
  properties: {
    schemas: {
      type: 'array',
      items: { type: 'string' },
      contains: {
        const: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
      },
    },
    totalResults: { type: 'integer', minimum: 0 },
    startIndex: { type: 'integer', minimum: 1 },
    itemsPerPage: { type: 'integer', minimum: 0 },
    Resources: {
      type: 'array',
      items: { type: 'object' },
    },
  },
  additionalProperties: true,
};

const scimServiceProviderConfigSchema = {
  $id: 'scim-spc',
  type: 'object',
  required: ['schemas', 'patch', 'bulk', 'filter', 'changePassword', 'sort', 'etag', 'authenticationSchemes'],
  properties: {
    schemas: {
      type: 'array',
      items: { type: 'string' },
      contains: {
        const: 'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig',
      },
    },
    patch: {
      type: 'object',
      required: ['supported'],
      properties: { supported: { type: 'boolean' } },
    },
    bulk: {
      type: 'object',
      required: ['supported'],
      properties: {
        supported: { type: 'boolean' },
        maxOperations: { type: 'integer' },
        maxPayloadSize: { type: 'integer' },
      },
    },
    filter: {
      type: 'object',
      required: ['supported'],
      properties: {
        supported: { type: 'boolean' },
        maxResults: { type: 'integer' },
      },
    },
    changePassword: {
      type: 'object',
      required: ['supported'],
      properties: { supported: { type: 'boolean' } },
    },
    sort: {
      type: 'object',
      required: ['supported'],
      properties: { supported: { type: 'boolean' } },
    },
    etag: {
      type: 'object',
      required: ['supported'],
      properties: { supported: { type: 'boolean' } },
    },
    authenticationSchemes: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['type', 'name', 'description'],
        properties: {
          type: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
  additionalProperties: true,
};

const scimErrorSchema = {
  $id: 'scim-error',
  type: 'object',
  properties: {
    schemas: {
      type: 'array',
      items: { type: 'string' },
      contains: {
        const: 'urn:ietf:params:scim:api:messages:2.0:Error',
      },
    },
    status: { type: 'string' },
    scimType: { type: 'string' },
    detail: { type: 'string' },
  },
  additionalProperties: true,
};

const scimPatchOpSchema = {
  $id: 'scim-patchop',
  type: 'object',
  required: ['schemas', 'Operations'],
  properties: {
    schemas: {
      type: 'array',
      items: { type: 'string' },
      contains: {
        const: 'urn:ietf:params:scim:api:messages:2.0:PatchOp',
      },
    },
    Operations: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['op'],
        properties: {
          op: {
            type: 'string',
            enum: ['add', 'remove', 'replace', 'Add', 'Remove', 'Replace'],
          },
          path: { type: 'string' },
          value: {},
        },
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════
//  Ajv instance with all schemas
// ═══════════════════════════════════════════════════════════════════════

function createValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(scimUserSchema);
  ajv.addSchema(scimGroupSchema);
  ajv.addSchema(scimListResponseSchema);
  ajv.addSchema(scimServiceProviderConfigSchema);
  ajv.addSchema(scimErrorSchema);
  ajv.addSchema(scimPatchOpSchema);
  return ajv;
}

// ═══════════════════════════════════════════════════════════════════════
//  Test Helpers
// ═══════════════════════════════════════════════════════════════════════

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function makeUser(overrides: Record<string, any> = {}) {
  const id = uid();
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    userName: `scim-${id}@test.example`,
    name: { givenName: 'Test', familyName: 'User' },
    emails: [{ primary: true, value: `scim-${id}@test.example`, type: 'work' }],
    displayName: `Test User ${id}`,
    active: true,
    externalId: `ext-${id}`,
    ...overrides,
  };
}

function makeGroup(overrides: Record<string, any> = {}) {
  const id = uid();
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    displayName: `Test Group ${id}`,
    externalId: `ext-group-${id}`,
    members: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  1. Schema Validation Tests
// ═══════════════════════════════════════════════════════════════════════

function schemaValidationTests() {
  let ctx: Awaited<ReturnType<typeof init>>;
  let orgId: string;
  let scimToken: string;
  let ajv: Ajv;

  const USERS = () => `/api/v3/meta/orgs/${orgId}/scim/v2/Users`;
  const GROUPS = () => `/api/v3/meta/orgs/${orgId}/scim/v2/Groups`;
  const SPC = () => `/api/v3/meta/orgs/${orgId}/scim/v2/ServiceProviderConfig`;
  const SCHEMAS_EP = () => `/api/v3/meta/orgs/${orgId}/scim/v2/Schemas`;
  const CONFIG = () => `/api/v3/meta/orgs/${orgId}/scim/config`;

  beforeEach(async function () {
    ctx = await init();
    orgId = await createTestOrg(ctx);
    ajv = createValidator();

    // Init + enable SCIM
    const initRes = await request(ctx.app)
      .post(CONFIG())
      .set('xc-auth', ctx.token)
      .send({ siteUrl: 'http://localhost:8080' })
      .expect(200);

    scimToken = initRes.body.provisioning_token;

    await request(ctx.app)
      .patch(CONFIG())
      .set('xc-auth', ctx.token)
      .send({ enabled: true })
      .expect(200);
  });

  // ── User Response Schema ────────────────────────────────────────

  it('POST /Users response matches RFC 7643 User schema', async () => {
    const res = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const valid = ajv.validate('scim-user', res.body);
    expect(valid, `User schema errors: ${JSON.stringify(ajv.errors)}`).to.be
      .true;
  });

  it('GET /Users/:id response matches RFC 7643 User schema', async () => {
    const createRes = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const res = await request(ctx.app)
      .get(`${USERS()}/${createRes.body.id}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    const valid = ajv.validate('scim-user', res.body);
    expect(valid, `User schema errors: ${JSON.stringify(ajv.errors)}`).to.be
      .true;
  });

  it('GET /Users ListResponse matches RFC 7643 ListResponse schema', async () => {
    await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const res = await request(ctx.app)
      .get(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    const valid = ajv.validate('scim-list-response', res.body);
    expect(
      valid,
      `ListResponse schema errors: ${JSON.stringify(ajv.errors)}`,
    ).to.be.true;

    // Each resource in the list must also match the User schema
    for (const resource of res.body.Resources || []) {
      const userValid = ajv.validate('scim-user', resource);
      expect(
        userValid,
        `User in list schema errors: ${JSON.stringify(ajv.errors)}`,
      ).to.be.true;
    }
  });

  // ── Group Response Schema ───────────────────────────────────────

  it('POST /Groups response matches RFC 7643 Group schema', async () => {
    const res = await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup())
      .expect(201);

    const valid = ajv.validate('scim-group', res.body);
    expect(valid, `Group schema errors: ${JSON.stringify(ajv.errors)}`).to.be
      .true;
  });

  it('GET /Groups ListResponse matches RFC 7643 ListResponse schema', async () => {
    await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup())
      .expect(201);

    const res = await request(ctx.app)
      .get(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    const valid = ajv.validate('scim-list-response', res.body);
    expect(
      valid,
      `ListResponse schema errors: ${JSON.stringify(ajv.errors)}`,
    ).to.be.true;

    for (const resource of res.body.Resources || []) {
      const groupValid = ajv.validate('scim-group', resource);
      expect(
        groupValid,
        `Group in list schema errors: ${JSON.stringify(ajv.errors)}`,
      ).to.be.true;
    }
  });

  // ── ServiceProviderConfig Schema ────────────────────────────────

  it('GET /ServiceProviderConfig matches RFC 7643 schema', async () => {
    const res = await request(ctx.app)
      .get(SPC())
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    const valid = ajv.validate('scim-spc', res.body);
    expect(valid, `SPC schema errors: ${JSON.stringify(ajv.errors)}`).to.be
      .true;
  });

  // ── Schemas Endpoint ────────────────────────────────────────────

  it('GET /Schemas returns array with User and Group schemas', async () => {
    const res = await request(ctx.app)
      .get(SCHEMAS_EP())
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    const body = res.body;
    const resources = Array.isArray(body) ? body : body.Resources || [];
    const ids = resources.map((s: any) => s.id);

    expect(ids).to.include('urn:ietf:params:scim:schemas:core:2.0:User');
    expect(ids).to.include('urn:ietf:params:scim:schemas:core:2.0:Group');
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  2. SCIM PATCH Validation Tests (scim-patch library)
// ═══════════════════════════════════════════════════════════════════════

function patchValidationTests() {
  let ctx: Awaited<ReturnType<typeof init>>;
  let orgId: string;
  let scimToken: string;

  const USERS = () => `/api/v3/meta/orgs/${orgId}/scim/v2/Users`;
  const GROUPS = () => `/api/v3/meta/orgs/${orgId}/scim/v2/Groups`;
  const CONFIG = () => `/api/v3/meta/orgs/${orgId}/scim/config`;

  beforeEach(async function () {
    ctx = await init();
    orgId = await createTestOrg(ctx);

    const initRes = await request(ctx.app)
      .post(CONFIG())
      .set('xc-auth', ctx.token)
      .send({ siteUrl: 'http://localhost:8080' })
      .expect(200);

    scimToken = initRes.body.provisioning_token;

    await request(ctx.app)
      .patch(CONFIG())
      .set('xc-auth', ctx.token)
      .send({ enabled: true })
      .expect(200);
  });

  // ── patchBodyValidation: valid bodies ──────────────────────────

  it('scim-patch validates deactivation PatchOp body', () => {
    const body = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'Replace', path: 'active', value: 'False' }],
    };
    // patchBodyValidation throws if invalid
    expect(() => patchBodyValidation(body)).to.not.throw();
  });

  it('scim-patch validates displayName Replace PatchOp body', () => {
    const body = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [
        { op: 'Replace', value: { displayName: 'New Name' } },
      ],
    };
    expect(() => patchBodyValidation(body)).to.not.throw();
  });

  it('scim-patch validates Add members PatchOp body', () => {
    const body = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [
        {
          op: 'Add',
          path: 'members',
          value: [{ value: 'some-user-id' }],
        },
      ],
    };
    expect(() => patchBodyValidation(body)).to.not.throw();
  });

  it('scim-patch rejects PatchOp with missing op field', () => {
    const body = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ path: 'active', value: 'False' }],
    };
    expect(() => patchBodyValidation(body)).to.throw();
  });

  it('scim-patch rejects PatchOp with invalid op name', () => {
    const body = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'InvalidOp', path: 'active', value: 'False' }],
    };
    expect(() => patchBodyValidation(body)).to.throw();
  });

  // ── PATCH User deactivation end-to-end ─────────────────────────

  it('User deactivation PATCH returns valid User schema with active=false', async () => {
    const ajv = createValidator();

    const createRes = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const userId = createRes.body.id;

    const patchBody = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'Replace', path: 'active', value: 'False' }],
    };

    // Validate the PATCH body with scim-patch
    expect(() => patchBodyValidation(patchBody)).to.not.throw();

    const res = await request(ctx.app)
      .patch(`${USERS()}/${userId}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .send(patchBody)
      .expect(200);

    // Response should still be a valid User resource
    const valid = ajv.validate('scim-user', res.body);
    expect(valid, `Patched User schema errors: ${JSON.stringify(ajv.errors)}`)
      .to.be.true;

    expect(res.body.active).to.equal(false);
  });

  // ── PATCH Group displayName end-to-end ─────────────────────────

  it('Group displayName PATCH returns valid Group schema', async () => {
    const ajv = createValidator();

    const createRes = await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup())
      .expect(201);

    const groupId = createRes.body.id;

    const patchBody = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [
        { op: 'Replace', value: { displayName: 'Renamed Group' } },
      ],
    };

    expect(() => patchBodyValidation(patchBody)).to.not.throw();

    const res = await request(ctx.app)
      .patch(`${GROUPS()}/${groupId}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .send(patchBody)
      .expect(200);

    const valid = ajv.validate('scim-group', res.body);
    expect(valid, `Patched Group schema errors: ${JSON.stringify(ajv.errors)}`)
      .to.be.true;

    expect(res.body.displayName).to.equal('Renamed Group');
  });

  // ── PATCH Add member end-to-end ────────────────────────────────

  it('Group Add member PATCH returns Group with member present', async () => {
    const ajv = createValidator();

    // Create user first
    const userRes = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const userId = userRes.body.id;

    // Create group
    const groupRes = await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup())
      .expect(201);

    const groupId = groupRes.body.id;

    const patchBody = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [
        { op: 'Add', path: 'members', value: [{ value: userId }] },
      ],
    };

    expect(() => patchBodyValidation(patchBody)).to.not.throw();

    const res = await request(ctx.app)
      .patch(`${GROUPS()}/${groupId}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .send(patchBody)
      .expect(200);

    const valid = ajv.validate('scim-group', res.body);
    expect(valid, `Group+member schema errors: ${JSON.stringify(ajv.errors)}`)
      .to.be.true;

    // Re-fetch to confirm persistence
    const getRes = await request(ctx.app)
      .get(`${GROUPS()}/${groupId}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    const memberIds = (getRes.body.members || []).map((m: any) => m.value);
    expect(memberIds).to.include(userId);
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  3. SCIM Filter Parsing Tests (scim2-parse-filter)
// ═══════════════════════════════════════════════════════════════════════

function filterParsingTests() {
  let ctx: Awaited<ReturnType<typeof init>>;
  let orgId: string;
  let scimToken: string;

  const USERS = () => `/api/v3/meta/orgs/${orgId}/scim/v2/Users`;
  const GROUPS = () => `/api/v3/meta/orgs/${orgId}/scim/v2/Groups`;
  const CONFIG = () => `/api/v3/meta/orgs/${orgId}/scim/config`;

  beforeEach(async function () {
    ctx = await init();
    orgId = await createTestOrg(ctx);

    const initRes = await request(ctx.app)
      .post(CONFIG())
      .set('xc-auth', ctx.token)
      .send({ siteUrl: 'http://localhost:8080' })
      .expect(200);

    scimToken = initRes.body.provisioning_token;

    await request(ctx.app)
      .patch(CONFIG())
      .set('xc-auth', ctx.token)
      .send({ enabled: true })
      .expect(200);
  });

  // ── Filter syntax validation (pure unit) ───────────────────────

  it('scim2-parse-filter parses userName eq "..." filter', () => {
    const ast = parseScimFilter('userName eq "test@example.com"');
    expect(ast).to.have.property('op', 'eq');
    expect(ast).to.have.property('attrPath', 'userName');
    expect(ast).to.have.property('compValue', 'test@example.com');
  });

  it('scim2-parse-filter parses displayName eq "..." filter', () => {
    const ast = parseScimFilter('displayName eq "Engineering"');
    expect(ast).to.have.property('op', 'eq');
    expect(ast).to.have.property('attrPath', 'displayName');
    expect(ast).to.have.property('compValue', 'Engineering');
  });

  it('scim2-parse-filter parses externalId eq "..." filter', () => {
    const ast = parseScimFilter('externalId eq "ext-123"');
    expect(ast).to.have.property('op', 'eq');
    expect(ast).to.have.property('attrPath', 'externalId');
    expect(ast).to.have.property('compValue', 'ext-123');
  });

  it('scim2-parse-filter parses compound "and" filter', () => {
    const ast = parseScimFilter(
      'userName eq "test@example.com" and active eq true',
    );
    expect(ast).to.have.property('op', 'and');
  });

  it('scim2-parse-filter rejects empty filter gracefully', () => {
    expect(() => parseScimFilter('')).to.throw();
  });

  // ── Filter end-to-end against /Users endpoint ──────────────────

  it('userName eq filter returns matching user only', async () => {
    const payload = makeUser();
    await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(payload)
      .expect(201);

    // Create a second user to make sure filter works
    await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const filter = encodeURIComponent(`userName eq "${payload.userName}"`);
    const res = await request(ctx.app)
      .get(`${USERS()}?filter=${filter}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    expect(res.body.totalResults).to.be.at.least(1);
    for (const resource of res.body.Resources) {
      expect(resource.userName).to.equal(payload.userName);
    }
  });

  it('displayName eq filter returns matching group only', async () => {
    const payload = makeGroup();
    await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(payload)
      .expect(201);

    // Second group
    await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup())
      .expect(201);

    const filter = encodeURIComponent(
      `displayName eq "${payload.displayName}"`,
    );
    const res = await request(ctx.app)
      .get(`${GROUPS()}?filter=${filter}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    expect(res.body.totalResults).to.be.at.least(1);
    for (const resource of res.body.Resources) {
      expect(resource.displayName).to.equal(payload.displayName);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  4. RFC 7644 Protocol Compliance Tests
// ═══════════════════════════════════════════════════════════════════════

function protocolComplianceTests() {
  let ctx: Awaited<ReturnType<typeof init>>;
  let orgId: string;
  let scimToken: string;

  const USERS = () => `/api/v3/meta/orgs/${orgId}/scim/v2/Users`;
  const GROUPS = () => `/api/v3/meta/orgs/${orgId}/scim/v2/Groups`;
  const CONFIG = () => `/api/v3/meta/orgs/${orgId}/scim/config`;

  beforeEach(async function () {
    ctx = await init();
    orgId = await createTestOrg(ctx);

    const initRes = await request(ctx.app)
      .post(CONFIG())
      .set('xc-auth', ctx.token)
      .send({ siteUrl: 'http://localhost:8080' })
      .expect(200);

    scimToken = initRes.body.provisioning_token;

    await request(ctx.app)
      .patch(CONFIG())
      .set('xc-auth', ctx.token)
      .send({ enabled: true })
      .expect(200);
  });

  // ── §3.1 HTTP Status Codes ─────────────────────────────────────

  it('POST /Users returns 201 Created (RFC 7644 §3.3)', async () => {
    await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);
  });

  it('POST /Groups returns 201 Created (RFC 7644 §3.3)', async () => {
    await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup())
      .expect(201);
  });

  it('GET /Users returns 200 OK (RFC 7644 §3.4.1)', async () => {
    await request(ctx.app)
      .get(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);
  });

  it('GET /Users/:id returns 200 OK for existing resource', async () => {
    const createRes = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    await request(ctx.app)
      .get(`${USERS()}/${createRes.body.id}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);
  });

  it('GET /Users/:id returns 404 for nonexistent resource', async () => {
    const res = await request(ctx.app)
      .get(`${USERS()}/nonexistent-scim-id`)
      .set('Authorization', `Bearer ${scimToken}`);

    expect(res.status).to.be.oneOf([404, 422]);
  });

  it('DELETE /Users/:id returns 200 or 204 (RFC 7644 §3.6)', async () => {
    const createRes = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const res = await request(ctx.app)
      .delete(`${USERS()}/${createRes.body.id}`)
      .set('Authorization', `Bearer ${scimToken}`);

    expect(res.status).to.be.oneOf([200, 204]);
  });

  // ── §3.7 Authentication ────────────────────────────────────────

  it('Request without Authorization returns 401 (RFC 7644 §3.7)', async () => {
    await request(ctx.app).get(USERS()).expect(401);
  });

  it('Request with invalid bearer token returns 401', async () => {
    await request(ctx.app)
      .get(USERS())
      .set('Authorization', 'Bearer bad-token-xxxx')
      .expect(401);
  });

  // ── §3.4.2 Pagination (startIndex / count) ─────────────────────

  it('ListResponse honours startIndex and count (RFC 7644 §3.4.2.4)', async () => {
    // Provision 3 users
    for (let i = 0; i < 3; i++) {
      await request(ctx.app)
        .post(USERS())
        .set('Authorization', `Bearer ${scimToken}`)
        .send(makeUser())
        .expect(201);
    }

    const res = await request(ctx.app)
      .get(`${USERS()}?startIndex=1&count=2`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    expect(res.body.startIndex).to.equal(1);
    expect(res.body.itemsPerPage).to.be.at.most(2);
    expect(res.body.totalResults).to.be.at.least(3);
  });

  // ── §3.4.2.3 Sorting ─────────────────────────────────────────

  it('GET /Users?sortBy=userName returns sorted results (RFC 7644 §3.4.2.3)', async () => {
    const ts = Date.now();
    await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser({ userName: `zzz-${ts}@test.example`, emails: [{ primary: true, value: `zzz-${ts}@test.example`, type: 'work' }] }))
      .expect(201);

    await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser({ userName: `aaa-${ts}@test.example`, emails: [{ primary: true, value: `aaa-${ts}@test.example`, type: 'work' }] }))
      .expect(201);

    const res = await request(ctx.app)
      .get(`${USERS()}?sortBy=userName`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    const names = res.body.Resources.map((u: any) => u.userName);
    for (let i = 1; i < names.length; i++) {
      expect(
        names[i - 1].toLowerCase() <= names[i].toLowerCase(),
        `Sort order violated: ${names[i - 1]} > ${names[i]}`,
      ).to.be.true;
    }
  });

  it('GET /Groups?sortBy=displayName returns sorted results (RFC 7644 §3.4.2.3)', async () => {
    const ts = Date.now();
    await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup({ displayName: `Zebra ${ts}` }))
      .expect(201);

    await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup({ displayName: `Alpha ${ts}` }))
      .expect(201);

    const res = await request(ctx.app)
      .get(`${GROUPS()}?sortBy=displayName`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    const names = res.body.Resources.map((g: any) => g.displayName);
    for (let i = 1; i < names.length; i++) {
      expect(
        names[i - 1].toLowerCase() <= names[i].toLowerCase(),
        `Sort order violated: ${names[i - 1]} > ${names[i]}`,
      ).to.be.true;
    }
  });

  // ── §3.1 meta.created / meta.lastModified ──────────────────────

  it('User response includes meta.created and meta.lastModified (RFC 7643 §3.1)', async () => {
    const createRes = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const res = await request(ctx.app)
      .get(`${USERS()}/${createRes.body.id}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    expect(res.body.meta).to.have.property('created');
    expect(res.body.meta).to.have.property('lastModified');
    // Should be valid ISO 8601 timestamps
    const created = new Date(res.body.meta.created);
    const lastModified = new Date(res.body.meta.lastModified);
    expect(created.getTime()).to.not.be.NaN;
    expect(lastModified.getTime()).to.not.be.NaN;
    expect(lastModified.getTime()).to.be.at.least(created.getTime());
  });

  it('Group response includes meta.created and meta.lastModified', async () => {
    const createRes = await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup())
      .expect(201);

    const res = await request(ctx.app)
      .get(`${GROUPS()}/${createRes.body.id}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    expect(res.body.meta).to.have.property('created');
    expect(res.body.meta).to.have.property('lastModified');
  });

  // ── §3.6 DELETE idempotency ─────────────────────────────────────

  it('DELETE /Users/:id — second delete returns 404 (Microsoft SCIM compliance)', async () => {
    const createRes = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const id = createRes.body.id;

    const res1 = await request(ctx.app)
      .delete(`${USERS()}/${id}`)
      .set('Authorization', `Bearer ${scimToken}`);
    expect(res1.status).to.be.oneOf([200, 204]);

    const res2 = await request(ctx.app)
      .delete(`${USERS()}/${id}`)
      .set('Authorization', `Bearer ${scimToken}`);
    expect(res2.status).to.equal(404);
  });

  // ── §3.5.1 PUT full replacement ─────────────────────────────────

  it('PUT /Groups/:id replaces the resource (RFC 7644 §3.5.1)', async () => {
    const userRes = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const userId = userRes.body.id;

    const groupRes = await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup())
      .expect(201);

    const groupId = groupRes.body.id;

    const replacePayload = {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      displayName: 'Fully Replaced Group',
      members: [{ value: userId }],
    };

    const res = await request(ctx.app)
      .put(`${GROUPS()}/${groupId}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .send(replacePayload)
      .expect(200);

    expect(res.body.id).to.equal(groupId);
    expect(res.body.displayName).to.equal('Fully Replaced Group');
    expect(res.body.members).to.be.an('array');
    const memberIds = res.body.members.map((m: any) => m.value);
    expect(memberIds).to.include(userId);
  });

  // ── §3.12 SCIM Error Response Format ────────────────────────────

  it('POST /Groups without displayName returns SCIM error format (RFC 7644 §3.12)', async () => {
    const res = await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      });

    expect(res.status).to.be.oneOf([400, 422]);
    expect(res.body).to.have.property('schemas');
    expect(res.body.schemas).to.include(
      'urn:ietf:params:scim:api:messages:2.0:Error',
    );
    expect(res.body).to.have.property('detail');
    expect(res.body).to.have.property('status');
  });

  // ── §3.3 Resource ID immutability ──────────────────────────────

  it('User id remains stable across GET calls (RFC 7643 §3.1)', async () => {
    const createRes = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const id = createRes.body.id;

    const getRes = await request(ctx.app)
      .get(`${USERS()}/${id}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    expect(getRes.body.id).to.equal(id);
  });

  it('Group id remains stable across GET calls', async () => {
    const createRes = await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeGroup())
      .expect(201);

    const id = createRes.body.id;

    const getRes = await request(ctx.app)
      .get(`${GROUPS()}/${id}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    expect(getRes.body.id).to.equal(id);
  });

  // ── §3.5.2 PATCH idempotency ──────────────────────────────────

  it('Applying same PATCH twice yields same result (idempotency)', async () => {
    const createRes = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const userId = createRes.body.id;
    const patchBody = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'Replace', path: 'active', value: 'False' }],
    };

    const res1 = await request(ctx.app)
      .patch(`${USERS()}/${userId}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .send(patchBody)
      .expect(200);

    const res2 = await request(ctx.app)
      .patch(`${USERS()}/${userId}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .send(patchBody)
      .expect(200);

    expect(res1.body.active).to.equal(res2.body.active);
  });

  // ── §3.4.2 totalResults accuracy ───────────────────────────────

  it('totalResults matches actual resource count', async () => {
    // Create exactly 2 users
    await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(makeUser())
      .expect(201);

    const res = await request(ctx.app)
      .get(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    expect(res.body.totalResults).to.equal(res.body.Resources.length);
  });

  // ── Duplicate prevention ───────────────────────────────────────

  it('Creating user with same userName is handled gracefully', async () => {
    const payload = makeUser();

    await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(payload)
      .expect(201);

    // Second create with same userName
    const res = await request(ctx.app)
      .post(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(payload);

    // Should either succeed (idempotent) or return 409/400
    expect(res.status).to.be.oneOf([200, 201, 400, 409]);
  });

  it('Creating group with same displayName returns 400', async () => {
    const payload = makeGroup();

    await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(payload)
      .expect(201);

    const res = await request(ctx.app)
      .post(GROUPS())
      .set('Authorization', `Bearer ${scimToken}`)
      .send(payload);

    expect(res.status).to.be.oneOf([400, 409]);
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  5. Content-Type & Headers Compliance
// ═══════════════════════════════════════════════════════════════════════

function headerComplianceTests() {
  let ctx: Awaited<ReturnType<typeof init>>;
  let orgId: string;
  let scimToken: string;

  const USERS = () => `/api/v3/meta/orgs/${orgId}/scim/v2/Users`;
  const CONFIG = () => `/api/v3/meta/orgs/${orgId}/scim/config`;

  beforeEach(async function () {
    ctx = await init();
    orgId = await createTestOrg(ctx);

    const initRes = await request(ctx.app)
      .post(CONFIG())
      .set('xc-auth', ctx.token)
      .send({ siteUrl: 'http://localhost:8080' })
      .expect(200);

    scimToken = initRes.body.provisioning_token;

    await request(ctx.app)
      .patch(CONFIG())
      .set('xc-auth', ctx.token)
      .send({ enabled: true })
      .expect(200);
  });

  it('Response Content-Type includes application/json or application/scim+json', async () => {
    const res = await request(ctx.app)
      .get(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    const ct = res.headers['content-type'] || '';
    const validCT =
      ct.includes('application/json') || ct.includes('application/scim+json');
    expect(validCT, `Content-Type was ${ct}`).to.be.true;
  });

  it('Response body is valid JSON on successful request', async () => {
    const res = await request(ctx.app)
      .get(USERS())
      .set('Authorization', `Bearer ${scimToken}`)
      .expect(200);

    expect(() => JSON.parse(JSON.stringify(res.body))).to.not.throw();
    expect(res.body).to.be.an('object');
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  Export
// ═══════════════════════════════════════════════════════════════════════

export default function () {
  if (process.env.EE) {
    describe('SCIM RFC Schema Validation (Ajv)', schemaValidationTests);
    describe('SCIM PATCH Validation (scim-patch)', patchValidationTests);
    describe('SCIM Filter Parsing (scim2-parse-filter)', filterParsingTests);
    describe('SCIM RFC 7644 Protocol Compliance', protocolComplianceTests);
    describe('SCIM Headers & Content-Type', headerComplianceTests);
  }
}

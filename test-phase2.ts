/**
 * Test script for Phase 2: Permission/RLS descendant expansion
 *
 * Test data (from Phase 1):
 * Engineering (tm8180s0czdizsu3) depth=0
 * ├── Frontend (tmxns0jr16j6civv) depth=1
 * │   └── Web Team (tm16ylpppe9j2hx2) depth=2
 * └── Backend (tm4sqqp1aihra49g) depth=1
 * Sales (tmpt2yznnnk1vhsy) depth=0
 *
 * Users:
 * - eng-member@test.com (usp08nio49925zqz) → member of Engineering
 * - fe-member@test.com (usmk7cdxpmqqibg5) → member of Frontend
 * - be-member@test.com (usosr18wp52olzdf) → member of Backend
 * - web-member@test.com (us52b7552qb1bjbw) → member of Web Team
 */

const BASE_URL = 'http://localhost:8080';
const WS_ID = 'wftolaw6';
const BASE_ID = 'p5u6si273u9u30x';
const TABLE_ID = 'mp82xmxiq93eec6';

const TEAMS = {
  engineering: 'tm8180s0czdizsu3',
  frontend: 'tmxns0jr16j6civv',
  backend: 'tm4sqqp1aihra49g',
  webTeam: 'tm16ylpppe9j2hx2',
  sales: 'tmpt2yznnnk1vhsy',
};

const USERS = {
  owner: { email: 'owner@agent.test', password: 'Password123.' },
  engMember: { email: 'eng-member@test.com', password: 'Password123.' },
  feMember: { email: 'fe-member@test.com', password: 'Password123.' },
  beMember: { email: 'be-member@test.com', password: 'Password123.' },
  webMember: { email: 'web-member@test.com', password: 'Password123.' },
};

async function signin(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/user/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

async function internalPost(token: string, operation: string, body: any) {
  const url = `${BASE_URL}/api/v2/internal/${WS_ID}/${BASE_ID}?operation=${operation}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xc-auth': token,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

async function internalGet(token: string, operation: string, query: Record<string, string> = {}) {
  const params = new URLSearchParams({ operation, ...query });
  const url = `${BASE_URL}/api/v2/internal/${WS_ID}/${BASE_ID}?${params}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'xc-auth': token },
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

async function createRecord(token: string, tableId: string, data: any) {
  const url = `${BASE_URL}/api/v1/db/data/noco/${BASE_ID}/${tableId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xc-auth': token,
    },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
  } else {
    console.log(`  ❌ FAIL: ${message}`);
  }
}

async function main() {
  console.log('=== Phase 2 Test: Permission/RLS Descendant Expansion ===\n');

  // 1. Sign in as owner
  console.log('1. Signing in...');
  const ownerToken = await signin(USERS.owner.email, USERS.owner.password);
  const feToken = await signin(USERS.feMember.email, USERS.feMember.password);
  const beToken = await signin(USERS.beMember.email, USERS.beMember.password);
  const webToken = await signin(USERS.webMember.email, USERS.webMember.password);
  const engToken = await signin(USERS.engMember.email, USERS.engMember.password);
  console.log('  All users signed in.\n');

  // 2. Set TABLE_RECORD_ADD permission to "Specific Users" with Engineering team
  console.log('2. Setting TABLE_RECORD_ADD permission with Engineering team (default: self_and_descendants)...');
  const setResult = await internalPost(ownerToken, 'setPermission', {
    entity: 'table',
    entity_id: TABLE_ID,
    permission: 'TABLE_RECORD_ADD',
    granted_type: 'user',
    subjects: [{ type: 'team', id: TEAMS.engineering }],
  });
  console.log(`  Status: ${setResult.status}`, JSON.stringify(setResult.data).slice(0, 200));
  assert(setResult.status === 200, 'Permission set successfully');
  console.log();

  // 3. Test record creation with each user
  // With self_and_descendants (default), ALL team members in the Engineering subtree should be able to create records
  console.log('3. Testing record creation with descendant expansion (default: self_and_descendants)...');

  const testRecord = { Title: 'Test Phase 2' };

  // eng-member (direct Engineering member) — should succeed
  const engCreate = await createRecord(engToken, TABLE_ID, testRecord);
  assert(engCreate.status === 200 || engCreate.status === 201, `eng-member can create records (status: ${engCreate.status})`);

  // fe-member (Frontend, child of Engineering) — should succeed (descendant expansion)
  const feCreate = await createRecord(feToken, TABLE_ID, testRecord);
  assert(feCreate.status === 200 || feCreate.status === 201, `fe-member (Frontend, descendant) can create records (status: ${feCreate.status})`);

  // be-member (Backend, child of Engineering) — should succeed (descendant expansion)
  const beCreate = await createRecord(beToken, TABLE_ID, testRecord);
  assert(beCreate.status === 200 || beCreate.status === 201, `be-member (Backend, descendant) can create records (status: ${beCreate.status})`);

  // web-member (Web Team, grandchild of Engineering) — should succeed (descendant expansion)
  const webCreate = await createRecord(webToken, TABLE_ID, testRecord);
  assert(webCreate.status === 200 || webCreate.status === 201, `web-member (Web Team, grandchild) can create records (status: ${webCreate.status})`);
  console.log();

  // 4. Now update permission to self_only
  console.log('4. Updating permission to self_only...');
  const setSelfOnly = await internalPost(ownerToken, 'setPermission', {
    entity: 'table',
    entity_id: TABLE_ID,
    permission: 'TABLE_RECORD_ADD',
    granted_type: 'user',
    subjects: [{ type: 'team', id: TEAMS.engineering, hierarchy_scope: 'self_only' }],
  });
  console.log(`  Status: ${setSelfOnly.status}`, JSON.stringify(setSelfOnly.data).slice(0, 200));
  assert(setSelfOnly.status === 200, 'Permission updated to self_only');
  console.log();

  // 5. Test again — only direct Engineering members should be able to create
  console.log('5. Testing record creation with self_only...');

  // eng-member (direct Engineering member) — should still succeed
  const engCreate2 = await createRecord(engToken, TABLE_ID, testRecord);
  assert(engCreate2.status === 200 || engCreate2.status === 201, `eng-member can still create records (status: ${engCreate2.status})`);

  // fe-member (Frontend) — should FAIL (self_only excludes descendants)
  const feCreate2 = await createRecord(feToken, TABLE_ID, testRecord);
  assert(feCreate2.status === 403 || feCreate2.status === 401, `fe-member is blocked with self_only (status: ${feCreate2.status})`);

  // web-member (Web Team) — should FAIL (self_only excludes descendants)
  const webCreate2 = await createRecord(webToken, TABLE_ID, testRecord);
  assert(webCreate2.status === 403 || webCreate2.status === 401, `web-member is blocked with self_only (status: ${webCreate2.status})`);
  console.log();

  // 6. Cleanup — drop the permission
  console.log('6. Cleaning up — dropping permission...');
  const dropResult = await internalPost(ownerToken, 'dropPermission', {
    entity: 'table',
    entity_id: TABLE_ID,
    permission: 'TABLE_RECORD_ADD',
  });
  console.log(`  Status: ${dropResult.status}`);
  console.log();

  console.log('=== Phase 2 Test Complete ===');
}

main().catch(console.error);

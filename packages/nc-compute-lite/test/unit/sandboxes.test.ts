import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

// config.ts refuses to load without a key.
process.env.NC_COMPUTE_LITE_KEY = 'k'.repeat(32);
const { BadRequest, clampTimeout, family, filePath, limit, sandboxes } = await import('../../src/sandboxes.ts');
const { docker } = await import('../../src/docker.ts');

const isBadRequest = (e: unknown) => e instanceof BadRequest;

describe('filePath', () => {
  it('accepts normal absolute file paths', () => {
    for (const p of ['/a', '/tmp/x.txt', '/home/user/.config/a b', '/a/.hidden', '/a/..b']) assert.equal(filePath(p), p);
  });

  it('refuses anything not already normal', () => {
    for (const p of ['/', '', 'a', 'tmp/x', './x', '/tmp/', '/tmp/.', '/tmp/..', '/tmp/../etc', '//x', '/a//b', '/a/./b']) {
      assert.throws(() => filePath(p), isBadRequest, p);
    }
  });

  it('refuses non-strings', () => {
    for (const p of [undefined, null, 1, ['/a'], { path: '/a' }]) assert.throws(() => filePath(p), isBadRequest);
  });
});

describe('clampTimeout', () => {
  it('defaults to five minutes', () => {
    assert.equal(clampTimeout(), 300_000);
    assert.equal(clampTimeout(null), 300_000);
  });

  it('clamps to 1s..24h', () => {
    assert.equal(clampTimeout(0), 1_000);
    assert.equal(clampTimeout(-5), 1_000);
    assert.equal(clampTimeout(60_000), 60_000);
    assert.equal(clampTimeout(48 * 3600_000), 24 * 3600_000);
  });

  it('refuses a non-number', () => {
    for (const v of ['60000', Number.NaN, Number.POSITIVE_INFINITY, {}]) assert.throws(() => clampTimeout(v), isBadRequest);
  });
});

describe('limit', () => {
  it('falls back when unset and passes values in range', () => {
    assert.equal(limit(undefined, 'cpuCount', 2, 0.25, 64), 2);
    assert.equal(limit(null, 'cpuCount', 2, 0.25, 64), 2);
    assert.equal(limit(0.25, 'cpuCount', 2, 0.25, 64), 0.25);
    assert.equal(limit(64, 'cpuCount', 2, 0.25, 64), 64);
  });

  it('refuses out-of-range and non-numbers, never 0 (unlimited to Docker)', () => {
    for (const v of [0, 0.1, 65, -1, '2', Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => limit(v, 'cpuCount', 2, 0.25, 64), (e: unknown) => isBadRequest(e) && /cpuCount must be a number from 0.25 to 64/.test(String(e)));
    }
  });
});

describe('family', () => {
  it('reads IPv4, IPv6 and IPv4-mapped addresses', () => {
    assert.deepEqual(family('10.0.0.1'), { address: '10.0.0.1', type: 'ipv4' });
    assert.deepEqual(family('::ffff:172.18.0.5'), { address: '172.18.0.5', type: 'ipv4' });
    assert.deepEqual(family('::FFFF:172.18.0.5'), { address: '172.18.0.5', type: 'ipv4' });
    assert.deepEqual(family('::fFfF:172.18.0.5'), { address: '172.18.0.5', type: 'ipv4' });
    assert.deepEqual(family('fd00::1'), { address: 'fd00::1', type: 'ipv6' });
    // Hex-form mapped address stays IPv6.
    assert.deepEqual(family('::ffff:ac12:5'), { address: '::ffff:ac12:5', type: 'ipv6' });
  });

  it('refuses malformed addresses', () => {
    for (const a of ['', 'localhost', '1.2.3', '300.1.1.1', '::ffff:', '::ffff:1.2.3', 'fd00::1/64']) assert.equal(family(a), undefined, a);
  });
});

describe('fromSandbox', () => {
  before(async () => {
    // The networks' subnets come from Docker at init; faked here, with no sandboxes to adopt.
    docker.ensureNetwork = async (name) => (name === 'nc-compute-lite' ? ['172.18.0.0/16', 'fd00:1::/64'] : ['172.19.0.0/16', 'bad']);
    docker.list = async () => [];
    await sandboxes.init();
  });

  it('matches sandbox subnets, IPv4-mapped in any case', () => {
    for (const a of ['172.18.0.5', '172.19.255.1', '::ffff:172.18.0.5', '::FFFF:172.19.0.9', 'fd00:1::abcd']) {
      assert.equal(sandboxes.fromSandbox(a), true, a);
    }
  });

  it('does not match other addresses or malformed ones', () => {
    for (const a of [undefined, '', '127.0.0.1', '172.20.0.1', '::ffff:10.0.0.1', '::1', 'fd00:2::1', 'garbage']) {
      assert.equal(sandboxes.fromSandbox(a), false, String(a));
    }
  });
});

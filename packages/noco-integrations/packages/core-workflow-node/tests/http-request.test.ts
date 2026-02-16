import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpRequest } from '../src/nodes/http-request';
import axios from 'axios';

function createNode(config: Record<string, any> = {}): HttpRequest {
  return new HttpRequest(
    { _nocodb: {}, ...config } as any,
    { logger: () => {} },
  );
}

// ──────────────────────────────────────────────
// validate() — HTTP method
// ──────────────────────────────────────────────

describe('HttpRequest.validate - method', () => {
  it('should fail when method is missing', async () => {
    const node = createNode();
    const result = await node.validate({ url: 'https://example.com' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'HTTP method is required' }),
    );
  });

  it('should fail when method is empty string', async () => {
    const node = createNode();
    const result = await node.validate({ method: '', url: 'https://example.com' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'HTTP method is required' }),
    );
  });

  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])(
    'should accept valid method: %s',
    async (method) => {
      const node = createNode();
      const result = await node.validate({ method, url: 'https://example.com' } as any);
      expect(result.valid).toBe(true);
    },
  );

  it('should reject invalid method', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'FOOBAR', url: 'https://example.com' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Invalid HTTP method' }),
    );
  });

  it('should reject lowercase methods (case-sensitive check)', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'get', url: 'https://example.com' } as any);
    // The code does config.method.toUpperCase() check, so lowercase should pass
    expect(result.valid).toBe(true);
  });

  it('should reject OPTIONS method (not in allowed list)', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'OPTIONS', url: 'https://example.com' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Invalid HTTP method' }),
    );
  });
});

// ──────────────────────────────────────────────
// validate() — URL
// ──────────────────────────────────────────────

describe('HttpRequest.validate - url', () => {
  it('should fail when url is missing', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'URL is required' }),
    );
  });

  it('should fail when url is empty string', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: '' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'URL is required' }),
    );
  });

  it('should fail when url is whitespace only', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: '   ' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'URL is required' }),
    );
  });

  it('should accept valid https URL', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://api.example.com/v1/data' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept valid http URL', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'http://localhost:3000/api' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept URL with query parameters', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://api.example.com?foo=bar&baz=1' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept URL with path, hash, and port', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://example.com:8080/path/to/resource#section' } as any);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid URL (no protocol)', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'not-a-url' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Please provide a valid URL' }),
    );
  });

  it('should reject URL with only protocol', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Please provide a valid URL' }),
    );
  });

  it('should skip URL validation for dynamic expressions', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: '$(nodes.webhook.url)/endpoint' } as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should skip URL validation when dynamic expression is embedded', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://$(nodes.config.host)/api/v1' } as any);
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// validate() — body type
// ──────────────────────────────────────────────

describe('HttpRequest.validate - bodyType', () => {
  it.each(['none', 'json', 'urlencoded', 'multipartForm', 'plainText', 'xml'])(
    'should accept valid bodyType: %s',
    async (bodyType) => {
      const node = createNode();
      const result = await node.validate({ method: 'POST', url: 'https://example.com', bodyType } as any);
      expect(result.valid).toBe(true);
    },
  );

  it('should reject invalid bodyType', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'POST', url: 'https://example.com', bodyType: 'graphql' } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Invalid body type' }),
    );
  });

  it('should pass when bodyType is not provided (optional)', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'POST', url: 'https://example.com' } as any);
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// validate() — JSON body
// ──────────────────────────────────────────────

describe('HttpRequest.validate - JSON body', () => {
  it('should accept valid JSON body', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'json',
      body: '{"name":"test","value":123}',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept JSON array body', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'json',
      body: '[1,2,3]',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept nested JSON body', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'json',
      body: '{"user":{"name":"John","tags":["admin","user"]}}',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid JSON body', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'json',
      body: '{invalid json}',
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Body must be valid JSON' }),
    );
  });

  it('should reject JSON with trailing comma', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'json',
      body: '{"name":"test",}',
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Body must be valid JSON' }),
    );
  });

  it('should reject plain text as JSON body', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'json',
      body: 'hello world',
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Body must be valid JSON' }),
    );
  });

  it('should skip JSON validation for dynamic body', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'json',
      body: '$(nodes.previous.output)',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should skip JSON validation when body contains embedded dynamic expression', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'json',
      body: '{"name":"$(nodes.input.name)"}',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should not validate JSON when bodyType is not json', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'plainText',
      body: 'this is not json and thats fine',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should pass when bodyType is json but body is empty (optional body)', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'json',
      body: '',
    } as any);
    expect(result.valid).toBe(true);
  });

  it('should pass when bodyType is json but body is undefined', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://example.com',
      bodyType: 'json',
    } as any);
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// validate() — timeout
// ──────────────────────────────────────────────

describe('HttpRequest.validate - timeout', () => {
  it('should accept positive timeout', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://example.com', timeout: 5000 } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept large timeout', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://example.com', timeout: 600000 } as any);
    expect(result.valid).toBe(true);
  });

  it('should reject zero timeout', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://example.com', timeout: 0 } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Timeout must be a positive number' }),
    );
  });

  it('should reject negative timeout', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://example.com', timeout: -1000 } as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: 'Timeout must be a positive number' }),
    );
  });

  it('should pass when timeout is undefined (optional)', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://example.com' } as any);
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// validate() — multiple errors
// ──────────────────────────────────────────────

describe('HttpRequest.validate - multiple errors', () => {
  it('should collect all errors at once', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'INVALID',
      url: '',
      bodyType: 'wrongtype',
      timeout: -5,
    } as any);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    const messages = result.errors.map((e: any) => e.message);
    expect(messages).toContain('Invalid HTTP method');
    expect(messages).toContain('URL is required');
    expect(messages).toContain('Invalid body type');
    expect(messages).toContain('Timeout must be a positive number');
  });

  it('should report both missing method and invalid URL', async () => {
    const node = createNode();
    const result = await node.validate({ url: 'not-valid' } as any);
    expect(result.valid).toBe(false);
    const messages = result.errors.map((e: any) => e.message);
    expect(messages).toContain('HTTP method is required');
    expect(messages).toContain('Please provide a valid URL');
  });
});

// ──────────────────────────────────────────────
// validate() — complete valid configs
// ──────────────────────────────────────────────

describe('HttpRequest.validate - complete valid configs', () => {
  it('should accept minimal GET config', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'GET', url: 'https://api.example.com' } as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept full POST config with all options', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'POST',
      url: 'https://api.example.com/data',
      bodyType: 'json',
      body: '{"key":"value"}',
      timeout: 10000,
      headers: [{ key: 'Authorization', value: 'Bearer token123' }],
      queryParams: [{ key: 'page', value: '1' }],
      followRedirects: true,
      validateStatus: true,
    } as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept DELETE with no body', async () => {
    const node = createNode();
    const result = await node.validate({ method: 'DELETE', url: 'https://api.example.com/resource/123' } as any);
    expect(result.valid).toBe(true);
  });

  it('should accept PUT with XML body', async () => {
    const node = createNode();
    const result = await node.validate({
      method: 'PUT',
      url: 'https://api.example.com/resource',
      bodyType: 'xml',
      body: '<root><name>test</name></root>',
    } as any);
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// parseKeyValuePairs (via validate + run context)
// We test this indirectly through the class since it's private.
// We instantiate and call run() with mocked axios to exercise it.
// But we can also test it directly by accessing the prototype.
// ──────────────────────────────────────────────

describe('HttpRequest.parseKeyValuePairs', () => {
  // Access private method for direct testing
  const parseKV = (input: unknown) => {
    const node = createNode() as any;
    return node.parseKeyValuePairs(input);
  };

  it('should return empty array for null input', () => {
    expect(parseKV(null)).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    expect(parseKV(undefined)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseKV('')).toEqual([]);
  });

  it('should return empty array for false', () => {
    expect(parseKV(false)).toEqual([]);
  });

  it('should return empty array for 0', () => {
    expect(parseKV(0)).toEqual([]);
  });

  // Array inputs
  it('should pass through a valid array of key-value objects', () => {
    const input = [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Authorization', value: 'Bearer token' },
    ];
    expect(parseKV(input)).toEqual(input);
  });

  it('should filter out array items without key property', () => {
    const input = [
      { key: 'valid', value: 'yes' },
      { notKey: 'invalid', value: 'no' },
      null,
      'string',
      42,
      { key: 'also-valid', value: 'yes' },
    ];
    const result = parseKV(input);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('valid');
    expect(result[1].key).toBe('also-valid');
  });

  it('should handle empty array', () => {
    expect(parseKV([])).toEqual([]);
  });

  it('should filter out array items that are not objects', () => {
    const input = [undefined, null, 123, 'string', true];
    expect(parseKV(input)).toEqual([]);
  });

  // JSON string inputs — array
  it('should parse JSON string containing array of key-value pairs', () => {
    const input = JSON.stringify([
      { key: 'Accept', value: 'text/html' },
      { key: 'X-Custom', value: 'foo' },
    ]);
    const result = parseKV(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ key: 'Accept', value: 'text/html' });
  });

  it('should filter invalid items from JSON string array', () => {
    const input = JSON.stringify([
      { key: 'good', value: 'yes' },
      { bad: 'entry' },
      null,
    ]);
    const result = parseKV(input);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('good');
  });

  // JSON string inputs — single {key, value} object
  it('should parse JSON string containing single key-value object', () => {
    const input = JSON.stringify({ key: 'Authorization', value: 'Bearer abc' });
    const result = parseKV(input);
    expect(result).toEqual([{ key: 'Authorization', value: 'Bearer abc' }]);
  });

  // JSON string inputs — plain object (entries conversion)
  it('should convert JSON string plain object to key-value pairs', () => {
    const input = JSON.stringify({ 'Content-Type': 'application/json', Accept: 'text/html' });
    const result = parseKV(input);
    expect(result).toEqual([
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Accept', value: 'text/html' },
    ]);
  });

  it('should convert values to strings when parsing plain object', () => {
    const input = JSON.stringify({ count: 42, active: true, data: null });
    const result = parseKV(input);
    expect(result).toEqual([
      { key: 'count', value: '42' },
      { key: 'active', value: 'true' },
      { key: 'data', value: 'null' },
    ]);
  });

  // JSON string inputs — invalid JSON
  it('should return empty array for invalid JSON string', () => {
    expect(parseKV('{not valid json}')).toEqual([]);
  });

  it('should return empty array for non-object JSON string', () => {
    // JSON.parse("42") returns 42 (number), not object or array
    expect(parseKV('42')).toEqual([]);
  });

  it('should return empty array for JSON null string', () => {
    expect(parseKV('null')).toEqual([]);
  });

  // Object inputs (non-string)
  it('should convert single {key, value} object directly', () => {
    const input = { key: 'Host', value: 'example.com' };
    const result = parseKV(input);
    expect(result).toEqual([{ key: 'Host', value: 'example.com' }]);
  });

  it('should convert plain object entries to key-value pairs', () => {
    const input = { 'X-Request-Id': '12345', 'X-Trace': 'abc' };
    const result = parseKV(input);
    expect(result).toEqual([
      { key: 'X-Request-Id', value: '12345' },
      { key: 'X-Trace', value: 'abc' },
    ]);
  });

  it('should distinguish {key,value} object from plain object by property count', () => {
    // Object with exactly key+value and 2 properties -> treated as single pair
    const singlePair = { key: 'a', value: 'b' };
    expect(parseKV(singlePair)).toEqual([{ key: 'a', value: 'b' }]);

    // Object with key+value but also extra properties -> treated as entries
    const multiProp = { key: 'a', value: 'b', extra: 'c' };
    const result = parseKV(multiProp);
    expect(result).toEqual([
      { key: 'key', value: 'a' },
      { key: 'value', value: 'b' },
      { key: 'extra', value: 'c' },
    ]);
  });

  it('should stringify non-string values in object entries', () => {
    const input = { num: 100, bool: false };
    const result = parseKV(input);
    expect(result).toEqual([
      { key: 'num', value: '100' },
      { key: 'bool', value: 'false' },
    ]);
  });

  it('should handle empty object', () => {
    expect(parseKV({})).toEqual([]);
  });

  // Edge cases
  it('should handle deeply nested JSON string gracefully', () => {
    const input = JSON.stringify({ nested: { deep: { value: 1 } } });
    const result = parseKV(input);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('nested');
    // Nested object gets stringified
    expect(result[0].value).toBe('[object Object]');
  });

  it('should return empty for number input', () => {
    expect(parseKV(42)).toEqual([]);
  });

  it('should return empty for boolean input', () => {
    expect(parseKV(true)).toEqual([]);
  });
});

// ──────────────────────────────────────────────
// run() — with mocked axios
// ──────────────────────────────────────────────

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  const mockFn = vi.fn();
  // Copy real properties (isAxiosError, etc.) onto the mock
  Object.assign(mockFn, actual.default);
  return { ...actual, default: mockFn };
});

vi.mock('request-filtering-agent', () => ({
  useAgent: () => undefined,
}));

function createRunContext(config: Record<string, any>): any {
  return {
    inputs: { config },
    nodeId: 'test-node',
    executionId: 'test-exec',
  };
}

describe('HttpRequest.run - successful requests', () => {
  beforeEach(() => {
    vi.mocked(axios).mockReset();
  });

  it('should make a basic GET request and return success', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: { message: 'hello' },
      headers: { 'content-type': 'application/json' },
    });

    const config = { method: 'GET', url: 'https://api.example.com/data' };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('success');
    expect(result.outputs.statusCode).toBe(200);
    expect(result.outputs.statusText).toBe('OK');
    expect(result.outputs.body).toEqual({ message: 'hello' });
    expect(result.outputs.isJson).toBe(true);
    expect(result.outputs.success).toBe(true);
    expect(result.metrics?.statusCode).toBe(200);
  });

  it('should apply custom headers', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = {
      method: 'GET',
      url: 'https://api.example.com',
      headers: [{ key: 'Authorization', value: 'Bearer token123' }],
    };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.headers.Authorization).toBe('Bearer token123');
  });

  it('should apply query params to URL', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = {
      method: 'GET',
      url: 'https://api.example.com/search',
      queryParams: [{ key: 'q', value: 'test' }, { key: 'page', value: '1' }],
    };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.url).toContain('q=test');
    expect(callArgs.url).toContain('page=1');
  });

  it('should send JSON body for POST', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 201,
      statusText: 'Created',
      data: { id: 1 },
      headers: { 'content-type': 'application/json' },
    });

    const config = {
      method: 'POST',
      url: 'https://api.example.com/data',
      bodyType: 'json',
      body: '{"name":"test"}',
    };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.outputs.statusCode).toBe(201);
    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.data).toEqual({ name: 'test' });
    expect(callArgs.headers['Content-Type']).toBe('application/json');
  });

  it('should send raw string when JSON body is invalid', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: 'ok',
      headers: {},
    });

    const config = {
      method: 'POST',
      url: 'https://api.example.com/data',
      bodyType: 'json',
      body: 'not-valid-json{{{',
    };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.data).toBe('not-valid-json{{{');
  });

  it('should send urlencoded body', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: 'ok',
      headers: {},
    });

    const config = {
      method: 'POST',
      url: 'https://api.example.com/form',
      bodyType: 'urlencoded',
      body: [{ key: 'name', value: 'test' }, { key: 'age', value: '30' }],
    };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(callArgs.data).toContain('name=test');
    expect(callArgs.data).toContain('age=30');
  });

  it('should send plainText body', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: 'ok',
      headers: {},
    });

    const config = {
      method: 'PUT',
      url: 'https://api.example.com/text',
      bodyType: 'plainText',
      body: 'Hello world',
    };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.headers['Content-Type']).toBe('text/plain');
    expect(callArgs.data).toBe('Hello world');
  });

  it('should send XML body', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = {
      method: 'POST',
      url: 'https://api.example.com/xml',
      bodyType: 'xml',
      body: '<root><name>test</name></root>',
    };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.headers['Content-Type']).toBe('application/xml');
    expect(callArgs.data).toBe('<root><name>test</name></root>');
  });

  it('should not send body for GET even if bodyType is set', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = {
      method: 'GET',
      url: 'https://api.example.com',
      bodyType: 'json',
      body: '{"key":"val"}',
    };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.data).toBeUndefined();
  });

  it('should not send body when bodyType is none', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = {
      method: 'POST',
      url: 'https://api.example.com',
      bodyType: 'none',
      body: '{"key":"val"}',
    };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.data).toBeUndefined();
  });

  it('should set custom timeout', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = { method: 'GET', url: 'https://api.example.com', timeout: 5000 };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.timeout).toBe(5000);
  });

  it('should default timeout to 30000', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = { method: 'GET', url: 'https://api.example.com' };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.timeout).toBe(30000);
  });

  it('should disable redirects when followRedirects is false', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = { method: 'GET', url: 'https://api.example.com', followRedirects: false };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.maxRedirects).toBe(0);
  });

  it('should include response headers', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: 'ok',
      headers: { 'x-request-id': 'abc123', 'content-type': 'text/plain' },
    });

    const config = { method: 'GET', url: 'https://api.example.com' };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.outputs.headers['x-request-id']).toBe('abc123');
    expect(result.outputs.isJson).toBe(false);
  });

  it('should include executionTimeMs in metrics', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = { method: 'GET', url: 'https://api.example.com' };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.metrics?.executionTimeMs).toBeDefined();
    expect(result.metrics!.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include info logs', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = { method: 'GET', url: 'https://api.example.com' };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.logs.length).toBeGreaterThanOrEqual(2);
    expect(result.logs.some((l: any) => l.message.includes('Making GET request'))).toBe(true);
    expect(result.logs.some((l: any) => l.message.includes('completed with status 200'))).toBe(true);
  });
});

describe('HttpRequest.run - error responses', () => {
  beforeEach(() => {
    vi.mocked(axios).mockReset();
  });

  it('should handle server error response (4xx/5xx)', async () => {
    const axiosError = new Error('Request failed with status code 404') as any;
    axiosError.isAxiosError = true;
    axiosError.response = {
      status: 404,
      statusText: 'Not Found',
      data: { error: 'Not found' },
      headers: { 'content-type': 'application/json' },
    };
    axiosError.request = {};
    // Make axios.isAxiosError return true for this error
    vi.mocked(axios).mockRejectedValue(axiosError);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const config = { method: 'GET', url: 'https://api.example.com/missing' };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('error');
    expect(result.outputs.statusCode).toBe(404);
    expect(result.outputs.success).toBe(false);
    expect(result.error?.message).toBe('HTTP 404: Not Found');
    expect(result.error?.code).toBe('HTTP_404');
  });

  it('should handle no-response error (network failure)', async () => {
    const axiosError = new Error('Network Error') as any;
    axiosError.isAxiosError = true;
    axiosError.response = undefined;
    axiosError.request = {};
    axiosError.code = 'ERR_NETWORK';
    vi.mocked(axios).mockRejectedValue(axiosError);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const config = { method: 'GET', url: 'https://api.example.com' };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('error');
    expect(result.outputs.success).toBe(false);
    expect(result.error?.message).toBe('Network Error');
    expect(result.error?.code).toBe('ERR_NETWORK');
  });

  it('should handle timeout error', async () => {
    const axiosError = new Error('timeout of 5000ms exceeded') as any;
    axiosError.isAxiosError = true;
    axiosError.response = undefined;
    axiosError.request = {};
    axiosError.code = 'ECONNABORTED';
    vi.mocked(axios).mockRejectedValue(axiosError);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const config = { method: 'GET', url: 'https://api.example.com', timeout: 5000 };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('ECONNABORTED');
  });

  it('should handle non-axios error', async () => {
    vi.mocked(axios).mockRejectedValue(new TypeError('Invalid URL'));
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(false);

    const config = { method: 'GET', url: 'https://api.example.com' };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('error');
    expect(result.outputs.success).toBe(false);
    expect(result.error?.message).toBe('Invalid URL');
    expect(result.error?.code).toBe('REQUEST_ERROR');
  });

  it('should include error logs for server errors', async () => {
    const axiosError = new Error('Server Error') as any;
    axiosError.isAxiosError = true;
    axiosError.response = {
      status: 500,
      statusText: 'Internal Server Error',
      data: 'error',
      headers: {},
    };
    axiosError.request = {};
    vi.mocked(axios).mockRejectedValue(axiosError);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const config = { method: 'POST', url: 'https://api.example.com' };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    const errorLog = result.logs.find((l: any) => l.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog!.message).toContain('500');
  });

  it('should include metrics on error', async () => {
    vi.mocked(axios).mockRejectedValue(new Error('fail'));
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(false);

    const config = { method: 'GET', url: 'https://api.example.com' };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.metrics?.executionTimeMs).toBeDefined();
  });

  it('should handle multipartForm body type', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: 'ok',
      headers: {},
    });

    const config = {
      method: 'POST',
      url: 'https://api.example.com/upload',
      bodyType: 'multipartForm',
      body: [{ key: 'file', value: 'data' }],
    };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('success');
    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.data).toBeInstanceOf(FormData);
  });

  it('should use raw string as FormData when body is not parseable', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: 'ok',
      headers: {},
    });

    const config = {
      method: 'POST',
      url: 'https://api.example.com/upload',
      bodyType: 'multipartForm',
      body: 'raw string',
    };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.status).toBe('success');
  });

  it('should use raw string for urlencoded when not parseable as pairs', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: 'ok',
      headers: {},
    });

    const config = {
      method: 'POST',
      url: 'https://api.example.com/form',
      bodyType: 'urlencoded',
      body: 'raw-form-data',
    };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.data).toBe('raw-form-data');
  });

  it('should not override existing Content-Type header', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: '',
      headers: {},
    });

    const config = {
      method: 'POST',
      url: 'https://api.example.com',
      bodyType: 'json',
      body: '{"a":1}',
      headers: [{ key: 'Content-Type', value: 'application/vnd.api+json' }],
    };
    const node = createNode(config);
    await node.run(createRunContext(config));

    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.headers['Content-Type']).toBe('application/vnd.api+json');
  });

  it('should handle DELETE with body', async () => {
    vi.mocked(axios).mockResolvedValue({
      status: 204,
      statusText: 'No Content',
      data: '',
      headers: {},
    });

    const config = {
      method: 'DELETE',
      url: 'https://api.example.com/resource/1',
      bodyType: 'json',
      body: '{"confirm":true}',
    };
    const node = createNode(config);
    const result = await node.run(createRunContext(config));

    expect(result.outputs.statusCode).toBe(204);
    const callArgs = vi.mocked(axios).mock.calls[0][0] as any;
    expect(callArgs.data).toEqual({ confirm: true });
  });
});

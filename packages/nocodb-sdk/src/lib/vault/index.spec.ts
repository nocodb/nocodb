/**
 * The reference parser is the single seam every consumer goes through — the
 * frontend picker, the backend resolver and the masking layer all decide "is
 * this field vault-backed?" by calling `parseSecretRef`. It is pure, so it is
 * covered here directly rather than only through the surfaces that use it.
 *
 * The case that matters most is the negative one: a reference is an OBJECT now,
 * and the `{{ secrets… }}` string form was removed. If a string ever parses
 * again, a password containing braces becomes a reference and the field stops
 * being a password.
 */
import {
  RESERVED_VAULT_ALIASES,
  SECRETS_NAMESPACE,
  applySecretRefCompletion,
  buildSecretRef,
  formatSecretRef,
  isJsIdentifier,
  isSecretRef,
  isValidVaultAlias,
  mentionsSecretsNamespace,
  parseSecretRef,
  parseSecretRefDraft,
  parseSecretRefText,
} from './index';

const ref = ($vault: unknown): { $vault: unknown } =>
  ({ $vault } as { $vault: unknown });

describe('parseSecretRef', () => {
  it('parses a well-formed reference', () => {
    expect(
      parseSecretRef({
        $vault: {
          alias: 'awsProd',
          secret: 'prod/db/creds',
          path: ['password'],
        },
      })
    ).toEqual({
      alias: 'awsProd',
      secret: 'prod/db/creds',
      path: ['password'],
    });
  });

  it('parses a deep key path', () => {
    expect(
      parseSecretRef({
        $vault: {
          alias: 'awsProd',
          secret: 'dbCreds',
          path: ['db', 'password'],
        },
      })
    ).toEqual({
      alias: 'awsProd',
      secret: 'dbCreds',
      path: ['db', 'password'],
    });
  });

  it('defaults a missing path to the empty path (the whole secret)', () => {
    expect(
      parseSecretRef({ $vault: { alias: 'awsProd', secret: 'apiKey' } })
    ).toEqual({ alias: 'awsProd', secret: 'apiKey', path: [] });
  });

  it('accepts an explicitly empty path', () => {
    expect(
      parseSecretRef({
        $vault: { alias: 'awsProd', secret: 'apiKey', path: [] },
      })
    ).toEqual({ alias: 'awsProd', secret: 'apiKey', path: [] });
  });

  it('does not alias the caller-supplied path array into the result', () => {
    const path = ['password'];
    const parsed = parseSecretRef({
      $vault: { alias: 'awsProd', secret: 'creds', path },
    });

    expect(parsed?.path).toEqual(['password']);
  });

  describe('malformed shapes are not references', () => {
    it.each([
      ['missing alias', ref({ secret: 'creds' })],
      ['empty alias', ref({ alias: '', secret: 'creds' })],
      ['non-string alias', ref({ alias: 42, secret: 'creds' })],
      ['alias with a slash', ref({ alias: 'aws/prod', secret: 'creds' })],
      ['alias with a dash', ref({ alias: 'aws-prod', secret: 'creds' })],
      ['alias starting with a digit', ref({ alias: '1aws', secret: 'creds' })],
      ['reserved alias', ref({ alias: 'secrets', secret: 'creds' })],
      [
        'reserved alias, different case',
        ref({ alias: 'Vault', secret: 'creds' }),
      ],
      ['missing secret', ref({ alias: 'awsProd' })],
      ['empty secret', ref({ alias: 'awsProd', secret: '' })],
      ['non-string secret', ref({ alias: 'awsProd', secret: 7 })],
      [
        'path is not an array',
        ref({ alias: 'awsProd', secret: 'creds', path: 'password' }),
      ],
      [
        'path is an object',
        ref({ alias: 'awsProd', secret: 'creds', path: { 0: 'password' } }),
      ],
      [
        'path holds an empty-string segment',
        ref({ alias: 'awsProd', secret: 'creds', path: ['password', ''] }),
      ],
      [
        'path holds a non-string segment',
        ref({ alias: 'awsProd', secret: 'creds', path: ['password', 3] }),
      ],
      [
        'path holds a null segment',
        ref({ alias: 'awsProd', secret: 'creds', path: [null] }),
      ],
      ['$vault is a string', ref('awsProd.creds')],
      ['$vault is an array', ref([{ alias: 'awsProd', secret: 'creds' }])],
      ['$vault is null', ref(null)],
      ['$vault is a number', ref(1)],
      ['$vault is absent', { alias: 'awsProd', secret: 'creds' }],
      ['the value is an array', [{ alias: 'awsProd', secret: 'creds' }]],
      [
        'the value is an array holding a reference',
        [{ $vault: { alias: 'awsProd', secret: 'creds' } }],
      ],
      ['the value is null', null],
      ['the value is undefined', undefined],
      ['the value is a number', 42],
      ['the value is a boolean', true],
      ['the value is an empty object', {}],
    ])('%s', (_label, value) => {
      expect(parseSecretRef(value)).toBeNull();
      expect(isSecretRef(value)).toBe(false);
    });
  });

  describe('every string is a plain value, never a reference', () => {
    // The brace form was the stored syntax once. It must not resolve any more,
    // or a value written against the old docs silently becomes vault-backed.
    it.each([
      '',
      'hunter2',
      '{{ secrets.awsProd.password }}',
      '{{ secrets.awsProd["prod/db/creds"].password }}',
      "{{ secrets['awsProd']['prod/db/creds']['password'] }}",
      '{{secrets.awsProd.password}}',
      '{{ secret.awsProd.password }}',
      '{{ secrets.awsProd.password',
      'secrets.awsProd.password',
      '{"$vault":{"alias":"awsProd","secret":"creds"}}',
      '$vault',
    ])('%j', (value) => {
      expect(parseSecretRef(value)).toBeNull();
      expect(isSecretRef(value)).toBe(false);
    });
  });
});

describe('isSecretRef', () => {
  it('is true only for a parseable reference', () => {
    expect(isSecretRef({ $vault: { alias: 'awsProd', secret: 'creds' } })).toBe(
      true
    );
    expect(isSecretRef({ $vault: { alias: 'secrets', secret: 'creds' } })).toBe(
      false
    );
  });
});

describe('buildSecretRef', () => {
  it('produces the stored shape', () => {
    expect(
      buildSecretRef({ alias: 'awsProd', secret: 'creds', path: ['password'] })
    ).toEqual({
      $vault: { alias: 'awsProd', secret: 'creds', path: ['password'] },
    });
  });

  it('defaults path to empty', () => {
    expect(buildSecretRef({ alias: 'awsProd', secret: 'creds' })).toEqual({
      $vault: { alias: 'awsProd', secret: 'creds', path: [] },
    });
  });

  it('round-trips through parseSecretRef', () => {
    const cases = [
      { alias: 'awsProd', secret: 'creds', path: ['password'] },
      { alias: 'awsProd', secret: 'prod/db/creds', path: [] },
      { alias: 'v1', secret: 'a b c', path: ['db', 'password'] },
    ];

    for (const parsed of cases) {
      expect(parseSecretRef(buildSecretRef(parsed))).toEqual(parsed);
    }
  });

  it('a built reference is never a string, so it never round-trips as one', () => {
    const built = buildSecretRef({ alias: 'awsProd', secret: 'creds' });

    expect(typeof built).toBe('object');
    expect(parseSecretRef(String(built))).toBeNull();
  });
});

describe('formatSecretRef', () => {
  it('uses dot form for bare identifiers', () => {
    expect(
      formatSecretRef({
        alias: 'awsProd',
        secret: 'dbCreds',
        path: ['password'],
      })
    ).toBe('secrets.awsProd.dbCreds.password');
  });

  it('brackets a segment that is not a bare identifier', () => {
    expect(
      formatSecretRef({
        alias: 'awsProd',
        secret: 'prod/db/creds',
        path: ['password'],
      })
    ).toBe('secrets.awsProd["prod/db/creds"].password');
  });

  it('brackets a non-identifier path segment', () => {
    expect(
      formatSecretRef({
        alias: 'awsProd',
        secret: 'creds',
        path: ['db-password'],
      })
    ).toBe('secrets.awsProd.creds["db-password"]');
  });

  it('renders every segment of a deep path', () => {
    expect(
      formatSecretRef({
        alias: 'awsProd',
        secret: 'creds',
        path: ['db', 'read only', 'password'],
      })
    ).toBe('secrets.awsProd.creds.db["read only"].password');
  });

  it('omits the path when there is none', () => {
    expect(formatSecretRef({ alias: 'awsProd', secret: 'apiKey' })).toBe(
      'secrets.awsProd.apiKey'
    );
  });

  it('starts at the secrets namespace', () => {
    expect(
      formatSecretRef({ alias: 'awsProd', secret: 'apiKey' }).startsWith(
        `${SECRETS_NAMESPACE}.`
      )
    ).toBe(true);
  });

  // Display only: the readable form is NOT the stored form, so feeding it back
  // in must not resolve.
  it('output is not parseable back into a reference', () => {
    const rendered = formatSecretRef({ alias: 'awsProd', secret: 'creds' });

    expect(parseSecretRef(rendered)).toBeNull();
  });

  it('escapes a quote inside a segment rather than breaking the rendering', () => {
    expect(formatSecretRef({ alias: 'awsProd', secret: 'a"b' })).toBe(
      'secrets.awsProd["a\\"b"]'
    );
  });
});

describe('isValidVaultAlias', () => {
  it('accepts a bare alphanumeric identifier starting with a letter', () => {
    for (const alias of ['a', 'awsProd', 'v2', 'AWSPROD']) {
      expect(isValidVaultAlias(alias)).toBe(true);
    }
  });

  it('rejects anything the reference grammar cannot spell in dot form', () => {
    for (const alias of [
      '',
      '1aws',
      'aws_prod',
      'aws-prod',
      'aws prod',
      'aws.prod',
      '_aws',
    ]) {
      expect(isValidVaultAlias(alias)).toBe(false);
    }
  });

  it('rejects every reserved alias, case-insensitively', () => {
    for (const reserved of RESERVED_VAULT_ALIASES) {
      expect(isValidVaultAlias(reserved)).toBe(false);
      expect(isValidVaultAlias(reserved.toUpperCase())).toBe(false);
    }
  });

  it('rejects a non-string', () => {
    expect(isValidVaultAlias(undefined as unknown as string)).toBe(false);
    expect(isValidVaultAlias(null as unknown as string)).toBe(false);
  });
});

describe('isJsIdentifier', () => {
  it('matches what formatSecretRef leaves unbracketed', () => {
    for (const segment of ['password', '_private', '$dollar', 'a1']) {
      expect(isJsIdentifier(segment)).toBe(true);
    }

    for (const segment of ['', '1a', 'a-b', 'a b', 'a/b', 'a.b']) {
      expect(isJsIdentifier(segment)).toBe(false);
    }
  });
});

describe('mentionsSecretsNamespace', () => {
  it('catches the removed brace syntax pasted into a plain field', () => {
    for (const value of [
      '{{ secrets.awsProd.password }}',
      '{{secrets["awsProd"].password}}',
      // singular — the typo that carries no `secrets`
      '{{ secret.awsProd.password }}',
      // never closed
      '{{ secrets.awsProd.password',
    ]) {
      expect(mentionsSecretsNamespace(value)).toBe(true);
    }
  });

  it('leaves an ordinary password alone', () => {
    for (const value of [
      'hunter2',
      'p{assword}',
      'secrets',
      'secrets.awsProd.password',
      'my{secret}value',
    ]) {
      expect(mentionsSecretsNamespace(value)).toBe(false);
    }
  });

  it('is false for every non-string', () => {
    for (const value of [
      undefined,
      null,
      42,
      { $vault: { alias: 'awsProd', secret: 'creds' } },
      ['{{ secrets.a.b }}'],
    ]) {
      expect(mentionsSecretsNamespace(value)).toBe(false);
    }
  });
});

describe('parseSecretRefText — the readable form back to a reference', () => {
  it('round-trips everything formatSecretRef produces', () => {
    const cases = [
      { alias: 'awsProd', secret: 'dbCreds', path: ['password'] },
      { alias: 'awsProd', secret: 'prod/db/creds', path: ['password'] },
      { alias: 'awsProd', secret: 'prod/db/creds', path: [] },
      { alias: 'awsProd', secret: 'a"b', path: ['x-y', 'z'] },
    ];
    for (const ref of cases) {
      expect(parseSecretRefText(formatSecretRef(ref))).toEqual(ref);
    }
  });

  it('accepts single quotes and surrounding whitespace', () => {
    expect(parseSecretRefText("  secrets.awsProd['prod/db'].password ")).toEqual({
      alias: 'awsProd',
      secret: 'prod/db',
      path: ['password'],
    });
  });

  it.each([
    ['', 'empty'],
    ['awsProd.secret.key', 'no namespace'],
    ['secrets', 'namespace only'],
    ['secrets.awsProd', 'alias without a secret'],
    ['secrets.secrets.x', 'reserved alias'],
    ['secrets.1bad.x', 'alias not an identifier'],
    ['secrets.awsProd[prod].x', 'unquoted bracket'],
    ['secrets.awsProd["prod"', 'bracket missing its ]'],
    ['secrets.awsProd["prod/d', 'bracket still open'],
    ['secrets.awsProd.x..y', 'empty path segment'],
    ['secrets.awsProd.x oops', 'trailing junk'],
  ])('rejects %j (%s)', (text) => {
    expect(parseSecretRefText(text)).toBeNull();
  });
});

describe('parseSecretRefDraft — which segment the caret is in', () => {
  it.each([
    ['secrets.', [], '', false],
    ['secrets.aw', [], 'aw', false],
    ['secrets.awsProd.', ['awsProd'], '', false],
    ['secrets.awsProd["prod/d', ['awsProd'], 'prod/d', true],
    ['secrets.awsProd["prod/db"]', ['awsProd', 'prod/db'], '', false],
    ['secrets.awsProd["prod/db"].pa', ['awsProd', 'prod/db'], 'pa', false],
  ])('%j → segments %j, fragment %j', (text, segments, fragment, bracketed) => {
    const draft = parseSecretRefDraft(text as string);
    expect(draft.rooted).toBe(true);
    expect(draft.segments).toEqual(segments);
    expect(draft.fragment).toBe(fragment);
    expect(draft.bracketed).toBe(bracketed);
  });

  it('is not rooted until the namespace is complete', () => {
    expect(parseSecretRefDraft('secr').rooted).toBe(false);
  });
});

describe('applySecretRefCompletion — splicing a chosen suggestion', () => {
  const complete = (text: string, value: string) =>
    applySecretRefCompletion(text, parseSecretRefDraft(text), value);

  it('dot-completes an identifier', () => {
    expect(complete('secrets.aw', 'awsProd')).toBe('secrets.awsProd');
  });

  it('switches to brackets for a name that needs them', () => {
    expect(complete('secrets.awsProd.pro', 'prod/db/creds')).toBe(
      'secrets.awsProd["prod/db/creds"]'
    );
  });

  it('closes an already-open bracket', () => {
    expect(complete('secrets.awsProd["pro', 'prod/db/creds')).toBe(
      'secrets.awsProd["prod/db/creds"]'
    );
  });

  it('completes the key after a bracketed secret', () => {
    expect(complete('secrets.awsProd["prod/db"].pa', 'password')).toBe(
      'secrets.awsProd["prod/db"].password'
    );
  });
});

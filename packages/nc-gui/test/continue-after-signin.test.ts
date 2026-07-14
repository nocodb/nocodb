/**
 * Unit tests for continueAfterSignIn open-redirect hardening.
 */
import { describe, expect, it } from 'vitest'
import { isSafeContinuePath } from '../utils/continueAfterSignIn'

describe('isSafeContinuePath', () => {
  it('allows same-origin relative paths used by shared-base access request', () => {
    expect(isSafeContinuePath('/request-base-access?base=cf9c1257-2235-48f2-bf8d-674bc0b3b940')).toBe(true)
    expect(isSafeContinuePath('/nc/pvhrglsa3yhi6i9')).toBe(true)
    expect(isSafeContinuePath('/')).toBe(true)
  })

  it('rejects absolute and protocol-relative URLs', () => {
    expect(isSafeContinuePath('https://evil.example')).toBe(false)
    expect(isSafeContinuePath('http://evil.example/path')).toBe(false)
    expect(isSafeContinuePath('//evil.example/path')).toBe(false)
  })

  it('rejects dangerous schemes and non-path values', () => {
    expect(isSafeContinuePath('javascript:alert(1)')).toBe(false)
    expect(isSafeContinuePath('data:text/html,hi')).toBe(false)
    expect(isSafeContinuePath('request-base-access')).toBe(false)
    expect(isSafeContinuePath('')).toBe(false)
    expect(isSafeContinuePath(null as any)).toBe(false)
  })
})

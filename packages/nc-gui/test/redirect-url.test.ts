/**
 * Unit tests for shared-form "redirect on submit" URL validation.
 *
 * Regression coverage for a security improvement against control-char
 * scheme-smuggling stored XSS: a tab inside the scheme (e.g. a tab between
 * "java" and "script:") slips past a naive scheme test, then the browser
 * strips the tab and executes it as `javascript:` in the nocodb origin.
 *
 * Imports the actual pure function - no mocks.
 */

import { describe, expect, it } from 'vitest'
import { isSafeRedirectUrl } from '~/utils/redirectUrl'

describe('isSafeRedirectUrl', () => {
  it('allows http(s) absolute URLs', () => {
    expect(isSafeRedirectUrl('https://example.com')).toBe(true)
    expect(isSafeRedirectUrl('http://example.com/path?q=1#h')).toBe(true)
    expect(isSafeRedirectUrl('HTTPS://EXAMPLE.COM')).toBe(true)
  })

  it('allows relative (scheme-less) URLs', () => {
    expect(isSafeRedirectUrl('/dashboard')).toBe(true)
    expect(isSafeRedirectUrl('thanks?id=1')).toBe(true)
  })

  it('trims surrounding whitespace before validating', () => {
    expect(isSafeRedirectUrl('  https://example.com  ')).toBe(true)
  })

  it('rejects empty / non-string input', () => {
    expect(isSafeRedirectUrl('')).toBe(false)
    expect(isSafeRedirectUrl('   ')).toBe(false)
    expect(isSafeRedirectUrl(undefined)).toBe(false)
    expect(isSafeRedirectUrl(null)).toBe(false)
    expect(isSafeRedirectUrl(123 as any)).toBe(false)
  })

  it('rejects javascript: and other dangerous schemes', () => {
    expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeRedirectUrl('JavaScript:alert(1)')).toBe(false)
    expect(isSafeRedirectUrl(' javascript:alert(1)')).toBe(false)
    expect(isSafeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeRedirectUrl('vbscript:msgbox(1)')).toBe(false)
    expect(isSafeRedirectUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeRedirectUrl('mailto:a@b.com')).toBe(false)
  })

  // The core vulnerability: control chars smuggle a dangerous scheme past a
  // naive scheme test, but the browser strips them and executes javascript:.
  // Payloads are built via fromCharCode so the source stays plain ASCII text.
  it('rejects control-char scheme smuggling (the scheme-smuggling bypass)', () => {
    const smuggle = (code: number) => `java${String.fromCharCode(code)}script:alert(1)`
    expect(isSafeRedirectUrl(smuggle(9))).toBe(false) // tab
    expect(isSafeRedirectUrl(smuggle(10))).toBe(false) // newline
    expect(isSafeRedirectUrl(smuggle(13))).toBe(false) // carriage return
    expect(isSafeRedirectUrl(smuggle(0))).toBe(false) // null
    expect(isSafeRedirectUrl(' javascript:alert(1)')).toBe(false) // leading space
  })
})

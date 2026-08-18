/**
 * Regression coverage for the canvas-grid formula-URL stored XSS
 * (incomplete fix of CVE-2026-28357).
 *
 * `replaceUrlsWithLink` serialises a URL() formula's `URI::(...) LABEL::(...)`
 * output into HTML that downstream consumers assign to `innerHTML` (the canvas
 * grid measuring node + paste helper). The invalid-URL branch and the
 * empty-URL/label branch used to return the user-controlled string RAW, so a
 * stored `<img src=x onerror=...>` payload executed on view. Both branches must
 * now HTML-encode the label in HTML mode, while plainCellValue mode (used for
 * plain-text consumers) stays raw.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'

// urlUtils transitively imports the canvas util module, which constructs an
// OffscreenCanvas at load time (not available under happy-dom). Stub it with a
// null-returning getContext — getSafe2DContext handles a null context safely.
let replaceUrlsWithLink: (text: string, plainCellValue?: boolean) => boolean | string

beforeAll(async () => {
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return null
      }
    },
  )
  // Nuxt auto-imports pulled in transitively via the i18n plugin.
  vi.stubGlobal('defineNuxtPlugin', (fn: any) => fn)
  vi.stubGlobal('isEeUI', false)
  ;({ replaceUrlsWithLink } = await import('~/utils/urlUtils'))
})

describe('replaceUrlsWithLink — formula URL stored XSS', () => {
  it('HTML-encodes an invalid-URL payload (no live markup)', () => {
    // parentheses are backslash-escaped in the serialised formula value
    const out = replaceUrlsWithLink('URI::( <img src=x onerror=alert\\(1\\)> )') as string
    expect(out).to.be.a('string')
    expect(out).not.to.contain('<img')
    expect(out).to.contain('&lt;img')
  })

  it('HTML-encodes the LABEL payload when the URL is empty', () => {
    const out = replaceUrlsWithLink('URI::() LABEL::(<img src=x onerror=alert\\(1\\)>)') as string
    expect(out).to.be.a('string')
    expect(out).not.to.contain('<img')
    expect(out).to.contain('&lt;img')
  })

  it('still renders a real URL as a safe anchor', () => {
    const out = replaceUrlsWithLink('URI::(https://example.com)') as string
    expect(out).to.contain('<a')
    expect(out).to.contain('href="https://example.com"')
    expect(out).to.contain('nc-cell-field-link')
  })

  it('does not double-escape angle brackets in a real label', () => {
    const out = replaceUrlsWithLink('URI::(https://example.com) LABEL::(a & b)') as string
    // encoded once at most — never the double-escaped form
    expect(out).not.to.contain('&amp;amp;')
  })

  it('plainCellValue mode returns the raw label (text, not HTML)', () => {
    const out = replaceUrlsWithLink('URI::( <img src=x> )', true) as string
    // plain-text consumers must not receive HTML entities
    expect(out).to.contain('<img src=x>')
  })
})

/**
 * `isTrustedLinkUrl` decides which external links skip the /leaving interstitial
 * on shared pages. Only our own domains qualify; the match is on hostname, so
 * look-alike hosts and non-https schemes must be rejected.
 */

import { describe, expect, it } from 'vitest'
import { isTrustedLinkUrl } from '~/utils/urlUtils'

describe('isTrustedLinkUrl', () => {
  it('trusts nocodb.com and its subdomains over https', () => {
    expect(isTrustedLinkUrl('https://nocodb.com')).toBe(true)
    expect(isTrustedLinkUrl('https://nocodb.com/docs/product')).toBe(true)
    expect(isTrustedLinkUrl('https://docs.nocodb.com/path?q=1#h')).toBe(true)
    expect(isTrustedLinkUrl('https://app.nocodb.com/#/ws/base')).toBe(true)
    expect(isTrustedLinkUrl('HTTPS://DOCS.NOCODB.COM')).toBe(true)
  })

  it('rejects look-alike hosts', () => {
    expect(isTrustedLinkUrl('https://nocodb.com.evil.com')).toBe(false)
    expect(isTrustedLinkUrl('https://evilnocodb.com')).toBe(false)
    expect(isTrustedLinkUrl('https://nocodb.co')).toBe(false)
    expect(isTrustedLinkUrl('https://evil.com/nocodb.com')).toBe(false)
    expect(isTrustedLinkUrl('https://evil.com/?next=https://nocodb.com')).toBe(false)
    expect(isTrustedLinkUrl('https://nocodb.com@evil.com')).toBe(false)
  })

  it('rejects non-https schemes and unparseable input', () => {
    expect(isTrustedLinkUrl('http://nocodb.com')).toBe(false)
    expect(isTrustedLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isTrustedLinkUrl('mailto:hi@nocodb.com')).toBe(false)
    expect(isTrustedLinkUrl('nocodb.com')).toBe(false)
    expect(isTrustedLinkUrl('')).toBe(false)
  })
})

/**
 * Unit tests for legacy hash-fragment route resolution.
 *
 * Shared by `plugins/hashRedirect.client.ts` (old bookmarks) and
 * `middleware/02.security.global.ts` (framed legacy embeds). Both depend on the
 * open-redirect guard here, which is why the logic lives in one place.
 */

import { describe, expect, it } from 'vitest'
import { extractLegacyHashRoute } from '~/utils/hashRoute'

describe('extractLegacyHashRoute', () => {
  it('resolves the legacy share-view embed forms', () => {
    // the two formats extensions/url-preview-ee/utils.ts still lists
    expect(extractLegacyHashRoute('#/nc/view/abc-uuid')).toBe('/nc/view/abc-uuid')
    expect(extractLegacyHashRoute('#/nc/form/abc-uuid/survey')).toBe('/nc/form/abc-uuid/survey')
    expect(extractLegacyHashRoute('#/nc/base/abc-uuid')).toBe('/nc/base/abc-uuid')
  })

  it('preserves the query string', () => {
    expect(extractLegacyHashRoute('#/nc/view/abc?embed=true')).toBe('/nc/view/abc?embed=true')
  })

  it('resolves non-share legacy routes too (the guard decides, not this)', () => {
    expect(extractLegacyHashRoute('#/signin')).toBe('/signin')
    expect(extractLegacyHashRoute('#/account/profile')).toBe('/account/profile')
  })

  it('returns null when the hash is not route-like', () => {
    for (const h of ['', '#', '#section', '#!/nc/view/x', 'nc/view/x']) {
      expect(extractLegacyHashRoute(h), h).toBe(null)
    }
  })

  // Without this the hash would be assigned straight to location, turning the
  // redirect into an open redirect to an attacker origin.
  it('rejects protocol-relative open-redirect payloads', () => {
    for (const h of ['#//attacker.com', '#/\\attacker.com', '#//attacker.com/nc/view/x']) {
      expect(extractLegacyHashRoute(h), h).toBe(null)
    }
  })

  it('always returns a rooted path', () => {
    const out = extractLegacyHashRoute('#/nc/view/x')
    expect(out?.startsWith('/')).toBe(true)
  })
})

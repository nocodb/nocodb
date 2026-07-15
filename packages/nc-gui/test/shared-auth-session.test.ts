import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveStoredSessionUser } from '../utils/sharedAuthSession'

describe('resolveStoredSessionUser', () => {
  it('returns the stored account for a non-expired session', () => {
    const account = {
      id: 'usr1',
      email: 'owner@example.com',
      display_name: 'Owner',
      exp: 2_000,
    }

    expect(resolveStoredSessionUser(account, 1_000_000)).toEqual(account)
  })

  it('does not expose an expired stored session', () => {
    expect(
      resolveStoredSessionUser(
        {
          id: 'usr1',
          email: 'owner@example.com',
          exp: 999,
        },
        1_000_000,
      ),
    ).toBeNull()
  })

  it('does not treat a payload without an account as a session', () => {
    expect(resolveStoredSessionUser({ exp: 2_000 }, 1_000_000)).toBeNull()
    expect(resolveStoredSessionUser(null, 1_000_000)).toBeNull()
  })
})

describe('shared-view authentication controls', () => {
  const sharedLayout = readFileSync(new URL('../layouts/shared-view.vue', import.meta.url), 'utf8')
  const sharedBaseToolbar = readFileSync(new URL('../components/general/ShareProject.vue', import.meta.url), 'utf8')
  const globalState = readFileSync(new URL('../composables/useGlobal/state.ts', import.meta.url), 'utf8')
  const interceptors = readFileSync(new URL('../composables/useApi/interceptors.ts', import.meta.url), 'utf8')

  it('shows the stored session account without enabling the route token', () => {
    expect(sharedLayout).toContain('storedSessionUser')
    expect(sharedLayout).toContain('GeneralUserIcon')
    expect(sharedBaseToolbar).toContain('storedSessionUser')
    expect(sharedBaseToolbar).toContain('GeneralUserIcon')
  })

  it('offers only this instance sign-in to guests', () => {
    expect(sharedLayout).toContain("path: '/signin'")
    expect(sharedLayout).not.toContain('signUpForFree')
    expect(sharedLayout).not.toContain('https://app.nocodb.com')
    expect(sharedLayout).not.toContain("path: '/signup'")
    expect(sharedBaseToolbar).toContain("path: '/signin'")
    expect(sharedBaseToolbar).not.toContain("path: '/signup'")
  })

  it('keeps shared-base API requests isolated from the stored JWT', () => {
    expect(globalState).toContain("isSharedBaseOrErdOrView.value ? ''")
    expect(interceptors).toContain("route.value.params.typeOrId === 'base'")
    expect(interceptors).toContain("delete config.headers['xc-auth']")
  })
})

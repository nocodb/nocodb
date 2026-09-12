import { describe, expect, it } from 'vitest'
import { PermissionGrantedType, PermissionRole, SubjectType, evaluatePermission } from 'nocodb-sdk'
import { evaluateTableFieldPermission } from '~/utils/tableFieldPermission'

/**
 * Pins the frontend table/field permission decision — regression coverage for
 * the bug where a SPECIFIC_USERS record-add grant blocked in-app forms for
 * everyone, and the shared/in-app × granted/non-granted matrix in general.
 */
describe('evaluateTableFieldPermission', () => {
  const userGrant = {
    granted_type: PermissionGrantedType.USER,
    subjects: [{ type: 'user', id: 'granted-user' }],
  }

  it('allows when no permission is configured', () => {
    expect(evaluateTableFieldPermission(null, { userId: 'u1' })).toBe(true)
  })

  describe('SPECIFIC_USERS grant', () => {
    it('in-app form: granted user is allowed', () => {
      expect(evaluateTableFieldPermission(userGrant, { userId: 'granted-user', isAnonymousFormSubmit: false })).toBe(true)
    })

    it('in-app form: non-granted user is blocked', () => {
      expect(evaluateTableFieldPermission(userGrant, { userId: 'someone-else', isAnonymousFormSubmit: false })).toBe(false)
    })

    it('public shared form: blocked even for the granted user (anonymous submitter)', () => {
      expect(evaluateTableFieldPermission(userGrant, { userId: 'granted-user', isAnonymousFormSubmit: true })).toBe(false)
    })

    it('matches a granted user via team membership (path-based)', () => {
      const teamGrant = {
        granted_type: PermissionGrantedType.USER,
        subjects: [{ type: 'team', id: 'eng' }],
      }
      const directTeams = [{ team_id: 'frontend', path: 'org/eng/frontend' }]
      expect(evaluateTableFieldPermission(teamGrant, { userId: 'u1', directTeams })).toBe(true)
      expect(evaluateTableFieldPermission(teamGrant, { userId: 'u1', directTeams: [] })).toBe(false)
    })
  })

  describe('ROLE grant', () => {
    const editorGrant = {
      granted_type: PermissionGrantedType.ROLE,
      granted_role: PermissionRole.EDITOR,
    }

    it('allows a role at or above the granted role', () => {
      expect(evaluateTableFieldPermission(editorGrant, { permissionRole: PermissionRole.CREATOR })).toBe(true)
    })

    it('blocks a role below the granted role', () => {
      expect(evaluateTableFieldPermission(editorGrant, { permissionRole: PermissionRole.VIEWER })).toBe(false)
    })
  })
})

/**
 * Agents are permission subjects in their own right, matched by id exactly as
 * users are. The property that matters is ISOLATION between subject kinds: a
 * principal must never satisfy a grant aimed at a different kind of principal,
 * even when the ids are identical. These pin the shared SDK decision that both
 * tiers route through.
 */
describe('evaluatePermission — agent subjects', () => {
  const agentGrant = {
    granted_type: PermissionGrantedType.USER,
    subjects: [{ type: 'agent', id: 'agt1' }],
  }

  const userGrant = {
    granted_type: PermissionGrantedType.USER,
    subjects: [{ type: 'user', id: 'agt1' }],
  }

  it('allows an agent named as an agent subject', () => {
    expect(evaluatePermission(agentGrant, { userId: 'agt1', subjectType: SubjectType.AGENT })).toBe(true)
  })

  it('blocks an agent that is not named', () => {
    expect(evaluatePermission(agentGrant, { userId: 'agt-other', subjectType: SubjectType.AGENT })).toBe(false)
  })

  it('does not let an agent satisfy a same-id USER grant', () => {
    expect(evaluatePermission(userGrant, { userId: 'agt1', subjectType: SubjectType.AGENT })).toBe(false)
  })

  it('does not let a user satisfy a same-id AGENT grant', () => {
    expect(evaluatePermission(agentGrant, { userId: 'agt1', subjectType: SubjectType.USER })).toBe(false)
  })

  it('defaults to USER when no subjectType is given (back-compat)', () => {
    expect(evaluatePermission(userGrant, { userId: 'agt1' })).toBe(true)
    expect(evaluatePermission(agentGrant, { userId: 'agt1' })).toBe(false)
  })

  it('evaluates ROLE grants for agents on role power alone, ignoring subject kind', () => {
    const editorGrant = {
      granted_type: PermissionGrantedType.ROLE,
      granted_role: PermissionRole.EDITOR,
    }
    expect(
      evaluatePermission(editorGrant, { userId: 'agt1', subjectType: SubjectType.AGENT, permissionRole: PermissionRole.EDITOR }),
    ).toBe(true)
    expect(
      evaluatePermission(editorGrant, { userId: 'agt1', subjectType: SubjectType.AGENT, permissionRole: PermissionRole.VIEWER }),
    ).toBe(false)
  })

  it('frontend wrapper never matches an agent subject, even on an id collision', () => {
    // usePermissions only ever evaluates for the signed-in human, so the
    // wrapper pins USER — an agent-subject grant must read as denied there and
    // be decided server-side instead.
    expect(evaluateTableFieldPermission(agentGrant, { userId: 'agt1' })).toBe(false)
  })
})

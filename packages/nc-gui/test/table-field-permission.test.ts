import { describe, expect, it } from 'vitest'
import { PermissionGrantedType, PermissionRole } from 'nocodb-sdk'
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

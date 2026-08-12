import {
  evaluatePermission,
  matchesTeamSubjectByPaths,
  PermissionGrantedType,
  PermissionRole,
} from './index';

describe('permission evaluator', () => {
  describe('matchesTeamSubjectByPaths', () => {
    const teams = [
      { team_id: 'frontend', path: 'org/eng/frontend' },
      { team_id: 'qa', path: 'org/qa' },
    ];

    it('self_only matches only direct membership', () => {
      expect(
        matchesTeamSubjectByPaths(
          { id: 'frontend', hierarchy_scope: 'self_only' },
          teams
        )
      ).toBe(true);
      expect(
        matchesTeamSubjectByPaths(
          { id: 'eng', hierarchy_scope: 'self_only' },
          teams
        )
      ).toBe(false);
    });

    it('self_and_descendants matches an ancestor team via path', () => {
      // user is directly in "frontend", whose path includes "eng" and "org"
      expect(matchesTeamSubjectByPaths({ id: 'eng' }, teams)).toBe(true);
      expect(matchesTeamSubjectByPaths({ id: 'org' }, teams)).toBe(true);
      expect(matchesTeamSubjectByPaths({ id: 'backend' }, teams)).toBe(false);
    });
  });

  describe('evaluatePermission', () => {
    it('allows when there is no permission set', () => {
      expect(evaluatePermission(null, { userId: 'u1' })).toBe(true);
    });

    it('USER grant: matches a user subject', () => {
      const perm = {
        granted_type: PermissionGrantedType.USER,
        subjects: [{ type: 'user', id: 'u1' }],
      };
      expect(evaluatePermission(perm, { userId: 'u1' })).toBe(true);
      expect(evaluatePermission(perm, { userId: 'u2' })).toBe(false);
    });

    it('USER grant: falls back to the caller-resolved team match', () => {
      const perm = {
        granted_type: PermissionGrantedType.USER,
        subjects: [{ type: 'team', id: 't1' }],
      };
      expect(
        evaluatePermission(perm, { userId: 'u2', matchedTeamSubject: true })
      ).toBe(true);
      expect(
        evaluatePermission(perm, { userId: 'u2', matchedTeamSubject: false })
      ).toBe(false);
    });

    it('ROLE grant: compares role power', () => {
      const perm = {
        granted_type: PermissionGrantedType.ROLE,
        granted_role: PermissionRole.EDITOR,
      };
      expect(
        evaluatePermission(perm, { permissionRole: PermissionRole.CREATOR })
      ).toBe(true); // creator(5) >= editor(4)
      expect(
        evaluatePermission(perm, { permissionRole: PermissionRole.VIEWER })
      ).toBe(false); // viewer(2) < editor(4)
      expect(evaluatePermission(perm, {})).toBe(false); // no role → denied
    });
  });
});

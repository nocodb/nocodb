import 'mocha';
import { expect } from 'chai';
import { resolveRlsDynamicValues } from '~/ee/utils/rls-resolver';
import type { RlsUserContext } from '~/ee/utils/rls-resolver';

/**
 * Pure unit tests for team hierarchy utilities.
 *
 * These tests don't require a running server or database — they test
 * pure functions (resolveRlsDynamicValues) with synthetic inputs.
 *
 * For integration tests that hit the DB (isUserInTeamOrDescendants,
 * Permission.isAllowed, resolveRlsPolicies), see team-hierarchy.test.ts
 * in the metaApiV3 directory.
 */

export function teamHierarchyUtilTests() {
  describe('Team Hierarchy Utilities', () => {
    // ---------------------------------------------------------------
    // resolveRlsDynamicValues
    // ---------------------------------------------------------------

    describe('resolveRlsDynamicValues', () => {
      const baseUser: RlsUserContext = {
        id: 'user123',
        email: 'alice@example.com',
        roles: 'editor,viewer',
        teams: ['teamA', 'teamB'],
        teamsWithDescendants: ['teamA', 'teamB', 'teamA-child1', 'teamA-child2'],
        teamDescendantMemberUserIds: ['user123', 'user456', 'user789'],
      };

      it('should resolve {currentUser.id}', () => {
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.id}' },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0].value).to.equal('user123');
      });

      it('should resolve {currentUser.email}', () => {
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.email}' },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0].value).to.equal('alice@example.com');
      });

      it('should resolve {currentUser.roles}', () => {
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.roles}' },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0].value).to.equal('editor,viewer');
      });

      it('should resolve {currentUser.teams}', () => {
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.teams}' },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0].value).to.equal('teamA,teamB');
      });

      it('should resolve {currentUser.teamWithDescendantMembers} to member user IDs', () => {
        const filters = [
          {
            fk_column_id: 'col1',
            comparison_op: 'eq',
            value: '{currentUser.teamWithDescendantMembers}',
          },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        // Should resolve to user IDs of members (not team IDs)
        expect(resolved[0].value).to.equal('user123,user456,user789');
      });

      it('should return empty string when teamDescendantMemberUserIds is missing', () => {
        const userWithoutMembers: RlsUserContext = {
          id: 'user456',
          teams: ['teamX'],
        };

        const filters = [
          {
            fk_column_id: 'col1',
            comparison_op: 'eq',
            value: '{currentUser.teamWithDescendantMembers}',
          },
        ];

        const resolved = resolveRlsDynamicValues(filters, userWithoutMembers);
        expect(resolved[0].value).to.equal('');
      });

      it('should return empty string when no team context at all', () => {
        const minimalUser: RlsUserContext = { id: 'user789' };

        const filters = [
          {
            fk_column_id: 'col1',
            comparison_op: 'eq',
            value: '{currentUser.teamWithDescendantMembers}',
          },
        ];

        const resolved = resolveRlsDynamicValues(filters, minimalUser);
        expect(resolved[0].value).to.equal('');
      });

      it('should return empty string for missing email', () => {
        const noEmail: RlsUserContext = { id: 'user789' };
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.email}' },
        ];

        const resolved = resolveRlsDynamicValues(filters, noEmail);
        expect(resolved[0].value).to.equal('');
      });

      it('should return empty string for missing roles', () => {
        const noRoles: RlsUserContext = { id: 'user789' };
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.roles}' },
        ];

        const resolved = resolveRlsDynamicValues(filters, noRoles);
        expect(resolved[0].value).to.equal('');
      });

      it('should return empty string for missing teams', () => {
        const noTeams: RlsUserContext = { id: 'user789' };
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.teams}' },
        ];

        const resolved = resolveRlsDynamicValues(filters, noTeams);
        expect(resolved[0].value).to.equal('');
      });

      it('should handle multiple placeholders in the same filter', () => {
        const filters = [
          {
            fk_column_id: 'col1',
            comparison_op: 'eq',
            value: '{currentUser.id}-{currentUser.email}',
          },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0].value).to.equal('user123-alice@example.com');
      });

      it('should leave non-placeholder values unchanged', () => {
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: 'static-value' },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0].value).to.equal('static-value');
      });

      it('should leave unknown placeholders unchanged', () => {
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.unknown}' },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0].value).to.equal('{currentUser.unknown}');
      });

      it('should skip non-string values', () => {
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: 42 },
          { fk_column_id: 'col2', comparison_op: 'eq', value: null },
          { fk_column_id: 'col3', comparison_op: 'eq', value: true },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0].value).to.equal(42);
        expect(resolved[1].value).to.equal(null);
        expect(resolved[2].value).to.equal(true);
      });

      it('should recurse into children (group filters)', () => {
        const filters = [
          {
            logical_op: 'or',
            children: [
              { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.id}' },
              { fk_column_id: 'col2', comparison_op: 'eq', value: '{currentUser.teams}' },
            ],
          },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0].children[0].value).to.equal('user123');
        expect(resolved[0].children[1].value).to.equal('teamA,teamB');
      });

      it('should handle deeply nested children', () => {
        const filters = [
          {
            logical_op: 'and',
            children: [
              {
                logical_op: 'or',
                children: [
                  {
                    fk_column_id: 'col1',
                    comparison_op: 'eq',
                    value: '{currentUser.teamWithDescendantMembers}',
                  },
                ],
              },
            ],
          },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0].children[0].children[0].value).to.equal(
          'user123,user456,user789',
        );
      });

      it('should handle empty filters array', () => {
        const resolved = resolveRlsDynamicValues([], baseUser);
        expect(resolved).to.deep.equal([]);
      });

      it('should handle null/undefined filters', () => {
        expect(resolveRlsDynamicValues(null as any, baseUser)).to.equal(null);
        expect(resolveRlsDynamicValues(undefined as any, baseUser)).to.equal(
          undefined,
        );
      });

      it('should not mutate original filters', () => {
        const original = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.id}' },
        ];
        const originalValue = original[0].value;

        resolveRlsDynamicValues(original, baseUser);
        expect(original[0].value).to.equal(originalValue);
      });

      it('should handle filter with children but no value', () => {
        const filters = [
          {
            logical_op: 'and',
            children: [
              { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.id}' },
            ],
          },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved[0]).to.not.have.property('value');
        expect(resolved[0].children[0].value).to.equal('user123');
      });

      it('should handle multiple filters in the array', () => {
        const filters = [
          { fk_column_id: 'col1', comparison_op: 'eq', value: '{currentUser.id}' },
          { fk_column_id: 'col2', comparison_op: 'eq', value: '{currentUser.email}' },
          { fk_column_id: 'col3', comparison_op: 'eq', value: 'literal' },
        ];

        const resolved = resolveRlsDynamicValues(filters, baseUser);
        expect(resolved).to.have.length(3);
        expect(resolved[0].value).to.equal('user123');
        expect(resolved[1].value).to.equal('alice@example.com');
        expect(resolved[2].value).to.equal('literal');
      });
    });
  });
}

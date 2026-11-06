import { ProjectRoles } from '~/lib/enums';
import { AgentScope, isPersonalAgent, personalAgentRole } from './index';

describe('personalAgentRole', () => {
  it('caps creator and owner at editor', () => {
    expect(personalAgentRole(ProjectRoles.CREATOR)).toBe('editor');
    expect(personalAgentRole(ProjectRoles.OWNER)).toBe('editor');
  });

  it('applies the role cap', () => {
    expect(personalAgentRole(ProjectRoles.EDITOR, ProjectRoles.VIEWER)).toBe(
      'viewer'
    );
    expect(personalAgentRole(ProjectRoles.VIEWER, null)).toBe('viewer');
    expect(personalAgentRole(ProjectRoles.VIEWER, ProjectRoles.COMMENTER)).toBe(
      'viewer'
    );
  });

  it('is null without an effective owner role', () => {
    expect(personalAgentRole(undefined)).toBeNull();
    expect(personalAgentRole(null)).toBeNull();
    expect(personalAgentRole(ProjectRoles.NO_ACCESS)).toBeNull();
    expect(personalAgentRole(ProjectRoles.APP_USER)).toBeNull();
  });
});

describe('isPersonalAgent', () => {
  it('is true only for the personal scope', () => {
    expect(isPersonalAgent({ scope: AgentScope.PERSONAL })).toBe(true);
    expect(isPersonalAgent({ scope: AgentScope.SHARED })).toBe(false);
    expect(isPersonalAgent({ scope: null })).toBe(false);
    expect(isPersonalAgent(undefined)).toBe(false);
  });
});

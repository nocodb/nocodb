import { actingAgentId, agentChainDepth } from './serviceUser';

describe('actingAgentId', () => {
  it('is the agent id for an agent actor', () => {
    expect(actingAgentId({ id: 'ag1', is_agent: true })).toBe('ag1');
  });

  it('is the acting agent id for a user acting through an agent', () => {
    expect(
      actingAgentId({ id: 'us1', acting_agent: { id: 'ag2', title: 'x' } })
    ).toBe('ag2');
  });

  it('is undefined for a plain user or no user', () => {
    expect(actingAgentId({ id: 'us1' })).toBeUndefined();
    expect(actingAgentId(undefined)).toBeUndefined();
  });
});

describe('agentChainDepth', () => {
  it('reads the recorded depth', () => {
    expect(
      agentChainDepth({
        id: 'us1',
        acting_agent: { id: 'ag2', title: 'x' },
        agent_chain_depth: 2,
      })
    ).toBe(2);
  });

  it('defaults to 1 for an agent without a recorded depth', () => {
    expect(agentChainDepth({ id: 'ag1', is_agent: true })).toBe(1);
  });

  it('is 0 outside an agent chain', () => {
    expect(agentChainDepth({ id: 'us1' })).toBe(0);
    expect(agentChainDepth(undefined)).toBe(0);
  });
});

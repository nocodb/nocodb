import { isPersonalAgent } from 'nocodb-sdk'
import type { AgentType } from 'nocodb-sdk'

/** Pickers and member lists offer agents that act as an identity; a personal agent acts as its owner. */
export const selectableAgents = <T extends Pick<AgentType, 'scope'>>(agents: T[]): T[] =>
  agents.filter((agent) => !isPersonalAgent(agent))

import type { AgentType, AuditType } from 'nocodb-sdk'

/**
 * The agent whose run wrote this audit row, if one did. Only the id is stored; the
 * title comes from the viewer's own agents, so a personal agent's name stays private.
 */
export const auditAgent = (
  audit: Pick<AuditType, 'details'> | null | undefined,
  agents?: Map<string, AgentType[]>,
): { title?: string } | undefined => {
  try {
    const details = typeof audit?.details === 'string' ? JSON.parse(audit.details) : audit?.details
    const id = (details as { agent?: { id?: unknown } } | null | undefined)?.agent?.id
    if (typeof id !== 'string' || !id) return undefined

    for (const list of agents?.values() ?? []) {
      const title = list.find((agent) => agent.id === id)?.title
      if (title) return { title }
    }
    return {}
  } catch {
    return undefined
  }
}

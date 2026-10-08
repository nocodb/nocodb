import type { Edge, Node } from '@vue-flow/core'
import dayjs from 'dayjs'
import type {
  IWorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowGeneralNode,
  WorkflowNodeDefinition,
  WorkflowType,
} from 'nocodb-sdk'
import { GeneralNodeID, INIT_WORKFLOW_NODES, WorkflowNodeCategory } from 'nocodb-sdk'
import { generateRandomUUID } from '~/utils/generateName'
import type { IconMapKey } from '~/utils/iconUtils'
import { getI18n } from '~/plugins/a.i18n'

/**
 * Filter nodes and edges based on edit permission
 * Removes Plus and Trigger nodes when user doesn't have edit permission
 */
const filterNodesByPermission = (nodes: Array<Node>, edges: Array<Edge>, hasEditPermission: boolean) => {
  if (hasEditPermission) {
    return { nodes, edges }
  }

  // Filter out Plus and Trigger nodes when user doesn't have edit permission
  const filteredNodes = nodes.filter((node) => node.type !== GeneralNodeID.PLUS && node.type !== GeneralNodeID.TRIGGER)

  // Get IDs of filtered out nodes
  const filteredNodeIds = new Set(
    nodes.filter((node) => node.type === GeneralNodeID.PLUS || node.type === GeneralNodeID.TRIGGER).map((n) => n.id),
  )

  // Filter out edges connected to filtered nodes
  const filteredEdges = edges.filter((edge) => !filteredNodeIds.has(edge.source) && !filteredNodeIds.has(edge.target))

  return { nodes: filteredNodes, edges: filteredEdges }
}

/**
 * Get source nodes/edges based on permission
 * Don't use draft if user doesn't have edit permission
 */
const getSourceNodesAndEdges = (workflow: WorkflowType, hasEditPermission: boolean) => {
  const sourceNodes = hasEditPermission
    ? workflow?.draft?.nodes || workflow?.nodes || INIT_WORKFLOW_NODES
    : workflow?.nodes || INIT_WORKFLOW_NODES

  const sourceEdges = hasEditPermission ? workflow?.draft?.edges || workflow?.edges || [] : workflow?.edges || []

  return { sourceNodes: sourceNodes as Array<Node>, sourceEdges: sourceEdges as Array<Edge> }
}

const generateUniqueNodeId = (nodes: Node[]): string => {
  let candidateId = generateRandomUUID()

  // Keep incrementing until we find an ID that doesn't exist
  while (nodes.some((n) => n.id === candidateId)) {
    candidateId = generateRandomUUID()
  }

  return candidateId
}

/**
 * Generate a unique trigger ID for webhook triggers
 * Format: trg_{8 alphanumeric characters}
 */
const generateTriggerId = (): string => {
  const uuid = generateRandomUUID()
  // Use first 8 characters of UUID (removing hyphens)
  const shortId = uuid.replace(/-/g, '').substring(0, 8)
  return `trg_${shortId}`
}

interface UIWorkflowNodeDefinition extends WorkflowNodeDefinition {
  input?: number
  output?: number
}

function transformNode(backendNode: WorkflowNodeDefinition): UIWorkflowNodeDefinition {
  const inputPorts = backendNode.ports.filter((p: any) => p.direction === 'input')
  const outputPorts = backendNode.ports.filter((p: any) => p.direction === 'output')

  return {
    ...backendNode,
    input: inputPorts.length > 0 ? inputPorts.length : undefined,
    output: outputPorts.length > 0 ? outputPorts.length : undefined,
  }
}

/**
 * Find all parent nodes (upstream nodes) for a given node
 * @param nodeId - The node ID to find parents for
 * @param edges - All edges in the workflow
 * @returns array of parent node IDs in execution order
 */
const findAllParentNodes = (nodeId: string, edges: Edge[]): string[] => {
  const parents: string[] = []
  const visited = new Set<string>()

  const traverse = (currentId: string) => {
    if (visited.has(currentId)) return
    visited.add(currentId)

    // Find edges that point to this node
    const parentEdges = edges.filter((edge) => edge.target === currentId)

    for (const edge of parentEdges) {
      if (edge.source && edge.source !== currentId) {
        // First traverse to parents of this parent (to maintain execution order)
        traverse(edge.source)
        // Then add this parent
        if (!parents.includes(edge.source)) {
          parents.push(edge.source)
        }
      }
    }
  }

  traverse(nodeId)
  return parents
}

/**
 * Recursively prefix all variable keys (including children) with the node reference
 */
const prefixVariableKeysRecursive = (variable: any, prefix: string): any => {
  return {
    ...variable,
    key: `${prefix}.${variable.key}`,
    children: variable.children?.map((child: any) => prefixVariableKeysRecursive(child, prefix)),
  }
}

/**
 * Generate a unique node title based on the node type title
 * E.g., 'NocoDB', 'NocoDB1', 'NocoDB2', etc.
 */
const generateUniqueNodeTitle = (nodeMeta: UIWorkflowNodeDefinition, nodes: Node[]): string => {
  const baseTitle = nodeMeta.title

  // Get all existing node titles that start with this base title
  const existingTitles = nodes.map((n) => n.data?.title).filter((title): title is string => typeof title === 'string')

  // Check if base title is available (without number)
  if (!existingTitles.includes(baseTitle)) {
    return baseTitle
  }

  // Find the highest number used with this base title
  let maxNumber = 0
  const regex = new RegExp(`^${baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`)

  existingTitles.forEach((title) => {
    const match = title.match(regex)
    if (match && match[1]) {
      const num = parseInt(match[1], 10)
      if (num > maxNumber) {
        maxNumber = num
      }
    }
  })

  // Return the next available number
  return `${baseTitle}${maxNumber + 1}`
}

const findAllChildNodes = (nodeId: string, edges: Edge[]): Set<string> => {
  const children = new Set<string>()
  const visited = new Set<string>()

  const traverse = (currentId: string) => {
    if (visited.has(currentId)) return
    visited.add(currentId)

    const childEdges = edges.filter((edge) => edge.source === currentId)

    for (const edge of childEdges) {
      if (edge.target) {
        children.add(edge.target)
        traverse(edge.target)
      }
    }
  }

  traverse(nodeId)
  return children
}

/**
 * Find which output port from an iterate node leads to a target node
 * Recursively follows edges to determine the port path
 * @param iterateNodeId - The iterate node ID
 * @param targetNodeId - The target node ID we're trying to reach
 * @param edges - All edges in the workflow
 * @returns The port ID ('body' or 'output') or null if no path found
 */
const findIterateNodePortForPath = (iterateNodeId: string, targetNodeId: string, edges: Edge[]): string | null => {
  // Find all edges from the iterate node
  const iterateEdges = edges.filter((e) => e.source === iterateNodeId)

  // For each output port from the iterate node
  for (const edge of iterateEdges) {
    const portId = edge.sourceHandle

    // Check if this edge leads to the target node (directly or indirectly)
    const visited = new Set<string>()
    const queue = [edge.target]

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!

      if (currentNodeId === targetNodeId) {
        // Found a path from this port to the target node
        return portId as string
      }

      if (visited.has(currentNodeId)) continue
      visited.add(currentNodeId)

      // Add all child nodes to the queue
      const childEdges = edges.filter((e) => e.source === currentNodeId)
      for (const childEdge of childEdges) {
        queue.push(childEdge.target)
      }
    }
  }

  return null
}

/**
 * Update variable references in a string when a node is renamed
 * Replaces $('oldName') with $('newName') and $("oldName") with $("newName")
 * @param content - The string content to update
 * @param oldTitle - The old node title
 * @param newTitle - The new node title
 * @returns Updated string with replaced variable references
 */
const updateVariableReferences = (content: string, oldTitle: string, newTitle: string): string => {
  if (!ncIsString(content)) return content

  // Escape special regex characters in both titles
  const escapedOldTitle = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedNewTitle = newTitle.replace(/\$/g, '$$$$') // Escape $ for replacement string

  // Replace both single and double quoted references
  const singleQuoteRegex = new RegExp(`\\$\\('${escapedOldTitle}'\\)`, 'g')
  const doubleQuoteRegex = new RegExp(`\\$\\("${escapedOldTitle}"\\)`, 'g')

  let updated = content.replace(singleQuoteRegex, `$('${escapedNewTitle}')`)
  updated = updated.replace(doubleQuoteRegex, `$("${escapedNewTitle}")`)

  return updated
}
/**
 * Recursively update variable references in an object
 * @param obj - The object to update
 * @param oldTitle - The old node title
 * @param newTitle - The new node title
 * @returns Updated object with replaced variable references
 */
const updateVariableReferencesInObject = (obj: any, oldTitle: string, newTitle: string): any => {
  if (ncIsNullOrUndefined(obj)) return obj

  if (ncIsString(obj)) {
    return updateVariableReferences(obj, oldTitle, newTitle)
  }

  if (ncIsArray(obj)) {
    return obj.map((item) => updateVariableReferencesInObject(item, oldTitle, newTitle))
  }

  if (ncIsObject(obj)) {
    const updated: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        updated[key] = updateVariableReferencesInObject(obj[key], oldTitle, newTitle)
      }
    }
    return updated
  }

  return obj
}

/**
 * Steps saved without a title get their default one, and `$('<id>')` references to them follow.
 * Runs look steps up by title, so an untitled step's outputs never resolve. Returns the same
 * array when nothing needed a title, so callers can skip the write.
 */
function withRepairedNodeTitles(nodes: Node[], getNodeMeta: (type?: string) => UIWorkflowNodeDefinition | null) {
  let repaired = nodes
  for (const node of nodes) {
    if (node.data?.title || node.type === GeneralNodeID.PLUS || node.type === GeneralNodeID.NOTE) continue
    const meta = getNodeMeta(node.type)
    if (!meta?.title) continue
    const title = generateUniqueNodeTitle(meta, repaired)
    repaired = repaired.map((n) =>
      n.id === node.id
        ? { ...n, data: { ...n.data, title } }
        : n.data?.config
        ? { ...n, data: { ...n.data, config: updateVariableReferencesInObject(n.data.config, node.id, title) } }
        : n,
    )
  }
  return repaired
}

// `label` / `tooltip` are i18n keys (filled from `labelParams`); `bg` fills the status dot,
// `text` colours inline status text. `detail` is free text, e.g. an operator's suspension reason.
interface WorkflowExecutionStatusDisplay {
  label: string
  labelParams?: Record<string, string | number>
  icon: IconMapKey
  bg: string
  text: string
  spin?: boolean
  tooltip?: string
  detail?: string | null
}

// The engine's retry policy for a retry-safe step with no "On failure" setting of its own.
const DEFAULT_STEP_RETRIES = 2

const WORKFLOW_EXECUTION_STATUS_DISPLAY = {
  queued: {
    label: 'labels.workflow.status.queued',
    icon: 'ncClock',
    bg: 'bg-nc-gray-400 dark:bg-nc-gray-500',
    text: 'text-nc-content-gray-subtle2',
  },
  running: {
    label: 'labels.workflow.status.running',
    icon: 'refresh',
    bg: 'bg-nc-brand-500 dark:bg-nc-brand-500',
    text: 'text-nc-content-brand',
    spin: true,
  },
  stopping: {
    label: 'labels.workflow.status.stopping',
    icon: 'refresh',
    bg: 'bg-nc-red-500 dark:bg-nc-red-500',
    text: 'text-nc-content-red-dark',
    spin: true,
  },
  pausing: {
    label: 'labels.workflow.status.pausing',
    icon: 'refresh',
    bg: 'bg-nc-orange-400 dark:bg-nc-orange-500',
    text: 'text-nc-content-orange-dark',
    spin: true,
  },
  waiting: {
    label: 'labels.workflow.status.waiting',
    icon: 'ncClock',
    bg: 'bg-nc-orange-400 dark:bg-nc-orange-500',
    text: 'text-nc-content-orange-dark',
  },
  retrying: {
    label: 'labels.workflow.status.retryingAt',
    icon: 'ncRotateCcw',
    bg: 'bg-nc-orange-400 dark:bg-nc-orange-500',
    text: 'text-nc-content-orange-dark',
  },
  onHold: {
    label: 'labels.workflow.status.onHoldAppSuspended',
    tooltip: 'tooltip.workflowExecutionOnHold',
    icon: 'ncPause',
    bg: 'bg-nc-orange-400 dark:bg-nc-orange-500',
    text: 'text-nc-content-orange-dark',
  },
  appSuspended: {
    label: 'labels.workflow.status.stoppedAppSuspended',
    icon: 'ncX',
    bg: 'bg-nc-gray-400 dark:bg-nc-gray-500',
    text: 'text-nc-content-gray-subtle2',
  },
  workspaceSuspended: {
    label: 'labels.workflow.status.stoppedWorkspaceSuspended',
    icon: 'ncX',
    bg: 'bg-nc-gray-400 dark:bg-nc-gray-500',
    text: 'text-nc-content-gray-subtle2',
  },
  paused: {
    label: 'labels.workflow.status.paused',
    icon: 'ncPause',
    bg: 'bg-nc-orange-400 dark:bg-nc-orange-500',
    text: 'text-nc-content-orange-dark',
  },
  completed: {
    label: 'labels.workflow.status.completed',
    icon: 'ncCheck',
    bg: 'bg-nc-green-700 dark:bg-nc-green-200',
    text: 'text-nc-content-green-dark',
  },
  error: {
    label: 'labels.workflow.status.error',
    icon: 'ncX',
    bg: 'bg-nc-red-500 dark:bg-nc-red-500',
    text: 'text-nc-content-red-dark',
  },
  interrupted: {
    label: 'labels.workflow.status.interrupted',
    tooltip: 'tooltip.workflowExecutionInterrupted',
    icon: 'ncAlertCircle',
    bg: 'bg-nc-red-500 dark:bg-nc-red-500',
    text: 'text-nc-content-red-dark',
  },
  cancelled: {
    label: 'labels.workflow.status.cancelled',
    icon: 'ncX',
    bg: 'bg-nc-gray-400 dark:bg-nc-gray-500',
    text: 'text-nc-content-gray-subtle2',
  },
  skipped: {
    label: 'labels.workflow.status.skipped',
    icon: 'ncMinus',
    bg: 'bg-nc-gray-400 dark:bg-nc-gray-500',
    text: 'text-nc-content-gray-subtle2',
  },
} satisfies Record<
  | WorkflowExecutionStatus
  | 'stopping'
  | 'pausing'
  | 'interrupted'
  | 'retrying'
  | 'onHold'
  | 'appSuspended'
  | 'workspaceSuspended',
  WorkflowExecutionStatusDisplay
>

function formatWorkflowResumeTime(value: number | string | Date) {
  const time = dayjs(value)
  return time.isSame(dayjs(), 'day') ? time.format('h:mm A') : time.format('MMM D, h:mm A')
}

function formatWorkflowDuration(ms?: number | null) {
  if (ms === null || ms === undefined) return '-'
  const { t } = getI18n().global
  if (ms < 1000) return t('labels.workflow.duration.milliseconds', { n: Math.round(ms) })
  if (ms < 60_000) return t('labels.workflow.duration.seconds', { n: (ms / 1000).toFixed(1) })
  return t('labels.workflow.duration.minutesSeconds', { m: Math.floor(ms / 60_000), s: Math.round((ms % 60_000) / 1000) })
}

/** Attempt numbers for a run waiting to retry a step; `total` is absent when the policy is unknown. */
function getWorkflowPendingRetry(
  execution?: Pick<IWorkflowExecution, 'status' | 'execution_data' | 'workflow_data'> | null,
): { attempt: number; total?: number } | null {
  const state = execution?.execution_data
  if (execution?.status !== 'waiting' || !state?.pendingRetry) return null

  const nodes: WorkflowGeneralNode[] | undefined = execution.workflow_data?.nodes
  const node = nodes?.find((n) => n.id === state.nextNodeId)

  return {
    attempt: state.pendingRetry.attempts.length + 1,
    total: node ? (node.data?.retry?.retries ?? DEFAULT_STEP_RETRIES) + 1 : undefined,
  }
}

const getWorkflowExecutionStatusDisplay = (
  execution?: Pick<IWorkflowExecution, 'status' | 'control' | 'execution_data' | 'resume_at' | 'workflow_data'> | null,
): WorkflowExecutionStatusDisplay => {
  const status = execution?.status
  const state = execution?.execution_data

  if (status === 'running' && execution?.control === 'cancel') return WORKFLOW_EXECUTION_STATUS_DISPLAY.stopping
  if (status === 'running' && execution?.control === 'pause') return WORKFLOW_EXECUTION_STATUS_DISPLAY.pausing
  if (status === 'error' && state?.errorCode === 'INTERRUPTED') {
    return WORKFLOW_EXECUTION_STATUS_DISPLAY.interrupted
  }
  if (status === 'error' && state?.errorCode === 'INVALID_SCHEDULE') {
    return { ...WORKFLOW_EXECUTION_STATUS_DISPLAY.error, detail: state.errorMessage }
  }
  if (status === 'cancelled' && state?.errorCode === 'APP_SUSPENDED') {
    return { ...WORKFLOW_EXECUTION_STATUS_DISPLAY.appSuspended, detail: state.errorMessage }
  }
  if (status === 'cancelled' && state?.errorCode === 'WORKSPACE_SUSPENDED') {
    return { ...WORKFLOW_EXECUTION_STATUS_DISPLAY.workspaceSuspended, detail: state.errorMessage }
  }

  if (status === 'waiting') {
    if (state?.hold) return { ...WORKFLOW_EXECUTION_STATUS_DISPLAY.onHold, detail: state.hold.reason }

    const resumeAt = execution?.resume_at ?? state?.resumeAt
    const retry = getWorkflowPendingRetry(execution)
    if (retry && resumeAt) {
      return {
        ...WORKFLOW_EXECUTION_STATUS_DISPLAY.retrying,
        label: retry.total ? 'labels.workflow.status.retryingAt' : 'labels.workflow.status.retryingAtAttempt',
        labelParams: { time: formatWorkflowResumeTime(resumeAt), n: retry.attempt, total: retry.total ?? '' },
      }
    }
    if (resumeAt) {
      return {
        ...WORKFLOW_EXECUTION_STATUS_DISPLAY.waiting,
        label: 'labels.workflow.status.scheduledFor',
        labelParams: { time: formatWorkflowResumeTime(resumeAt) },
      }
    }
  }

  return (status && WORKFLOW_EXECUTION_STATUS_DISPLAY[status]) || WORKFLOW_EXECUTION_STATUS_DISPLAY.queued
}

// Literal class strings: this file is on UnoCSS's scan list.
const WORKFLOW_NODE_TINTS = {
  purple: 'bg-nc-purple-100 dark:bg-nc-purple-20 text-nc-content-purple-dark',
  orange: 'bg-nc-orange-100 dark:bg-nc-orange-20 text-nc-content-orange-dark',
  pink: 'bg-nc-pink-100 dark:bg-nc-pink-20 text-nc-content-pink-dark',
  blue: 'bg-nc-blue-100 dark:bg-nc-blue-20 text-nc-content-blue-dark',
  green: 'bg-nc-green-100 dark:bg-nc-green-20 text-nc-content-green-dark',
  neutral: 'bg-nc-bg-gray-light text-nc-content-gray-subtle',
}

/** Icon tile colour by what a step does. Third-party steps carry brand logos, so they stay neutral. */
function getWorkflowNodeIconClass(node: Pick<WorkflowNodeDefinition, 'id' | 'category'>) {
  const id = node.id ?? ''
  if (node.category === WorkflowNodeCategory.TRIGGER) return WORKFLOW_NODE_TINTS.purple
  if (node.category === WorkflowNodeCategory.FLOW) return WORKFLOW_NODE_TINTS.orange
  if (id.startsWith('ai.') || id === 'nocodb.run_agent') return WORKFLOW_NODE_TINTS.pink
  if (id === 'nocodb.run_script' || id === 'core.action.http') return WORKFLOW_NODE_TINTS.neutral
  if (id.startsWith('nocodb.')) return WORKFLOW_NODE_TINTS.blue
  if (id.startsWith('core.action.send')) return WORKFLOW_NODE_TINTS.green
  return WORKFLOW_NODE_TINTS.neutral
}

interface WorkflowLoop {
  loopNodeId: string
  bodyNodeIds: Set<string>
  exitNodeId?: string
  exitEdgeId?: string
}

/** Each iterate node with the steps inside its loop and the step it continues to when done. */
function getWorkflowLoops(nodes: Pick<Node, 'id' | 'type'>[], edges: Pick<Edge, 'id' | 'source' | 'target' | 'sourceHandle'>[]) {
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target])
  }

  const loops: WorkflowLoop[] = []
  for (const node of nodes) {
    if (node.type !== 'core.flow.iterate') continue
    const bodyEdge = edges.find((e) => e.source === node.id && e.sourceHandle === 'body')
    if (!bodyEdge) continue
    const exitEdge = edges.find((e) => e.source === node.id && e.sourceHandle === 'output')

    const bodyNodeIds = new Set<string>()
    const queue = [bodyEdge.target]
    while (queue.length) {
      const id = queue.shift()!
      if (bodyNodeIds.has(id) || id === node.id) continue
      bodyNodeIds.add(id)
      queue.push(...(outgoing.get(id) ?? []))
    }

    loops.push({ loopNodeId: node.id, bodyNodeIds, exitNodeId: exitEdge?.target, exitEdgeId: exitEdge?.id })
  }
  return loops
}

export {
  getWorkflowLoops,
  getWorkflowNodeIconClass,
  getWorkflowExecutionStatusDisplay,
  formatWorkflowResumeTime,
  formatWorkflowDuration,
  filterNodesByPermission,
  getSourceNodesAndEdges,
  generateUniqueNodeId,
  generateTriggerId,
  transformNode,
  findAllParentNodes,
  prefixVariableKeysRecursive,
  generateUniqueNodeTitle,
  findAllChildNodes,
  findIterateNodePortForPath,
  updateVariableReferences,
  updateVariableReferencesInObject,
  withRepairedNodeTitles,
}

export type { UIWorkflowNodeDefinition, WorkflowLoop }

import type { ChatContentBlock } from 'nocodb-sdk'

export type ToolUseBlock = Extract<ChatContentBlock, { type: 'tool_use' }>

export type StepCategory = 'search' | 'create' | 'update' | 'delete' | 'link' | 'web' | 'navigate' | 'other'

export interface FieldBadge {
  name: string
  uidt?: string
}

export interface WebSource {
  url: string
  title?: string
  favicon?: string
}

export interface ThinkingStep {
  category: StepCategory
  icon: string
  label: string
  description: string
  tableName?: string
  fieldBadges: FieldBadge[]
  sources: WebSource[]
  blocks: ToolUseBlock[]
  isRunning: boolean
  isComplete: boolean
}

export interface StepConfig {
  category: StepCategory
  icon: string
  labelFn: (blocks: ToolUseBlock[]) => string
  descriptionFn?: (block: ToolUseBlock) => string
  mentionsFn?: (blocks: ToolUseBlock[]) => { tableName?: string; fieldBadges: FieldBadge[] }
  sourcesFn?: (blocks: ToolUseBlock[]) => WebSource[]
}

import type { UITypes } from 'nocodb-sdk'

export enum AiWizardTabsType {
  AUTO_SUGGESTIONS = 'AUTO_SUGGESTIONS',
  PROMPT = 'PROMPT',
}

export interface PredictedFieldType {
  title: string
  type: UITypes
  column_name?: string
  options?: string[]
  colOptions?: Record<string, any>
  formula?: string
  description?: string
  formState?: Record<string, any>
  selected?: boolean
  tab?: AiWizardTabsType
  ai_temp_id: string
}

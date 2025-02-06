<script setup lang="ts">
import { diff } from 'deep-object-diff'
import { message } from 'ant-design-vue'
import {
  ButtonActionsType,
  UITypes,
  isAIPromptCol,
  isLinksOrLTAR,
  isSystemColumn,
  isVirtualCol,
  partialUpdateAllowedTypes,
  readonlyMetaAllowedTypes,
} from 'nocodb-sdk'
import type { ButtonType, ColumnType, FilterType, SelectOptionsType, TableType } from 'nocodb-sdk'
import Draggable from 'vuedraggable'
import { onKeyDown, useMagicKeys } from '@vueuse/core'
import { generateUniqueColumnName } from '~/helpers/parsers/parserHelpers'
import { AiWizardTabsType, type PredictedFieldType } from '#imports'

interface TableExplorerColumn extends ColumnType {
  id?: string
  temp_id?: string
  column_order?: {
    order: number
    view_id: string
  }
  view_id?: string
  userHasChangedTitle?: boolean

  // extras
  colOptions?: any
  type?: ButtonActionsType
  theme?: string
  color?: string
  icon?: string
  label?: string
  fk_column_id?: string
  fk_webhook_id?: string
  fk_qr_value_column_id?: string
  fk_barcode_value_column_id?: string
  fk_lookup_column_id?: string
  fk_relation_column_id?: string
  fk_rollup_column_id?: string
  rollup_function?: string
  formula_raw?: string
  filters?: FilterType[]
  childTable?: TableType
  childColumn?: ColumnType
  childId?: string
  custom?: {
    ref_model_id?: string
    ref_column_id?: string
    ref_column_title?: string
  }
  is_ai_field?: boolean
  ai_temp_id?: string
}

interface op {
  op: 'add' | 'update' | 'delete'
  column: TableExplorerColumn
  error?: string
}

interface fieldsVisibilityOps {
  visible: boolean
  column: TableExplorerColumn
}

interface moveOp {
  op: 'move'
  column: TableExplorerColumn
  index: number
  order: number
}

const { t } = useI18n()

const { $api } = useNuxtApp()

const { getMeta } = useMetas()

const { meta, view } = useSmartsheetStoreOrThrow()

const { isFeatureEnabled } = useBetaFeatureToggle()

const isLocked = inject(IsLockedInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const workspaceStore = useWorkspace()

const viewsStore = useViewsStore()

const { openedViewsTab } = storeToRefs(viewsStore)

const { aiIntegrationAvailable, aiLoading, aiError } = useNocoAi()

const localMetaColumns = ref<ColumnType[] | undefined>([])

const localPredictions = ref<string[]>([])

const moveOps = ref<moveOp[]>([])

const visibilityOps = ref<fieldsVisibilityOps[]>([])

const fieldsListWrapperDomRef = ref<HTMLElement>()

const {
  fields: viewFields,
  toggleFieldVisibility,
  loadViewColumns,
  isViewColumnsLoading,
  showSystemFields,
} = useViewColumnsOrThrow()

const loading = ref(false)

const columnsHash = ref<string>()

const newFields = ref<TableExplorerColumn[]>([])

const compareCols = (a?: TableExplorerColumn, b?: TableExplorerColumn) => {
  if (a?.id && b?.id) {
    return a.id === b.id
  } else if (a?.temp_id && b?.temp_id) {
    return a.temp_id === b.temp_id
  }
  return false
}

const viewFieldsMap = computed<Record<string, Field>>(() => {
  const temp: Record<string, Field> = {}
  if (viewFields.value) {
    for (const field of viewFields.value) {
      if (field.fk_column_id) temp[field.fk_column_id] = field
    }
  }
  return temp
})

const getFieldOrder = (field?: TableExplorerColumn) => {
  if (!field) return -1
  const mop = moveOps.value.find((op) => compareCols(op.column, field))
  if (mop) {
    return mop.order
  } else if (field.id) {
    const viewField = viewFieldsMap.value[field.id]
    if (viewField) {
      return viewField.order
    }
  }
  return -1
}

const showOrHideSystemFields = ref(showSystemFields.value)

const fields = computed<TableExplorerColumn[]>({
  get: () => {
    const x = ((localMetaColumns.value as ColumnType[]) ?? [])
      .filter((field) => {
        const isAllowToShowCol = isForm.value ? !formViewHiddenColTypes.includes(t.name) : true
        return (
          !field.fk_column_id &&
          (showOrHideSystemFields.value ? !!viewFieldsMap.value[field.id] : !isSystemColumn(field)) &&
          isAllowToShowCol
        )
      })
      .concat(newFields.value)
      .map((field) => updateDefaultColumnValues(field))
      .sort((a, b) => {
        return getFieldOrder(a) - getFieldOrder(b)
      })
    return x
  },
  set: (val) => {
    localMetaColumns.value = localMetaColumns.value?.map((col) => {
      const field = val.find((f) => compareCols(f, col))
      if (field) {
        return field
      }
      return col
    })
  },
})

const isAllFieldsVisible = computed(() => {
  return fields.value.every((field) => {
    if (visibilityOps.value.find((op) => op.column.fk_column_id === field.id)?.visible ?? viewFieldsMap.value[field.id!]?.show) {
      return true
    }
    return false
  })
})

// Current Selected Field
const activeField = ref()

const searchQuery = ref<string>('')

const {
  aiMode,
  aiModeStep,
  predicted,
  activeTabPredictedFields,
  activeTabSelectedFields,
  activeTabPredictHistory,
  calledFunction,
  prompt,
  oldPrompt,
  isPromtAlreadyGenerated,
  maxSelectionCount,
  activeAiTab,
  isPredictFromPromptLoading,
  isFormulaPredictionMode,
  fieldPredictionMode,
  onInit,
  toggleAiMode: _toggleAiMode,
  disableAiMode: _disableAiMode,
  predictMore,
  predictRefresh,
  predictFromPrompt,
  handleRefreshOnError,
  onToggleTag: _onToggleTag,
} = usePredictFields(ref(true), fields)

const activeTabNonSelectedFields = computed(() => activeTabPredictedFields.value.filter((f) => !f.selected))

onBeforeMount(() => {
  onInit()
})

const calculateOrderForIndex = (index: number, fromAbove = false) => {
  if (!viewFields.value) return -1

  if (index <= 0) {
    const pv = fields.value.find((f) => f.pv)
    if (pv) {
      return pv.order || 0
    }
    return -1
  }

  if (index >= fields.value.length - 1) {
    const fieldOrders = fields.value.map((f) => getFieldOrder(f))
    return Math.max(...fieldOrders) + 1
  }

  let orderBefore = -1
  let orderAfter = -1

  const fieldBefore = fields.value[index + (fromAbove ? -1 : 0)]
  const fieldAfter = fields.value[index + (fromAbove ? 0 : 1)]

  if (fieldBefore) {
    orderBefore = getFieldOrder(fieldBefore)
  }

  if (fieldAfter) {
    orderAfter = getFieldOrder(fieldAfter)
    if (orderAfter === -1) {
      orderAfter = orderBefore + 1
    }
  }

  const order = (orderBefore + orderAfter) / 2

  return order
}

// Update, Delete and New Column operations are tracked here
const ops = ref<op[]>([])

const temporaryAddCount = ref(0)

const changingField = ref(false)

const addFieldMoveHook = ref<number>()

const duplicateFieldHook = ref<TableExplorerColumn>()

const setFieldMoveHook = (field: TableExplorerColumn, before = false) => {
  const index = fields.value.findIndex((f) => compareCols(f, field))
  if (index !== -1) {
    addFieldMoveHook.value = before ? index : index + 1
  }
}

const { isMetaReadOnly } = useRoles()

const isColumnUpdateAllowed = (column: ColumnType) => {
  if (
    isMetaReadOnly.value &&
    !readonlyMetaAllowedTypes.includes(column?.uidt) &&
    !partialUpdateAllowedTypes.includes(column?.uidt) &&
    !isSystemColumn(column)
  )
    return false
  return true
}

const changeField = (field?: TableExplorerColumn, event?: MouseEvent) => {
  if (field?.id && field?.uidt && !isColumnUpdateAllowed(field)) {
    return message.info(t('msg.info.schemaReadOnly'))
  }

  if (field && field?.pk) {
    // Editing primary key not supported
    message.info(t('msg.info.editingPKnotSupported'))
    return
  }

  if (event) {
    if (event.target instanceof HTMLElement) {
      if (event.target.closest('.no-action')) return
    }
  }

  if (compareCols(field, activeField.value) || (field === undefined && activeField.value === undefined)) return

  changingField.value = true

  nextTick(() => {
    activeField.value = field
    changingField.value = false
  })
}

const addField = (field?: TableExplorerColumn, before = false) => {
  if (field) {
    setFieldMoveHook(field, before)
  }
  changeField({})

  // Scroll to the bottom of the list for new field add
  setTimeout(() => {
    if (!field && !before && fieldsListWrapperDomRef.value) {
      fieldsListWrapperDomRef.value.scrollTop = fieldsListWrapperDomRef.value.scrollHeight
    }
  }, 100)
}

const displayColumn = computed(() => {
  if (!localMetaColumns.value) return
  return localMetaColumns.value.find((col) => col.pv)
})

const duplicateField = async (field: TableExplorerColumn) => {
  if (!localMetaColumns.value) return

  // generate duplicate column name
  const duplicateColumnName = getUniqueColumnName(`${field.title} copy`, [...localMetaColumns.value, ...newFields.value])

  let fieldPayload = {}

  // construct column create payload
  switch (field.uidt) {
    case UITypes.LinkToAnotherRecord:
    case UITypes.Links:
    case UITypes.Lookup:
    case UITypes.Rollup:
    case UITypes.Formula:
    case UITypes.Button:
      return message.info(t('msg.info.notAvailableAtTheMoment'))
    case UITypes.SingleSelect:
    case UITypes.MultiSelect:
      fieldPayload = {
        ...field,
        title: duplicateColumnName,
        column_name: duplicateColumnName,
        id: undefined,
        order: undefined,
        pv: false,
        colOptions: {
          options:
            (field.colOptions as SelectOptionsType)?.options?.map((option: Record<string, any>) => ({
              ...option,
              id: undefined,
            })) ?? [],
        },
      }
      break
    default:
      fieldPayload = {
        ...field,
        title: duplicateColumnName,
        column_name: duplicateColumnName,
        id: undefined,
        colOptions: undefined,
        order: undefined,
        pv: false,
      }
      break
  }

  addField(field)

  duplicateFieldHook.value = fieldPayload as TableExplorerColumn
}

// Check any filter is changed recursively
const checkForFilterChange = (filters: (FilterType & { status?: string })[]) => {
  for (const filter of filters) {
    if (filter.status) {
      return true
    }
    if (filter.is_group) {
      if (checkForFilterChange(filter.children || [])) {
        return true
      }
    }
  }
}
// This method is called whenever there is a change in field properties
const onFieldUpdate = (state: TableExplorerColumn, skipLinkChecks = false) => {
  const col = fields.value.find((col) => compareCols(col, state))
  if (!col) return

  if (state.colOptions && [UITypes.SingleSelect, UITypes.MultiSelect].includes(col.uidt)) {
    state = {
      ...state,
      colOptions: {
        ...(state.colOptions || {}),
        options: ((state.colOptions as SelectOptionsType)?.options || []).map((option) => {
          if (option?.index !== undefined) {
            delete option.index
          }
          return option
        }),
      },
    }
  }

  const pdiffs: Record<string, any> = diff(col, state)

  // remove undefined values
  const diffs = Object.fromEntries(
    Object.entries(pdiffs).filter(([_, value]) => value !== undefined),
  ) as Partial<TableExplorerColumn>

  if (
    Object.keys(diffs).length === 0 ||
    // skip custom prop since it's only used for custom LTAR links
    (Object.keys(diffs).length === 1 && 'custom' in diffs && Object.keys(diffs.custom).length === 0) ||
    (Object.keys(diffs).length === 1 && 'altered' in diffs)
  ) {
    ops.value = ops.value.filter((op) => op.op === 'add' || !compareCols(op.column, state))
  } else {
    const field = ops.value.find((op) => compareCols(op.column, state))
    const moveField = moveOps.value.find((op) => compareCols(op.column, state))
    const isNewField = newFields.value.find((nField) => compareCols(nField, state))

    if (isNewField) {
      newFields.value = newFields.value.map((op) => {
        if (compareCols(op, state)) {
          ops.value = ops.value.filter((op) => op.op === 'add' && !compareCols(op.column, state))
          ops.value = [
            ...ops.value,
            {
              op: 'add',
              column: state,
            },
          ]
          return state
        }
        return op
      })
      return
    }

    if (field || (field && moveField)) {
      field.column = state
    } else if (isLinksOrLTAR(state) && !skipLinkChecks) {
      if (
        ['title', 'column_name', 'meta'].some((k) => k in diffs) ||
        ('childViewId' in diffs && diffs.childViewId !== col.colOptions?.fk_target_view_id) ||
        checkForFilterChange(diffs.filters || [])
      ) {
        ops.value = [
          ...ops.value,
          {
            op: 'update',
            column: state,
          },
        ]
      }
    } else {
      ops.value = [
        ...ops.value,
        {
          op: 'update',
          column: state,
        },
      ]
    }

    if (
      activeField.value &&
      Object.keys(activeField.value).length &&
      ((state?.id && activeField.value?.id && state?.id === activeField.value?.id) ||
        (state?.temp_id && activeField.value?.temp_id && state?.temp_id === activeField.value?.temp_id))
    ) {
      activeField.value = state
    }
  }
}

const onFieldDelete = (state: TableExplorerColumn) => {
  const field = ops.value.find((op) => compareCols(op.column, state))

  if (field) {
    if (field.op === 'delete') {
      ops.value = ops.value.filter((op) => op.column.id !== state.id)
    } else if (field.op === 'add') {
      if (activeField.value && compareCols(activeField.value, state)) {
        changeField()
      }
      ops.value = ops.value.filter((op) => op.column.temp_id !== state.temp_id)
      newFields.value = newFields.value.filter((op) => op.temp_id !== state.temp_id)

      if (state.is_ai_field) {
        const selectedAiField = predicted.value.find((sf) => sf.ai_temp_id === state.ai_temp_id)
        if (!selectedAiField) return

        _onToggleTag(selectedAiField)
      }
    } else {
      field.op = 'delete'
      field.column = state
    }
  } else {
    ops.value = [
      ...ops.value,
      {
        op: 'delete',
        column: state,
      },
    ]
  }
}

const onFieldAdd = (state: TableExplorerColumn) => {
  if (duplicateFieldHook.value) {
    state = duplicateFieldHook.value
    duplicateFieldHook.value = undefined
  }

  state.temp_id = `temp_${++temporaryAddCount.value}`
  state.view_id = view.value?.id as string
  ops.value = [
    ...ops.value,
    {
      op: 'add',
      column: state,
    },
  ]
  newFields.value = [...newFields.value, state]

  if (addFieldMoveHook.value) {
    moveOps.value.push({
      op: 'move',
      column: state,
      index: addFieldMoveHook.value,
      order: calculateOrderForIndex(addFieldMoveHook.value),
    })
    addFieldMoveHook.value = undefined
  } else {
    moveOps.value.push({
      op: 'move',
      column: state,
      index: fields.value.length,
      order: calculateOrderForIndex(fields.value.length),
    })
  }

  changeField(state)
}

const onMove = (_event: { moved: { newIndex: number; oldIndex: number } }) => {
  const field = fields.value[_event.moved.oldIndex]
  const order = calculateOrderForIndex(_event.moved.newIndex, _event.moved.newIndex < _event.moved.oldIndex)

  const op = ops.value.find((op) => compareCols(op.column, field))
  if (op?.op === 'update') {
    const diffs = diff(op.column, field)
    if (!(Object.keys(diffs).length === 1 && 'column_order' in diffs)) {
      message.warning(t('msg.warning.multiField.moveEditedField'))
      return
    }
  }

  if (op?.op === 'delete') {
    message.warning(t('msg.warning.multiField.moveDeletedField'))
    return
  }

  const mop = moveOps.value.find((op) => compareCols(op.column, fields.value[_event.moved.oldIndex]))
  if (mop) {
    mop.index = _event.moved.newIndex
    mop.order = order
  } else {
    moveOps.value.push({
      op: 'move',
      column: fields.value[_event.moved.oldIndex],
      index: _event.moved.newIndex,
      order,
    })
  }

  if (op) {
    onFieldUpdate(
      {
        ...op.column,
        column_order: {
          order,
          view_id: view.value?.id as string,
        },
      },
      true,
    )
  } else {
    onFieldUpdate(
      {
        ...field,
        column_order: {
          order,
          view_id: view.value?.id as string,
        },
      },
      true,
    )
  }
}

const isColumnValid = (column: TableExplorerColumn) => {
  const isDeleteOp = ops.value.find((op) => compareCols(column, op.column) && op.op === 'delete')
  const isNew = ops.value.find((op) => compareCols(column, op.column) && op.op === 'add')
  if (isDeleteOp) return true
  if (!column.title && !isNew) {
    return false
  }
  if ((column.uidt === UITypes.Links || column.uidt === UITypes.LinkToAnotherRecord) && isNew) {
    if (
      (!column.childColumn || !column.childTable || !column.childId) &&
      (!column.custom?.ref_model_id || !column.custom?.ref_column_id)
    ) {
      return false
    }
  }
  if (column.uidt === UITypes.Lookup && isNew) {
    if (!column.fk_relation_column_id || !column.fk_lookup_column_id) {
      return false
    }
  }
  if (column.uidt === UITypes.Rollup && isNew) {
    if (!column.fk_relation_column_id || !column.fk_rollup_column_id || !column.rollup_function) {
      return false
    }
  }
  if (column.uidt === UITypes.Formula && isNew) {
    if (!column.formula_raw) {
      return false
    }
  }

  if (column.uidt === UITypes.Button) {
    if (isNew) {
      if (column.type === ButtonActionsType.Url && !column.formula_raw) return false
      if (column.type === ButtonActionsType.Webhook && !column.fk_webhook_id) return false
    }

    if (column.type === ButtonActionsType.Ai) {
      return !(
        !column.fk_integration_id ||
        !column.formula_raw?.trim() ||
        !column.output_column_ids?.length ||
        !column.output_column_ids?.split(',')?.length
      )
    }
  }

  return true
}

function updateDefaultColumnValues(column: TableExplorerColumn) {
  if (column.uidt === UITypes.QrCode && column.colOptions?.fk_qr_value_column_id) {
    if (!column?.fk_qr_value_column_id) {
      column.fk_qr_value_column_id = column.colOptions.fk_qr_value_column_id
    }
  }

  if (column.uidt === UITypes.Barcode && column.colOptions?.fk_barcode_value_column_id) {
    if (!column?.fk_barcode_value_column_id) {
      column.fk_barcode_value_column_id = column.colOptions.fk_barcode_value_column_id
    }
  }

  if (column.uidt === UITypes.Lookup && column?.colOptions?.fk_lookup_column_id && column?.colOptions?.fk_relation_column_id) {
    if (!column?.fk_lookup_column_id) {
      column.fk_lookup_column_id = column.colOptions.fk_lookup_column_id
    }
    if (!column?.fk_relation_column_id) {
      column.fk_relation_column_id = column.colOptions.fk_relation_column_id
    }
  }

  if (
    column.uidt === UITypes.Rollup &&
    column?.colOptions?.fk_relation_column_id &&
    column?.colOptions?.fk_rollup_column_id &&
    column?.colOptions?.rollup_function
  ) {
    if (!column?.fk_relation_column_id) {
      column.fk_relation_column_id = column.colOptions.fk_relation_column_id
    }
    if (!column?.fk_rollup_column_id) {
      column.fk_rollup_column_id = column.colOptions.fk_rollup_column_id
    }
    if (!column?.rollup_function) {
      column.rollup_function = column.colOptions.rollup_function
    }
  }

  if (column.uidt === UITypes.Formula && column.colOptions?.formula_raw && !column?.formula_raw) {
    column.formula_raw = column.colOptions?.formula_raw
  }

  if (column.uidt === UITypes.Button) {
    if (column?.id) {
      const colOptions = column.colOptions as ButtonType
      column.type = colOptions?.type
      column.theme = colOptions?.theme
      column.label = colOptions?.label
      column.color = colOptions?.color
      column.fk_webhook_id = colOptions?.fk_webhook_id
      column.icon = colOptions?.icon
      column.formula_raw = column.colOptions?.formula_raw

      if (column.type === ButtonActionsType.Ai) {
        column.output_column_ids = colOptions?.output_column_ids
        column.fk_integration_id = colOptions?.fk_integration_id
      }
    } else {
      column.type = column?.type || ButtonActionsType.Url

      if (column.type === ButtonActionsType.Ai) {
        column.theme = column.theme || 'text'
        column.label = column.label || 'Generate data'
        column.color = column.color || 'purple'
        column.icon = column.icon || 'ncAutoAwesome'
      } else {
        column.theme = column.theme || 'solid'
        column.label = column.label || 'Button'
        column.color = column.color || 'brand'
        column.fk_webhook_id = column?.fk_webhook_id || ''
      }

      column.formula_raw = column.formula_raw || ''
    }
  }

  if (column.uidt === UITypes.LongText && isAIPromptCol(column)) {
    if (column?.id) {
      const colOptions = column.colOptions as Record<string, any>

      column.prompt_raw = colOptions?.prompt_raw
    } else {
      column.prompt_raw = column.prompt_raw || ''
    }
  }

  return column
}

const recoverField = (state: TableExplorerColumn) => {
  const field = ops.value.find((op) => compareCols(op.column, state))
  if (field) {
    if (field.op === 'delete') {
      ops.value = ops.value.filter((op) => !compareCols(op.column, state))
    } else if (field.op === 'update') {
      ops.value = ops.value.filter((op) => !compareCols(op.column, state))
      moveOps.value = moveOps.value.filter((op) => !compareCols(op.column, state))
    }
    activeField.value = null
    changeField(fields.value.filter((fiel) => fiel.id === state.id)[0])
  }
}

const fieldState = (field: TableExplorerColumn) => {
  const col = fields.value.find((col) => compareCols(col, field))
  if (col) {
    const op = ops.value.find((op) => compareCols(op.column, col))
    if (op) {
      return op.column
    }
  }
  return null
}

const fieldStatuses = computed<Record<string, string>>(() => {
  const statuses: Record<string, string> = {}
  for (const op of ops.value) {
    if (op.op === 'add') {
      if (op.column.temp_id) statuses[op.column.temp_id] = 'add'
    } else if (op.op === 'update') {
      if (op.column.id) statuses[op.column.id] = 'update'
    } else if (op.op === 'delete') {
      if (op.column.id) statuses[op.column.id] = 'delete'
    }
  }
  return statuses
})

const fieldStatus = (field?: TableExplorerColumn) => {
  const id = field?.id || field?.temp_id
  return id ? fieldStatuses.value[id] : ''
}

const fieldErrors = computed<Record<string, string>>(() => {
  const errors: Record<string, string> = {}
  for (const op of ops.value) {
    if (op?.error) {
      const id = op.column.id || op.column.temp_id

      if (id) errors[id] = op.error
    }
  }
  return errors
})

const fieldError = (field?: TableExplorerColumn) => {
  const id = field?.id || field?.temp_id
  return id ? fieldErrors.value[id] : ''
}

const clearChanges = () => {
  ops.value = []
  moveOps.value = []
  newFields.value = []
  visibilityOps.value = []
  localPredictions.value = []
  showOrHideSystemFields.value = showSystemFields.value
  changeField()
  onInit()
}

const isColumnsValid = computed(() => fields.value.every((f) => isColumnValid(f)))

const metaToLocal = () => {
  localMetaColumns.value = meta.value?.columns?.map((c: ColumnType) => {
    if (c.uidt && c.uidt in columnDefaultMeta) {
      if (!c.meta) c.meta = {}
      c.meta = {
        ...columnDefaultMeta[c.uidt as keyof typeof columnDefaultMeta],
        ...((c.meta as object) || {}),
      }
    }
    return {
      ...c,
    }
  })
}

const saveChanges = async () => {
  if (!isColumnsValid.value) {
    message.error(t('msg.error.multiFieldSaveValidation'))
    return
  } else if (
    !loading.value &&
    ops.value.length < 1 &&
    moveOps.value.length < 1 &&
    visibilityOps.value.length < 1 &&
    showSystemFields.value === showOrHideSystemFields.value
  ) {
    return
  }
  try {
    if (!meta.value?.id) return

    loading.value = true
    const newFieldTitles: string[] = []
    for (const mop of moveOps.value) {
      const op = ops.value.find((op) => compareCols(op.column, mop.column))
      if (op && op.op === 'add') {
        if (!op.column?.userHasChangedTitle && !op.column.title) {
          const defaultColumnName = generateUniqueColumnName({
            formState: op.column,
            tableExplorerColumns: fields.value || [],
            metaColumns: meta.value?.columns || [],
            newFieldTitles,
          })
          newFieldTitles.push(defaultColumnName)

          op.column.title = defaultColumnName
          op.column.column_name = defaultColumnName
        }

        op.column.column_order = {
          order: mop.order,
          view_id: view.value?.id as string,
        }
      }

      if (op && op.op === 'update') {
        op.column.column_order = {
          order: mop.order,
          view_id: view.value?.id as string,
        }
      }

      if (op) {
        op.column.view_id = view.value?.id as string
      }
    }

    const deletedOrUpdatedColumnIds: Set<string> = new Set()

    for (const op of ops.value) {
      if (op.op === 'add') {
        if (activeField.value && compareCols(activeField.value, op.column)) {
          changeField()
        }
      } else if (op.op === 'delete') {
        deletedOrUpdatedColumnIds.add(op.column.id as string)

        if (activeField.value && compareCols(activeField.value, op.column)) {
          changeField()
        }
      } else if (op.op === 'update') {
        const originalColumn = meta.value?.columns?.find((c) => c.id === op.column.id) as ColumnType

        if (originalColumn?.uidt === UITypes.Attachment && originalColumn?.uidt !== op.column.uidt) {
          deletedOrUpdatedColumnIds.add(op.column.id as string)
        }
      }
    }

    for (const op of visibilityOps.value) {
      await toggleFieldVisibility(op.visible, {
        ...op.column,
        show: op.visible,
      })
    }

    ops.value = ops.value.map(({ error: _err, ...rest }) => {
      return rest
    })

    const res = await $api.dbTableColumn.bulk(meta.value?.id, {
      hash: columnsHash.value,
      ops: ops.value,
    })

    await loadViewColumns()

    if (res) {
      ops.value = res.failedOps && res.failedOps?.length ? res.failedOps : []
      newFields.value = newFields.value.filter((col) => {
        if (res.failedOps) {
          const op = res.failedOps.find((fop) => {
            return (fop.column as TableExplorerColumn).temp_id === col.temp_id
          })
          if (op) {
            return true
          }
        }
        return false
      })
      moveOps.value = []
    }

    for (const op of ops.value) {
      // remove column id from deletedColumnIds if operation was failed
      if (deletedOrUpdatedColumnIds.has(op.column.id as string) && (op.op === 'delete' || op.op === 'update')) {
        deletedOrUpdatedColumnIds.delete(op.column.id as string)
      }
    }

    await getMeta(meta.value.id, true)

    metaToLocal()
    onInit()

    // Update views if column is used as cover image
    viewsStore.updateViewCoverImageColumnId({ metaId: meta.value.id as string, columnIds: deletedOrUpdatedColumnIds })

    columnsHash.value = (await $api.dbTableColumn.hash(meta.value?.id)).hash

    showSystemFields.value = showOrHideSystemFields.value
    visibilityOps.value = []
  } catch (e) {
    message.error(t('msg.error.somethingWentWrong'))
  } finally {
    loading.value = false
  }
}

const toggleVisibility = async (checked: boolean, field: Field) => {
  if (field.fk_column_id && fieldStatuses.value[field.fk_column_id]) {
    message.warning(t('msg.warning.multiField.fieldVisibility'))
    return
  }

  const visibilityOpIndex = visibilityOps.value.findIndex((op) => op.column.fk_column_id === field.fk_column_id)

  if (visibilityOpIndex !== -1) {
    if (field.show === checked) {
      visibilityOps.value = visibilityOps.value.filter((op) => op.column.fk_column_id !== field.fk_column_id)
    } else {
      visibilityOps.value[visibilityOpIndex]!.visible = checked
    }
    return
  }

  visibilityOps.value.push({
    visible: checked,
    column: field,
  })
}

const showOrHideAllFields = (isAllFieldsVisible = false) => {
  fields.value.forEach((f) => toggleVisibility(!isAllFieldsVisible, viewFieldsMap.value[f.id]))
}

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

  if (isLocked.value) return

  if (cmdOrCtrl && e.key.toLowerCase() === 's') {
    if (openedViewsTab.value !== 'field') return
    e.preventDefault()

    return
  }

  // For Windows and mac
  if ((e.altKey && e.key.toLowerCase() === 'c') || (e.altKey && e.code === 'KeyC')) {
    if (openedViewsTab.value !== 'field') return
    e.preventDefault()

    addField()
  }
})

onKeyDown('ArrowDown', () => {
  const index = fields.value.findIndex((f) => compareCols(f, activeField.value))
  if (index === -1) changeField(fields.value[0])
  else if (index === fields.value.length - 1) changeField(fields.value[0])
  else changeField(fields.value[index + 1])
})
onKeyDown('ArrowUp', () => {
  const index = fields.value.findIndex((f) => compareCols(f, activeField.value))
  if (index === -1) changeField(fields.value[0])
  else if (index === 0) changeField(fields.value[fields.value.length - 1])
  else changeField(fields.value[index - 1])
})

onKeyDown('Delete', () => {
  if (isLocked.value || activeField.value?.pv) return

  if (isActiveInputElementExist()) {
    return
  }

  const isDeletedField = fieldStatus(activeField.value) === 'delete'
  if (!isDeletedField && activeField.value) {
    onFieldDelete(activeField.value)
  }
})

onKeyDown('Backspace', () => {
  if (isLocked.value || activeField.value?.pv) return

  if (isActiveInputElementExist()) {
    return
  }

  const isDeletedField = fieldStatus(activeField.value) === 'delete'
  if (!isDeletedField && activeField.value) {
    onFieldDelete(activeField.value)
  }
})

onKeyDown('ArrowRight', () => {
  if (document.activeElement?.tagName === 'TEXTAREA') return
  if (activeField.value) {
    const input = document.querySelector('.nc-fields-input') as HTMLInputElement
    if (input) {
      input.focus()
    }
  }
})

const keys = useMagicKeys()

whenever(keys.meta_s, () => {
  if (isLocked.value) return

  if (!meta.value?.id) return
  if (openedViewsTab.value === 'field') saveChanges()
})

whenever(keys.ctrl_s, () => {
  if (isLocked.value) return

  if (!meta.value?.id) return
  if (openedViewsTab.value === 'field') saveChanges()
})

watch(
  meta,
  async (newMeta) => {
    if (newMeta?.id) {
      columnsHash.value = (await $api.dbTableColumn.hash(newMeta.id)).hash
    }
  },
  { deep: true },
)

onMounted(async () => {
  await until(() => !!(meta.value?.id && meta.value?.columns)).toBeTruthy()

  if (meta.value && meta.value.id) {
    columnsHash.value = (await $api.dbTableColumn.hash(meta.value.id)).hash
  }

  metaToLocal()
})

watch(
  () => activeField.value?.temp_id,
  (_newValue, oldValue) => {
    if (!oldValue) return

    const oldField = fields.value.find((field) => field.temp_id === oldValue)
    if (
      !oldField ||
      (oldField &&
        (oldField.title ||
          !ops.value.find((op) => op.op === 'add' && op.column.temp_id === oldField.temp_id) ||
          oldField?.userHasChangedTitle ||
          !isColumnValid(oldField)))
    ) {
      return
    }

    const newFieldTitles = ops.value
      .filter((op) => op.op === 'add' && op.column.title)
      .map((op) => op.column.title)
      .filter((t) => t) as string[]

    const defaultColumnName = generateUniqueColumnName({
      formState: oldField,
      tableExplorerColumns: fields.value || [],
      metaColumns: localMetaColumns.value || [],
      newFieldTitles,
    })

    oldField.title = defaultColumnName
    oldField.column_name = defaultColumnName
  },
)

const onAiFieldAdd = (field: PredictedFieldType) => {
  if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(field.type)) {
    if (field.options) {
      const options: {
        title: string
        index: number
        color?: string
      }[] = []
      for (const option of field.options) {
        // skip if option already exists
        if (options.find((el) => el.title === option)) continue

        options.push({
          title: option,
          index: options.length,
          color: enumColor.light[options.length % enumColor.light.length],
        })
      }

      field.colOptions = {
        options,
      }
    }
  }

  onFieldAdd(
    updateDefaultColumnValues({
      title: field.title,
      uidt:
        fieldPredictionMode.value === 'formula'
          ? UITypes.Formula
          : fieldPredictionMode.value === 'button'
          ? UITypes.Button
          : field.type,
      column_name: field.title.toLowerCase().replace(/\\W/g, '_'),
      ...(field.formula ? { formula_raw: field.formula } : {}),
      ...(field.colOptions ? { colOptions: field.colOptions } : {}),
      meta: {
        ...(field.type in columnDefaultMeta ? columnDefaultMeta[field.type as keyof typeof columnDefaultMeta] : {}),
      },
      ...(fieldPredictionMode.value === 'button'
        ? {
            type: ButtonActionsType.Ai,
            output_column_ids: field.output_column_ids,
            formula_raw: field.formula_raw,
          }
        : {}),
      is_ai_field: true,
      ai_temp_id: field.ai_temp_id,
    }),
  )
}

const onToggleTag = (field: PredictedFieldType) => {
  if (loading.value) return

  const onAdd = _onToggleTag(field)
  if (onAdd) {
    onAiFieldAdd(field)

    setTimeout(() => {
      if (fieldsListWrapperDomRef.value) {
        fieldsListWrapperDomRef.value.scrollTop = fieldsListWrapperDomRef.value.scrollHeight
      }
    }, 100)
  }
}

const handleNavigateToIntegrations = () => {
  workspaceStore.navigateToIntegrations(undefined, undefined, {
    categories: 'ai',
  })
}

const toggleAiMode = (...args: any[]) => {
  _toggleAiMode(...args)

  changingField.value = true

  nextTick(() => {
    changingField.value = false
  })
}

const disableAiMode = () => {
  _disableAiMode()

  changingField.value = true

  nextTick(() => {
    changingField.value = false
  })
}

const aiPromptInputRef = ref<HTMLElement>()

watch(activeAiTab, (newValue) => {
  if (newValue === AiWizardTabsType.PROMPT) {
    nextTick(() => {
      aiPromptInputRef.value?.focus()
    })
  }
})

const rightPanelRef = ref()

const oldRightPanelWidth = ref()

const { width: _rightPanelWidth } = useElementBounding(rightPanelRef)

/**
 * Tracks and computes the stable width of the right panel, accounting for transition effects.
 *
 * @remarks
 * - `_rightPanelWidth` reflects the current width of the right panel reported by `useElementBounding`.
 * - `oldRightPanelWidth` stores the last valid width to avoid using transitional `0` width values.
 * - During transitions, `_rightPanelWidth` may initially be `0`, so `oldRightPanelWidth` ensures a consistent and reliable width value.
 *
 * @returns The stable width of the right panel.
 */

const rightPanelWidth = computed(() => {
  if (_rightPanelWidth.value && _rightPanelWidth.value !== oldRightPanelWidth.value) {
    oldRightPanelWidth.value = _rightPanelWidth.value
  }

  return oldRightPanelWidth.value
})
</script>

<template>
  <div class="nc-fields-wrapper w-full p-4">
    <div class="max-w-250 h-full w-full mx-auto flex flex-col gap-6">
      <div v-if="isViewColumnsLoading" class="flex flex-row justify-between mt-2">
        <a-skeleton-input class="!h-8 !w-68 !rounded !overflow-hidden" active size="small" />
        <div class="flex flex-row gap-x-4">
          <a-skeleton-input class="!h-8 !w-22 !rounded !overflow-hidden" active size="small" />
          <a-skeleton-input class="!h-8 !w-22 !rounded !overflow-hidden" active size="small" />
          <a-skeleton-input class="!h-8 !w-22 !rounded !overflow-hidden" active size="small" />
        </div>
      </div>
      <template v-else>
        <div class="flex w-full justify-between pt-2">
          <div class="flex gap-2">
            <a-input
              v-model:value="searchQuery"
              data-testid="nc-field-search-input"
              class="!h-8 !px-1 !rounded-lg !w-72"
              :placeholder="$t('placeholder.searchFields')"
            >
              <template #prefix>
                <GeneralIcon icon="search" class="mx-1 h-3.5 w-3.5 text-gray-500 group-hover:text-black" />
              </template>
              <template #suffix>
                <GeneralIcon
                  v-if="searchQuery.length > 0"
                  icon="close"
                  class="mx-1 h-3.5 w-3.5 text-gray-500 group-hover:text-black"
                  data-testid="nc-field-clear-search"
                  @click="searchQuery = ''"
                />
              </template>
            </a-input>
            <NcDropdown :trigger="['hover']" placement="bottomRight">
              <NcButton size="small" type="secondary" icon-only :shadow="false">
                <template #icon>
                  <GeneralIcon icon="threeDotVertical" class="text-xs !text-current w-4 h-4" />
                </template>
              </NcButton>
              <template #overlay>
                <NcMenu variant="small">
                  <NcMenuItem class="!children:w-full" @click="showOrHideAllFields(isAllFieldsVisible)">
                    {{ isAllFieldsVisible ? $t('general.hideAll') : $t('general.showAll') }}
                    {{ $t('objects.fields').toLowerCase() }}
                  </NcMenuItem>
                  <NcMenuItem class="!children:w-full" @click="showOrHideSystemFields = !showOrHideSystemFields">
                    {{ showOrHideSystemFields ? $t('title.hideSystemFields') : $t('activity.showSystemFields') }}
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
          <div class="flex gap-2">
            <template v-if="isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)">
              <div class="nc-fields-add-new-field-btn-wrapper rounded-lg shadow-nc-sm">
                <NcTooltip :disabled="isLocked">
                  <template #title> {{ `${renderAltOrOptlKey()} + C` }} </template>
                  <NcButton
                    data-testid="nc-field-add-new"
                    type="secondary"
                    size="small"
                    class="nc-field-add-new !rounded-r-none !border-r-transparent"
                    :disabled="loading || isLocked"
                    :shadow="false"
                    @click="addField()"
                  >
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="plus" class="w-3" />
                      {{ $t('labels.multiField.newField') }}
                    </div>
                  </NcButton>
                </NcTooltip>
                <NcTooltip :title="aiMode ? 'Disable AI suggestions' : 'Suggest fields using AI'">
                  <NcDropdown :trigger="['hover']" placement="bottomRight" overlay-class-name="!border-purple-200">
                    <NcButton
                      size="small"
                      :type="aiMode ? 'primary' : 'secondary'"
                      theme="ai"
                      class="nc-field-ai-toggle-btn"
                      :class="{
                        '!pointer-events-none !cursor-not-allowed': aiLoading,
                        'nc-ai-mode': aiMode,
                      }"
                      icon-only
                      :shadow="false"
                      @click.stop="aiMode ? disableAiMode() : toggleAiMode()"
                    >
                      <template #icon>
                        <GeneralIcon icon="ncAutoAwesome" class="text-xs !text-current w-4 h-4" />
                      </template>
                    </NcButton>
                    <template #overlay>
                      <NcMenu variant="medium">
                        <NcMenuItem class="!children:w-full !text-nc-content-purple-dark" @click="toggleAiMode()">
                          <component :is="getUIDTIcon(UITypes.SingleLineText)" class="flex-none w-3.5 h-3.5" />
                          {{ $t('labels.autoSuggestFields') }}
                        </NcMenuItem>
                        <NcMenuItem
                          v-show="!isForm"
                          class="!children:w-full !text-nc-content-purple-dark"
                          @click="toggleAiMode('formula')"
                        >
                          <component :is="getUIDTIcon(UITypes.Formula)" class="flex-none w-3.5 h-3.5" />
                          {{ $t('labels.autoSuggestFormulas') }}
                        </NcMenuItem>
                        <NcMenuItem
                          v-show="!isForm"
                          class="!children:w-full !text-nc-content-purple-dark"
                          @click="toggleAiMode('button')"
                        >
                          <component :is="getUIDTIcon(UITypes.Button)" class="flex-none w-3.5 h-3.5" />
                          Auto suggest actions
                        </NcMenuItem>
                      </NcMenu>
                    </template>
                  </NcDropdown>
                </NcTooltip>
              </div>
            </template>
            <template v-else>
              <div class="nc-fields-add-new-field-btn-wrapper shadow-sm">
                <NcTooltip :disabled="isLocked">
                  <template #title> {{ `${renderAltOrOptlKey()} + C` }} </template>
                  <NcButton
                    data-testid="nc-field-add-new"
                    type="secondary"
                    size="small"
                    class="nc-field-add-new"
                    :disabled="loading || isLocked"
                    :shadow="false"
                    @click="addField()"
                  >
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="plus" class="w-3" />
                      {{ $t('labels.multiField.newField') }}
                    </div>
                  </NcButton>
                </NcTooltip>
              </div>
            </template>
            <NcButton
              data-testid="nc-field-reset"
              type="secondary"
              size="small"
              :disabled="
                (!loading &&
                  ops.length < 1 &&
                  moveOps.length < 1 &&
                  visibilityOps.length < 1 &&
                  showOrHideSystemFields === showSystemFields) ||
                isLocked
              "
              @click="clearChanges()"
            >
              {{ $t('general.reset') }}
            </NcButton>
            <NcTooltip :disabled="isLocked">
              <template #title> {{ `${renderCmdOrCtrlKey()} + S` }}</template>

              <NcButton
                data-testid="nc-field-save-changes"
                type="primary"
                size="small"
                :loading="loading"
                :disabled="
                  (isColumnsValid
                    ? !loading &&
                      showOrHideSystemFields === showSystemFields &&
                      ops.length < 1 &&
                      moveOps.length < 1 &&
                      visibilityOps.length < 1
                    : true) || isLocked
                "
                @click="saveChanges()"
              >
                {{ $t('labels.multiField.saveChanges') }}
              </NcButton>
            </NcTooltip>
          </div>
        </div>
        <!-- Ai field wizard  -->
        <div
          class="flex flex-row rounded-lg border-1 overflow-clip border-gray-200"
          :style="{
            height: `calc(100vh - (var(--topbar-height) * 3.6) - 24px)`,
          }"
        >
          <div
            class="flex-1 h-full flex flex-col"
            :style="{
              width: rightPanelWidth ? `calc(100% - ${rightPanelWidth}px)` : undefined,
            }"
          >
            <div v-if="aiMode" class="pt-3 bg-nc-bg-gray-extralight border-b-1 border-b-nc-border-gray-medium overflow-x-scroll">
              <!-- Ai field wizard  -->
              <AiWizardTabs v-model:active-tab="activeAiTab" show-close-btn @close="disableAiMode()">
                <template #AutoSuggestedContent>
                  <div class="px-5 pt-4 pb-5">
                    <div v-if="!aiIntegrationAvailable" class="flex items-center">
                      <div class="flex-1 flex items-center gap-3">
                        <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
                        <div class="text-sm text-nc-content-gray-subtle flex-1">{{ $t('title.noAiIntegrationAvailable') }}</div>
                      </div>
                      <NcButton type="text" size="small" @click.stop="handleNavigateToIntegrations">
                        <template #icon>
                          <GeneralIcon icon="plus" class="h-4 w-4" />
                        </template>
                        Add Integration
                      </NcButton>
                    </div>
                    <div v-else-if="aiError" class="w-full flex items-center gap-3">
                      <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-4 h-4" />

                      <NcTooltip class="truncate flex-1 text-sm text-nc-content-gray-subtle" show-on-truncate-only>
                        <template #title>
                          {{ aiError }}
                        </template>
                        {{ aiError }}
                      </NcTooltip>

                      <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="handleRefreshOnError">
                        {{ $t('general.refresh') }}
                      </NcButton>
                    </div>

                    <div v-else-if="aiModeStep === 'init'">
                      <div class="text-nc-content-purple-light text-sm h-7 flex items-center gap-2">
                        <GeneralLoader size="regular" class="!text-nc-content-purple-dark" />

                        <div class="nc-animate-dots">
                          Auto suggesting {{ isFormulaPredictionMode ? 'formula' : '' }} fields for {{ meta?.title }}
                        </div>
                      </div>
                    </div>
                    <div v-else-if="aiModeStep === 'pick'" class="flex gap-3 items-start">
                      <div class="flex-1 flex gap-2 flex-wrap">
                        <template v-if="activeTabNonSelectedFields.length">
                          <template v-for="f of activeTabNonSelectedFields" :key="f.title">
                            <NcTooltip :disabled="activeTabSelectedFields.length < maxSelectionCount || f.selected">
                              <template #title>
                                <div class="w-[150px]">
                                  You can only select {{ maxSelectionCount }} fields to create at a time.
                                </div>
                              </template>

                              <a-tag
                                class="nc-ai-suggested-tag"
                                :class="{
                                  'nc-disabled': loading || (!f.selected && activeTabSelectedFields.length >= maxSelectionCount),
                                  'nc-selected': f.selected,
                                }"
                                :disabled="activeTabSelectedFields.length >= maxSelectionCount"
                                @click="onToggleTag(f)"
                              >
                                <div class="flex flex-row items-center gap-1.5 py-[3px] text-small leading-[18px]">
                                  <component
                                    :is="getUIDTIcon(isFormulaPredictionMode ? UITypes.Formula : f.type)"
                                    v-if="isFormulaPredictionMode || f?.type"
                                    class="flex-none w-3.5 h-3.5"
                                    :class="{
                                      'opacity-60':
                                        loading || (!f.selected && activeTabSelectedFields.length >= maxSelectionCount),
                                    }"
                                  />

                                  <div>{{ f.title }}</div>
                                </div>
                              </a-tag>
                            </NcTooltip>
                          </template>
                        </template>
                        <div v-else-if="activeTabSelectedFields.length" class="text-nc-content-purple-light">
                          To generate more {{ isFormulaPredictionMode ? 'formula' : '' }} field suggestions, click the + or ⟳ icon
                          on the right
                        </div>
                        <div v-else class="text-nc-content-gray-subtle2">{{ $t('labels.noData') }}</div>
                      </div>
                      <div class="flex items-center gap-1">
                        <NcTooltip
                          v-if="
                            activeTabPredictHistory.length < activeTabSelectedFields.length
                              ? activeTabPredictHistory.length + activeTabSelectedFields.length < 10
                              : activeTabPredictHistory.length < 10
                          "
                          title="Suggest more"
                          placement="top"
                        >
                          <NcButton
                            size="xs"
                            class="!px-1"
                            type="text"
                            theme="ai"
                            :loading="aiLoading && calledFunction === 'predictMore'"
                            :disabled="loading"
                            icon-only
                            @click="predictMore"
                          >
                            <template #icon>
                              <GeneralIcon icon="ncPlusAi" class="!text-current" />
                            </template>
                          </NcButton>
                        </NcTooltip>
                        <NcTooltip title="Re-suggest" placement="top">
                          <NcButton
                            size="xs"
                            class="!px-1"
                            type="text"
                            theme="ai"
                            :disabled="loading"
                            :loading="aiLoading && calledFunction === 'predictRefresh'"
                            @click="predictRefresh"
                          >
                            <template #loadingIcon>
                              <!-- eslint-disable vue/no-lone-template -->
                              <template></template>
                            </template>
                            <GeneralIcon
                              icon="refresh"
                              class="!text-current"
                              :class="{
                                'animate-infinite animate-spin': aiLoading && calledFunction === 'predictRefresh',
                              }"
                            />
                          </NcButton>
                        </NcTooltip>
                      </div>
                    </div>
                  </div>
                </template>
                <template #PromptContent>
                  <div class="px-5 pt-4 pb-5 flex flex-col gap-4">
                    <div v-if="!aiIntegrationAvailable" class="flex items-center">
                      <div class="flex-1 flex items-center gap-3">
                        <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
                        <div class="text-sm text-nc-content-gray-subtle flex-1">{{ $t('title.noAiIntegrationAvailable') }}</div>
                      </div>
                      <NcButton type="text" size="small" @click.stop="handleNavigateToIntegrations">
                        <template #icon>
                          <GeneralIcon icon="plus" class="h-4 w-4" />
                        </template>
                        Add Integration
                      </NcButton>
                    </div>
                    <template v-else>
                      <div class="relative">
                        <a-textarea
                          ref="aiPromptInputRef"
                          v-model:value="prompt"
                          :disabled="loading"
                          placeholder="Enter your prompt to get field suggestions.."
                          class="nc-ai-input nc-input-shadow !px-3 !pt-2 !pb-3 !text-sm !min-h-[68px] !rounded-lg"
                          @keydown.enter.stop
                        >
                        </a-textarea>

                        <NcButton
                          size="xs"
                          type="primary"
                          theme="ai"
                          class="!px-1 !absolute bottom-2 right-2"
                          :disabled="
                            !prompt.trim() ||
                            isPredictFromPromptLoading ||
                            (!!prompt.trim() && prompt.trim() === oldPrompt.trim()) ||
                            loading
                          "
                          :loading="isPredictFromPromptLoading"
                          icon-only
                          @click="predictFromPrompt"
                        >
                          <template #loadingIcon>
                            <GeneralLoader class="!text-purple-700" size="medium" />
                          </template>
                          <template #icon>
                            <GeneralIcon icon="send" class="flex-none h-4 w-4" />
                          </template>
                        </NcButton>
                      </div>

                      <div v-if="aiError" class="w-full flex items-center gap-3">
                        <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-4 h-4" />

                        <NcTooltip class="truncate flex-1 text-sm text-nc-content-gray-subtle" show-on-truncate-only>
                          <template #title>
                            {{ aiError }}
                          </template>
                          {{ aiError }}
                        </NcTooltip>

                        <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="handleRefreshOnError">
                          {{ $t('general.refresh') }}
                        </NcButton>
                      </div>

                      <div v-else-if="isPromtAlreadyGenerated" class="flex flex-col gap-3">
                        <div class="text-nc-content-purple-dark font-semibold text-xs">Generated Field(s)</div>
                        <div class="flex gap-2 flex-wrap">
                          <template v-if="activeTabNonSelectedFields.length">
                            <template v-for="f of activeTabNonSelectedFields" :key="f.title">
                              <NcTooltip :disabled="activeTabSelectedFields.length < maxSelectionCount || f.selected">
                                <template #title>
                                  <div class="w-[150px]">
                                    You can only select {{ maxSelectionCount }} fields to create at a time.
                                  </div>
                                </template>

                                <a-tag
                                  class="nc-ai-suggested-tag"
                                  :class="{
                                    'nc-disabled':
                                      loading || (!f.selected && activeTabSelectedFields.length >= maxSelectionCount),
                                    'nc-selected': f.selected,
                                  }"
                                  :disabled="activeTabSelectedFields.length >= maxSelectionCount"
                                  @click="onToggleTag(f)"
                                >
                                  <div class="flex flex-row items-center gap-1.5 py-[3px] text-small leading-[18px]">
                                    <component
                                      :is="getUIDTIcon(isFormulaPredictionMode ? UITypes.Formula : f.type)"
                                      v-if="isFormulaPredictionMode || f?.type"
                                      class="flex-none w-3.5 h-3.5"
                                      :class="{
                                        'opacity-60':
                                          loading || (!f.selected && activeTabSelectedFields.length >= maxSelectionCount),
                                      }"
                                    />

                                    <div>{{ f.title }}</div>
                                  </div>
                                </a-tag>
                              </NcTooltip>
                            </template>
                          </template>
                          <div v-else-if="activeTabSelectedFields.length" class="text-nc-content-purple-light">
                            No suggestions remaining. To generate more fields, prompt again...
                          </div>
                          <div v-else class="text-nc-content-gray-subtle2">{{ $t('labels.noData') }}</div>
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
              </AiWizardTabs>
            </div>
            <div ref="fieldsListWrapperDomRef" class="flex-1 flex-grow-1 nc-scrollbar-md !overflow-auto">
              <Draggable
                :model-value="fields"
                :disabled="isLocked"
                item-key="id"
                data-testid="nc-field-list-wrapper"
                @change="onMove($event)"
              >
                <template #item="{ element: field }">
                  <div
                    v-if="field.title.toLowerCase().includes(searchQuery.toLowerCase()) && !field.pv"
                    class="flex px-2 border-b-1 border-gray-200 pl-5 group"
                    :class="{
                      'selected': compareCols(field, activeField),
                      'cursor-not-allowed': !isColumnUpdateAllowed(field),
                      'hover:bg-gray-100': !isSystemColumn(field),
                    }"
                    :data-testid="`nc-field-item-${fieldState(field)?.title || field.title}`"
                    @click="changeField(field, $event)"
                  >
                    <div class="flex items-center flex-1 py-2.5 gap-1 w-2/6">
                      <component
                        :is="iconMap.drag"
                        class="cursor-move !h-3.75 text-gray-600 mr-1"
                        :class="{
                          'opacity-0 !cursor-default': isLocked,
                        }"
                      />
                      <NcCheckbox
                        v-if="field.id && viewFieldsMap[field.id]"
                        :disabled="isLocked"
                        :checked="
                          !!(
                            visibilityOps.find((op) => op.column.fk_column_id === field.id)?.visible ??
                            viewFieldsMap[field.id].show
                          )
                        "
                        data-testid="nc-field-visibility-checkbox"
                        @change="
                        (event: any) => {
                          toggleVisibility(event.target.checked, viewFieldsMap[field.id])
                        }
                      "
                      />
                      <NcCheckbox v-else :disabled="true" class="opacity-0" :checked="true" />
                      <SmartsheetHeaderVirtualCellIcon
                        v-if="field && isVirtualCol(fieldState(field) || field)"
                        :column-meta="fieldState(field) || field"
                        :class="{
                          'text-brand-500': compareCols(field, activeField),
                        }"
                      />
                      <SmartsheetHeaderCellIcon
                        v-else
                        :column-meta="fieldState(field) || field"
                        :class="{
                          'text-brand-500': compareCols(field, activeField),
                        }"
                      />
                      <NcTooltip
                        :class="{
                          'text-brand-500': compareCols(field, activeField),
                        }"
                        class="truncate flex-1"
                        show-on-truncate-only
                      >
                        <template #title> {{ fieldState(field)?.title || field.title }} </template>
                        <span data-testid="nc-field-title">
                          {{ fieldState(field)?.title || field.title }}
                        </span>
                      </NcTooltip>
                    </div>
                    <div class="flex items-center justify-end gap-1">
                      <div class="nc-field-status-wrapper flex items-center">
                        <NcBadge
                          v-if="fieldStatus(field) === 'delete'"
                          color="red"
                          :border="false"
                          class="bg-red-50 text-red-700 text-small leading-[18px]"
                          data-testid="nc-field-status-deleted-field"
                        >
                          {{ $t('labels.multiField.deletedField') }}
                        </NcBadge>
                        <NcBadge
                          v-else-if="isColumnValid(field) && fieldStatus(field) === 'add'"
                          :color="field?.is_ai_field ? 'purple' : 'green'"
                          :border="!!field?.is_ai_field"
                          class="text-small leading-[18px]"
                          :class="{
                            '!bg-purple-50 text-purple-700 !border-purple-100': field?.is_ai_field,
                            'bg-green-50 text-green-700': !field?.is_ai_field,
                          }"
                          data-testid="nc-field-status-new-field"
                        >
                          <GeneralIcon v-if="field?.is_ai_field" icon="ncAutoAwesome" class="mr-1 h-4 w-4" />
                          {{ $t('labels.multiField.newField') }}
                        </NcBadge>

                        <NcBadge
                          v-else-if="fieldStatus(field) === 'update'"
                          color="orange"
                          :border="false"
                          class="bg-orange-50 text-orange-700 text-small leading-[18px]"
                          data-testid="nc-field-status-updated-field"
                        >
                          {{ $t('labels.multiField.updatedField') }}
                        </NcBadge>
                        <NcBadge
                          v-if="!isColumnValid(field)"
                          color="yellow"
                          :border="false"
                          class="ml-1 bg-yellow-50 text-yellow-700 text-small leading-[18px]"
                          data-testid="nc-field-status-incomplete-configuration"
                        >
                          {{ $t('labels.multiField.incompleteConfiguration') }}
                        </NcBadge>
                        <NcTooltip v-if="!!fieldError(field)" class="cursor-pointer">
                          <template #title>
                            {{ fieldError(field) }}
                          </template>

                          <NcBadge
                            color="red"
                            :border="false"
                            class="ml-1 bg-red-50 text-red-700 text-small leading-[18px]"
                            data-testid="nc-field-status-error-configuration"
                          >
                            <GeneralIcon icon="info" class="!text-current" />
                          </NcBadge>
                        </NcTooltip>
                      </div>
                      <NcButton
                        v-if="fieldStatus(field) === 'delete' || fieldStatus(field) === 'update'"
                        type="secondary"
                        size="small"
                        class="no-action mr-2"
                        :disabled="loading"
                        data-testid="nc-field-restore-changes"
                        @click="recoverField(field)"
                      >
                        <div class="flex items-center text-xs gap-1">
                          <GeneralIcon icon="reload" />
                          {{ $t('general.restore') }}
                        </div>
                      </NcButton>
                      <NcDropdown
                        v-else
                        :trigger="['click']"
                        overlay-class-name="nc-field-item-action-dropdown nc-dropdown-table-explorer"
                        @update:visible="onFieldOptionUpdate"
                        @click.stop
                      >
                        <NcButton
                          size="xsmall"
                          type="text"
                          class="!opacity-0 !group-hover:(opacity-100)"
                          :class="{
                            '!hover:(text-brand-700 bg-brand-100) !group-hover:(text-brand-500)': compareCols(field, activeField),
                            '!hover:(text-gray-700 bg-gray-200) !group-hover:(text-gray-500)': !compareCols(field, activeField),
                          }"
                          data-testid="nc-field-item-action-button"
                        >
                          <GeneralIcon icon="threeDotVertical" class="no-action text-inherit" />
                        </NcButton>

                        <template #overlay>
                          <NcMenu variant="small" class="!mt-1 !min-w-55">
                            <template v-if="fieldStatus(field) !== 'add'">
                              <NcMenuItemCopyId
                                :id="field.id"
                                data-testid="nc-field-item-action-copy-id"
                                :tooltip="$t('msg.clickToCopyFieldId')"
                                :label="
                                  $t('labels.idColon', {
                                    id: field.id,
                                  })
                                "
                              />
                              <NcDivider v-if="!isLocked" />
                            </template>

                            <template v-if="!isLocked">
                              <NcMenuItem
                                key="table-explorer-duplicate"
                                data-testid="nc-field-item-action-duplicate"
                                :disabled="isSystemColumn(field)"
                                @click="duplicateField(field)"
                              >
                                <GeneralIcon icon="duplicate" />
                                <span> {{ $t('general.duplicate') }} {{ $t('objects.field').toLowerCase() }} </span>
                              </NcMenuItem>
                              <NcMenuItem
                                v-if="!field.pv"
                                key="table-explorer-insert-above"
                                data-testid="nc-field-item-action-insert-above"
                                @click="addField(field, true)"
                              >
                                <GeneralIcon icon="ncArrowUp" />
                                <span>{{ $t('general.insertAbove') }}</span>
                              </NcMenuItem>
                              <NcMenuItem
                                key="table-explorer-insert-below"
                                data-testid="nc-field-item-action-insert-below"
                                @click="addField(field)"
                              >
                                <GeneralIcon icon="ncArrowDown" />
                                <span>{{ $t('general.insertBelow') }}</span>
                              </NcMenuItem>

                              <NcDivider />

                              <NcMenuItem
                                key="table-explorer-delete"
                                data-testid="nc-field-item-action-delete"
                                :disabled="isSystemColumn(field)"
                                @click="onFieldDelete(field)"
                              >
                                <div
                                  class="text-red-500"
                                  :class="{
                                    '!text-gray-400': isSystemColumn(field),
                                  }"
                                >
                                  <GeneralIcon icon="delete" class="group-hover:text-accent -ml-0.25 -mt-0.75 mr-0.5" />
                                  {{ $t('general.delete') }} {{ $t('objects.field').toLowerCase() }}
                                </div>
                              </NcMenuItem>
                            </template>
                          </NcMenu>
                        </template>
                      </NcDropdown>
                      <MdiChevronRight
                        class="text-brand-500 opacity-0"
                        :class="{
                          'opacity-100': compareCols(field, activeField),
                        }"
                      />
                    </div>
                  </div>
                </template>
                <template
                  v-if="
                    displayColumn && displayColumn.title && displayColumn.title.toLowerCase().includes(searchQuery.toLowerCase())
                  "
                  #header
                >
                  <div
                    class="flex px-2 bg-white hover:bg-gray-100 border-b-1 border-gray-200 first:rounded-tl-lg last:border-b-1 pl-5 group"
                    :class="` ${compareCols(displayColumn, activeField) ? 'selected' : ''}`"
                    :data-testid="`nc-field-item-${fieldState(displayColumn)?.title || displayColumn.title}`"
                    @click="changeField(displayColumn, $event)"
                  >
                    <div class="flex items-center flex-1 py-2.5 gap-1 w-2/6">
                      <component
                        :is="iconMap.drag"
                        class="cursor-move !h-3.75 text-gray-200 mr-1"
                        :class="{
                          'opacity-0 !cursor-default': isLocked,
                        }"
                      />
                      <NcCheckbox :disabled="true" :checked="true" data-testid="nc-field-visibility-checkbox" />
                      <SmartsheetHeaderCellIcon
                        v-if="displayColumn"
                        :column-meta="fieldState(displayColumn) || displayColumn"
                        :class="{
                          'text-brand-500': compareCols(displayColumn, activeField),
                        }"
                      />
                      <NcTooltip
                        class="truncate flex-1"
                        :class="{
                          'text-brand-500': compareCols(displayColumn, activeField),
                        }"
                        show-on-truncate-only
                      >
                        <template #title> {{ fieldState(displayColumn)?.title || displayColumn.title }} </template>
                        <span data-testid="nc-field-title">
                          {{ fieldState(displayColumn)?.title || displayColumn.title }}
                        </span>
                      </NcTooltip>
                    </div>
                    <div class="flex items-center justify-end gap-1">
                      <div class="flex items-center">
                        <NcBadge
                          v-if="fieldStatus(displayColumn) === 'delete'"
                          color="red"
                          :border="false"
                          class="bg-red-50 text-red-700 text-small leading-[18px]"
                          data-testid="nc-field-status-deleted-field"
                        >
                          {{ $t('labels.multiField.deletedField') }}
                        </NcBadge>

                        <NcBadge
                          v-else-if="fieldStatus(displayColumn) === 'update'"
                          color="orange"
                          :border="false"
                          class="bg-orange-50 text-orange-700 text-small leading-[18px]"
                          data-testid="nc-field-status-updated-field"
                        >
                          {{ $t('labels.multiField.updatedField') }}
                        </NcBadge>
                      </div>
                      <NcButton
                        v-if="fieldStatus(displayColumn) === 'delete' || fieldStatus(displayColumn) === 'update'"
                        type="secondary"
                        size="small"
                        class="no-action mr-2"
                        :disabled="loading"
                        data-testid="nc-field-restore-changes"
                        @click="recoverField(displayColumn)"
                      >
                        <div class="flex items-center text-xs gap-1">
                          <GeneralIcon icon="reload" />
                          {{ $t('general.restore') }}
                        </div>
                      </NcButton>
                      <NcDropdown
                        v-else
                        :trigger="['click']"
                        overlay-class-name="nc-field-item-action-dropdown-display-column nc-dropdown-table-explorer-display-column"
                        @update:visible="onFieldOptionUpdate"
                        @click.stop
                      >
                        <NcButton
                          size="xsmall"
                          type="text"
                          class="!opacity-0 !group-hover:(opacity-100)"
                          :class="{
                            '!hover:(text-brand-700 bg-brand-100) !group-hover:(text-brand-500)': compareCols(
                              displayColumn,
                              activeField,
                            ),
                            '!hover:(text-gray-700 bg-gray-200) !group-hover:(text-gray-500)': !compareCols(
                              displayColumn,
                              activeField,
                            ),
                          }"
                          data-testid="nc-field-item-action-button"
                        >
                          <GeneralIcon icon="threeDotVertical" class="no-action text-inherit" />
                        </NcButton>

                        <template #overlay>
                          <NcMenu variant="small" class="!min-w-55">
                            <NcMenuItemCopyId
                              :id="displayColumn.id"
                              data-testid="nc-field-item-action-copy-id"
                              :tooltip="$t('msg.clickToCopyFieldId')"
                              :label="
                                $t('labels.idColon', {
                                  id: displayColumn.id,
                                })
                              "
                            />
                          </NcMenu>
                        </template>
                      </NcDropdown>
                      <MdiChevronRight
                        class="text-brand-500 opacity-0"
                        :class="{
                          'opacity-100': compareCols(displayColumn, activeField),
                        }"
                      />
                    </div>
                  </div>
                </template>
              </Draggable>
            </div>
          </div>
          <Transition name="slide-fade">
            <div
              v-if="!changingField"
              ref="rightPanelRef"
              class="flex-none border-gray-200 border-l-1 nc-scrollbar-md h-full !overflow-y-auto"
              @keydown.up.stop
              @keydown.down.stop
            >
              <SmartsheetColumnEditOrAddProvider
                v-if="activeField"
                class="p-4 w-[25rem] flex-none"
                :column="activeField"
                :preload="fieldState(activeField)"
                :table-explorer-columns="fields"
                :is-column-valid="isColumnValid"
                embed-mode
                :readonly="isLocked"
                from-table-explorer
                :disable-title-focus="!!activeField?.id || !!activeField?.title"
                @update="onFieldUpdate"
                @add="onFieldAdd"
              />
              <div v-else class="w-[25rem] flex flex-col justify-center p-4 items-center">
                <img src="~assets/img/placeholder/multi-field-editor.png" class="!w-[18rem]" />
                <div class="text-2xl text-gray-600 font-bold text-center pt-6">{{ $t('labels.multiField.selectField') }}</div>
                <div class="text-center text-sm px-2 text-gray-500 pt-6">
                  {{ $t('labels.multiField.selectFieldLabel') }}
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss">
.nc-dropdown-table-explorer {
  @apply !overflow-hidden;
}

.nc-dropdown-table-explorer > div > ul.ant-dropdown-menu.nc-menu {
  @apply !pt-0;
}

.nc-dropdown-table-explorer-display-column {
  @apply !overflow-hidden;
}
</style>

<style lang="scss" scoped>
:deep(ul.ant-dropdown-menu.nc-menu) {
  @apply !pt-0;
}

.add {
  background-color: #e6ffed !important;
  border-color: #b7eb8f;
}

.update {
  background-color: #fffbe6 !important;
  border-color: #ffe58f;
}

.delete {
  background-color: #fff1f0 !important;
  border-color: #ffa39e;
}

.selected {
  @apply bg-brand-50;
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.5s cubic-bezier(1, 0.5, 0.8, 1);
}

.skip-animation {
  transition: none;
}

.slide-fade-enter-from {
  transform: translateX(20px);
  opacity: 0;
}

.slide-fade-leave-to {
  opacity: 0;
}

.nc-fields-height {
  height: calc(100vh - (var(--topbar-height) * 3.6));
}

.nc-fields-add-new-field-btn-wrapper {
  @apply flex items-center mr-1;

  .nc-field-add-new {
    &.focused {
      @apply z-10;
    }
  }

  .nc-field-ai-toggle-btn {
    @apply rounded-l-none -ml-[1px];

    &.nc-ai-mode {
      @apply bg-purple-600 hover:bg-purple-500;
    }
    &:not(.nc-ai-mode) {
      @apply !border-purple-100;
    }
  }
}
</style>

<script lang="ts" setup>
import type { ComponentPublicInstance } from '@vue/runtime-core'
import { capitalize } from '@vue/runtime-core'
import type { Form as AntForm, SelectProps } from 'ant-design-vue'
import {
  type CalendarType,
  type ColumnType,
  type FormType,
  FormulaDataTypes,
  type GalleryType,
  type GridType,
  type KanbanType,
  type LookupType,
  type MapType,
  type SerializedAiViewType,
  type TableType,
  type ViewType,
  stringToViewTypeMap,
  viewTypeToStringMap,
} from 'nocodb-sdk'
import { UITypes, ViewTypes } from 'nocodb-sdk'

const props = withDefaults(defineProps<Props>(), {
  selectedViewId: undefined,
  groupingFieldColumnId: undefined,
  geoDataFieldColumnId: undefined,
  calendarRange: undefined,
  coverImageColumnId: undefined,
})

const emits = defineEmits<Emits>()

enum TableWizardTabs {
  AUTO_SUGGESTIONS = 'AUTO_SUGGESTIONS',
  PROMPT = 'PROMPT',
}

const maxSelectionCount = 5

interface Props {
  modelValue: boolean
  type: ViewTypes | 'AI'
  baseId: string
  tableId: string
  title?: string
  selectedViewId?: string
  groupingFieldColumnId?: string
  geoDataFieldColumnId?: string
  description?: string
  calendarRange?: Array<{
    fk_from_column_id: string
    fk_to_column_id: string | null // for ee only
  }>
  coverImageColumnId?: string
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void

  (event: 'created', value: GridType | KanbanType | GalleryType | FormType | MapType | CalendarType): void
}

interface Form {
  title: string
  type: ViewTypes | 'AI'
  description?: string
  copy_from_id: string | null
  // for kanban view only
  fk_grp_col_id: string | null
  fk_geo_data_col_id: string | null

  // for calendar view only
  calendar_range: Array<{
    fk_from_column_id: string
    fk_to_column_id: string | null // for ee only
  }>
  fk_cover_image_col_id: string | null
}

const { metas, getMeta } = useMetas()

const workspaceStore = useWorkspace()

const { viewsByTable } = storeToRefs(useViewsStore())

const { refreshCommandPalette } = useCommandPalette()

const { selectedViewId, groupingFieldColumnId, geoDataFieldColumnId, tableId, coverImageColumnId, baseId } = toRefs(props)

const meta = ref<TableType | undefined>()

const inputEl = ref<ComponentPublicInstance>()

const descriptionInputEl = ref<ComponentPublicInstance>()

const formValidator = ref<typeof AntForm>()

const vModel = useVModel(props, 'modelValue', emits)

const { t } = useI18n()

const { api } = useApi()

const isViewCreating = ref(false)

const views = computed(() => viewsByTable.value.get(tableId.value) ?? [])

const isNecessaryColumnsPresent = ref(true)

const errorMessages = {
  [ViewTypes.KANBAN]: t('msg.warning.kanbanNoFields'),
  [ViewTypes.MAP]: t('msg.warning.mapNoFields'),
  [ViewTypes.CALENDAR]: t('msg.warning.calendarNoFields'),
}

const form = reactive<Form>({
  title: props.title || '',
  type: props.type,
  copy_from_id: null,
  fk_grp_col_id: null,
  fk_geo_data_col_id: null,
  calendar_range: props.calendarRange || [],
  fk_cover_image_col_id: null,
  description: props.description || '',
})

const viewSelectFieldOptions = ref<SelectProps['options']>([])

const viewNameRules = [
  // name is required
  { required: true, message: `${t('labels.viewName')} ${t('general.required').toLowerCase()}` },
  // name is unique
  {
    validator: (_: unknown, v: string) =>
      new Promise((resolve, reject) => {
        views.value.every((v1) => v1.title !== v) ? resolve(true) : reject(new Error(`View name should be unique`))
      }),
    message: 'View name should be unique',
  },
]

const groupingFieldColumnRules = [{ required: true, message: `${t('general.groupingField')} ${t('general.required')}` }]

const geoDataFieldColumnRules = [{ required: true, message: `${t('general.geoDataField')} ${t('general.required')}` }]

const typeAlias = computed(
  () =>
    ({
      [ViewTypes.GRID]: 'grid',
      [ViewTypes.GALLERY]: 'gallery',
      [ViewTypes.FORM]: 'form',
      [ViewTypes.KANBAN]: 'kanban',
      [ViewTypes.MAP]: 'map',
      [ViewTypes.CALENDAR]: 'calendar',
      // Todo: add ai view docs route
      AI: '',
    }[props.type]),
)

const initTitle = ref<string>()

const { aiIntegrationAvailable, aiLoading, aiError, predictViews, createViews, loadAiIntegrations } = useNocoAi()

const aiMode = ref(false)

enum AiStep {
  init = 'init',
  pick = 'pick',
}

const aiModeStep = ref<AiStep | null>(null)

const predictedViews = ref<SerializedAiViewType[]>([])

const removedFromPredictedViews = ref<SerializedAiViewType[]>([])

const predictHistory = ref<SerializedAiViewType[]>([])

const selectedViews = ref<SerializedAiViewType[]>([])

const calledFunction = ref<string>()

const prompt = ref<string>('')

const isPromtAlreadyGenerated = ref<boolean>(false)

onBeforeMount(init)

watch(
  () => props.type,
  (newType) => {
    form.type = newType
  },
)

function init() {
  form.title = `${capitalize(typeAlias.value)}`

  if (selectedViewId.value) {
    form.copy_from_id = selectedViewId?.value
    const selectedViewName = views.value.find((v) => v.id === selectedViewId.value)?.title || form.title

    form.title = generateUniqueTitle(`${selectedViewName} copy`, views.value, 'title', '_', true)
  } else {
    const repeatCount = views.value.filter((v) => v.title.startsWith(form.title)).length

    if (repeatCount) {
      form.title = `${form.title}-${repeatCount}`
    }
  }

  initTitle.value = form.title

  nextTick(() => {
    const el = inputEl.value?.$el as HTMLInputElement

    if (el) {
      el.focus()
      el.select()
    }
  })
}

const isAIViewCreateMode = computed(() => props.type === 'AI')

const activeAiTabLocal = ref<keyof typeof TableWizardTabs>(TableWizardTabs.AUTO_SUGGESTIONS)

const activeAiTab = computed({
  get: () => {
    return activeAiTabLocal.value
  },
  set: (value: keyof typeof TableWizardTabs) => {
    activeAiTabLocal.value = value

    predictedViews.value = []
    predictHistory.value = [...selectedViews.value]

    prompt.value = ''
    isPromtAlreadyGenerated.value = false

    aiError.value = ''
  },
})

const onAiEnter = async () => {
  calledFunction.value = 'createViews'

  if (selectedViews.value.length) {
    try {
      const data = await createViews(selectedViews.value, baseId.value)

      emits('created', data)
    } catch (e) {
      message.error(e)
    } finally {
      await refreshCommandPalette()
    }

    vModel.value = false
  }
}

async function onSubmit() {
  if (aiMode.value) {
    return onAiEnter()
  }

  let isValid = null

  try {
    isValid = await formValidator.value?.validateFields()
  } catch (e) {
    console.error(e)
  }

  if (form.title) {
    form.title = form.title.trim()
  }

  if (isValid && form.type) {
    if (!tableId.value) return

    try {
      let data: GridType | KanbanType | GalleryType | FormType | MapType | null = null

      isViewCreating.value = true

      switch (form.type) {
        case ViewTypes.GRID:
          data = await api.dbView.gridCreate(tableId.value, form)
          break
        case ViewTypes.GALLERY:
          data = await api.dbView.galleryCreate(tableId.value, form)
          break
        case ViewTypes.FORM:
          data = await api.dbView.formCreate(tableId.value, form)
          break
        case ViewTypes.KANBAN:
          data = await api.dbView.kanbanCreate(tableId.value, form)
          break
        case ViewTypes.MAP:
          data = await api.dbView.mapCreate(tableId.value, form)
          break
        case ViewTypes.CALENDAR:
          data = await api.dbView.calendarCreate(tableId.value, {
            ...form,
            calendar_range: form.calendar_range.map((range) => ({
              fk_from_column_id: range.fk_from_column_id,
              fk_to_column_id: range.fk_to_column_id,
            })),
          })
          break
      }

      if (data) {
        // View created successfully
        // message.success(t('msg.toast.createView'))

        emits('created', data)
      }
    } catch (e: any) {
      message.error(e.message)
    } finally {
      await refreshCommandPalette()
    }

    vModel.value = false

    setTimeout(() => {
      isViewCreating.value = false
    }, 500)
  }
}

/*
const addCalendarRange = async () => {
  form.calendar_range.push({
    fk_from_column_id: viewSelectFieldOptions.value[0].value as string,
    fk_to_column_id: null,
  })
}
*/

const enableDescription = ref(false)

const removeDescription = () => {
  form.description = ''
  enableDescription.value = false
}

const toggleDescription = () => {
  if (enableDescription.value) {
    enableDescription.value = false
  } else {
    enableDescription.value = true
    setTimeout(() => {
      descriptionInputEl.value?.focus()
    }, 100)
  }
}

const isMetaLoading = ref(false)

onMounted(async () => {
  if (form.copy_from_id) {
    enableDescription.value = true
  } else {
    loadAiIntegrations()
  }

  if ([ViewTypes.GALLERY, ViewTypes.KANBAN, ViewTypes.MAP, ViewTypes.CALENDAR].includes(props.type)) {
    isMetaLoading.value = true
    try {
      meta.value = (await getMeta(tableId.value))!
      if (props.type === ViewTypes.MAP) {
        viewSelectFieldOptions.value = meta
          .value!.columns!.filter((el) => el.uidt === UITypes.GeoData)
          .map((field) => {
            return {
              value: field.id,
              label: field.title,
            }
          })

        if (geoDataFieldColumnId.value) {
          // take from the one from copy view
          form.fk_geo_data_col_id = geoDataFieldColumnId.value
        } else if (viewSelectFieldOptions.value?.length) {
          // if there is geo data column take the first option
          form.fk_geo_data_col_id = viewSelectFieldOptions.value?.[0]?.value as string
        } else {
          // if there is no geo data column, disable the create button
          isNecessaryColumnsPresent.value = false
        }
      }

      // preset the cover image field
      if (props.type === ViewTypes.GALLERY) {
        viewSelectFieldOptions.value = [
          { value: null, label: 'No Image' },
          ...(meta.value.columns || [])
            .filter((el) => el.uidt === UITypes.Attachment)
            .map((field) => {
              return {
                value: field.id,
                label: field.title,
                uidt: field.uidt,
              }
            }),
        ]
        const lookupColumns = (meta.value.columns || [])?.filter((c) => c.uidt === UITypes.Lookup)

        const attLookupColumnIds: Set<string> = new Set()

        const loadLookupMeta = async (originalCol: ColumnType, column: ColumnType, metaId?: string): Promise<void> => {
          const relationColumn =
            metaId || meta.value?.id
              ? metas.value[metaId || meta.value?.id]?.columns?.find(
                  (c: ColumnType) => c.id === (column?.colOptions as LookupType)?.fk_relation_column_id,
                )
              : undefined

          if (relationColumn?.colOptions?.fk_related_model_id) {
            await getMeta(relationColumn.colOptions.fk_related_model_id!)

            const lookupColumn = metas.value[relationColumn.colOptions.fk_related_model_id]?.columns?.find(
              (c: any) => c.id === (column?.colOptions as LookupType)?.fk_lookup_column_id,
            ) as ColumnType | undefined

            if (lookupColumn && isAttachment(lookupColumn)) {
              attLookupColumnIds.add(originalCol.id)
            } else if (lookupColumn && lookupColumn?.uidt === UITypes.Lookup) {
              await loadLookupMeta(originalCol, lookupColumn, relationColumn.colOptions.fk_related_model_id)
            }
          }
        }

        await Promise.allSettled(lookupColumns.map((col) => loadLookupMeta(col, col)))

        const lookupAttColumns = lookupColumns
          .filter((column) => attLookupColumnIds.has(column?.id))
          .map((c) => {
            return {
              value: c.id,
              label: c.title,
              uidt: c.uidt,
            }
          })

        viewSelectFieldOptions.value = [...viewSelectFieldOptions.value, ...lookupAttColumns]

        if (coverImageColumnId.value) {
          form.fk_cover_image_col_id = coverImageColumnId.value
        } else if (viewSelectFieldOptions.value.length > 1 && !form.copy_from_id) {
          form.fk_cover_image_col_id = viewSelectFieldOptions.value[1].value as string
        } else {
          form.fk_cover_image_col_id = null
        }
      }

      // preset the grouping field column
      if (props.type === ViewTypes.KANBAN) {
        viewSelectFieldOptions.value = meta.value
          .columns!.filter((el) => el.uidt === UITypes.SingleSelect)
          .map((field) => {
            return {
              value: field.id,
              label: field.title,
              uidt: field.uidt,
            }
          })

        if (groupingFieldColumnId.value) {
          // take from the one from copy view
          form.fk_grp_col_id = groupingFieldColumnId.value
        } else if (viewSelectFieldOptions.value?.length) {
          // take the first option
          form.fk_grp_col_id = viewSelectFieldOptions.value[0].value as string
        } else {
          // if there is no grouping field column, disable the create button
          isNecessaryColumnsPresent.value = false
        }

        if (coverImageColumnId.value) {
          form.fk_cover_image_col_id = coverImageColumnId.value
        } else if (viewSelectFieldOptions.value.length > 1 && !form.copy_from_id) {
          form.fk_cover_image_col_id = viewSelectFieldOptions.value[1].value as string
        } else {
          form.fk_cover_image_col_id = null
        }
      }

      if (props.type === ViewTypes.CALENDAR) {
        viewSelectFieldOptions.value = meta
          .value!.columns!.filter(
            (el) =>
              [UITypes.DateTime, UITypes.Date, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(el.uidt) ||
              (el.uidt === UITypes.Formula && (el.colOptions as any)?.parsed_tree?.dataType === FormulaDataTypes.DATE),
          )
          .map((field) => {
            return {
              value: field.id,
              label: field.title,
              uidt: field.uidt,
            }
          })
          .sort((a, b) => {
            const priority = {
              [UITypes.DateTime]: 1,
              [UITypes.Date]: 2,
              [UITypes.Formula]: 3,
              [UITypes.CreatedTime]: 4,
              [UITypes.LastModifiedTime]: 5,
            }

            return (priority[a.uidt] || 6) - (priority[b.uidt] || 6)
          })

        if (viewSelectFieldOptions.value?.length) {
          // take the first option
          if (form.calendar_range.length === 0) {
            form.calendar_range = [
              {
                fk_from_column_id: viewSelectFieldOptions.value[0].value as string,
                fk_to_column_id: null, // for ee only
              },
            ]
          }
        } else {
          // if there is no grouping field column, disable the create button
          isNecessaryColumnsPresent.value = false
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      isMetaLoading.value = false
    }
  }
})

const isCalendarReadonly = (calendarRange?: Array<{ fk_from_column_id: string; fk_to_column_id: string | null }>) => {
  if (!calendarRange) return false
  return calendarRange.some((range) => {
    const column = viewSelectFieldOptions.value?.find((c) => c.value === range?.fk_from_column_id)
    return !column || ![UITypes.DateTime, UITypes.Date].includes(column.uidt)
  })
}

const _predictViews = async (prompt?: string): Promise<SerializedAiViewType[]> => {
  const viewType =
    !isAIViewCreateMode.value && form.type && viewTypeToStringMap[form.type] ? viewTypeToStringMap[form.type] : undefined
  return await predictViews(tableId.value, predictHistory.value, baseId.value, prompt, viewType)
}

const toggleAiMode = async () => {
  if (aiMode.value) return

  formValidator.value?.clearValidate()
  aiError.value = ''

  aiMode.value = true
  aiModeStep.value = AiStep.init
  predictedViews.value = []
  predictHistory.value = []
  prompt.value = ''
  isPromtAlreadyGenerated.value = false

  if (form.title === initTitle.value) {
    form.title = ''
  }
  const predictions = await _predictViews()

  if (predictions.length) {
    predictedViews.value = predictions
    predictHistory.value.push(...predictions)
    aiModeStep.value = AiStep.pick
  }
}

const disableAiMode = () => {
  if (isAIViewCreateMode.value) return

  aiMode.value = false
  aiModeStep.value = null
  predictedViews.value = []
  predictHistory.value = []
  prompt.value = ''
  isPromtAlreadyGenerated.value = false
  activeAiTab.value = TableWizardTabs.AUTO_SUGGESTIONS

  form.title = initTitle.value || ''
}

const predictMore = async () => {
  calledFunction.value = 'predictMore'

  const predictions = await _predictViews()

  if (predictions.length) {
    predictedViews.value.push(
      ...predictions.filter(
        (v) =>
          !ncIsArrayIncludes(predictedViews.value, v.title, 'title') &&
          !ncIsArrayIncludes(selectedViews.value, v.title, 'title') &&
          !ncIsArrayIncludes(removedFromPredictedViews.value, v.title, 'title'),
      ),
    )
    predictHistory.value.push(...predictions.filter((v) => !ncIsArrayIncludes(selectedViews.value, v.title, 'title')))
  }
}

const predictRefresh = async () => {
  calledFunction.value = 'predictRefresh'

  const predictions = (await _predictViews()).filter(
    (pv) =>
      !ncIsArrayIncludes(selectedViews.value, pv.title, 'title') &&
      !ncIsArrayIncludes(removedFromPredictedViews.value, pv.title, 'title'),
  )

  if (predictions.length) {
    predictedViews.value = predictions
    predictHistory.value.push(...predictions)
    aiModeStep.value = AiStep.pick
  }
}

const predictFromPrompt = async () => {
  calledFunction.value = 'predictFromPrompt'

  const predictions = (await _predictViews(prompt.value)).filter(
    (pv) =>
      !ncIsArrayIncludes(selectedViews.value, pv.title, 'title') &&
      !ncIsArrayIncludes(removedFromPredictedViews.value, pv.title, 'title'),
  )

  if (predictions.length) {
    predictedViews.value = predictions
    predictHistory.value.push(...predictions)
    aiModeStep.value = AiStep.pick
  }

  isPromtAlreadyGenerated.value = true
}

const onTagClick = (view: SerializedAiViewType) => {
  if (selectedViews.value.length >= maxSelectionCount || ncIsArrayIncludes(selectedViews.value, view.title, 'title')) return

  selectedViews.value.push(view)
  predictedViews.value = predictedViews.value.filter((v) => v.title !== view.title)
}

const onTagClose = (view: SerializedAiViewType) => {
  selectedViews.value = selectedViews.value.filter((v) => v.title !== view.title)
  if (ncIsArrayIncludes(predictHistory.value, view.title, 'title')) {
    predictedViews.value.push(view)
  }
}

const onTagRemoveFromPrediction = (view: SerializedAiViewType) => {
  if (selectedViews.value.length >= maxSelectionCount) return

  removedFromPredictedViews.value.push(view)
  predictedViews.value = predictedViews.value.filter((pv) => pv.title !== view.title)
}

const onSelectAll = () => {
  if (selectedViews.value.length >= maxSelectionCount) return
  let count = selectedViews.value.length

  const remainingPredictedTables: SerializedAiViewType[] = []
  const viewsToAdd: SerializedAiViewType[] = []

  predictedViews.value.forEach((pv) => {
    // Check if the item can be selected
    if (
      count < maxSelectionCount &&
      !ncIsArrayIncludes(removedFromPredictedViews.value, pv.title, 'title') &&
      !ncIsArrayIncludes(selectedViews.value, pv.title, 'title')
    ) {
      viewsToAdd.push(pv) // Add to selected view if it meets the criteria
      count++
    } else {
      remainingPredictedTables.push(pv) // Keep in predicted view if it doesn't meet the criteria
    }
  })

  // Add selected items to the selected view array
  selectedViews.value.push(...viewsToAdd)

  // Update predictedViews with the remaining ones
  predictedViews.value = remainingPredictedTables
}

const onDeselectAll = () => {
  predictedViews.value.push(...selectedViews.value.filter((sv) => ncIsArrayIncludes(predictHistory.value, sv.title, 'title')))
  selectedViews.value = selectedViews.value.filter((sv) => !ncIsArrayIncludes(predictHistory.value, sv.title, 'title'))
}

const fullAuto = async (e) => {
  const target = e.target as HTMLElement
  if (
    !aiIntegrationAvailable.value ||
    aiLoading.value ||
    aiError.value ||
    target.closest('button, input, .nc-button, textarea')
  ) {
    return
  }

  if (!aiModeStep.value) {
    await toggleAiMode()
  } else if (aiModeStep.value === AiStep.pick && selectedViews.value.length === 0) {
    await onSelectAll()
  } else if (aiModeStep.value === AiStep.pick && selectedViews.value.length > 0) {
    await onAiEnter()
  }
}

const aiTabs = [
  {
    title: 'Auto Suggestions',
    key: TableWizardTabs.AUTO_SUGGESTIONS,
  },
  {
    title: 'Prompt',
    key: TableWizardTabs.PROMPT,
  },
]

const isPredictFromPromptLoading = computed(() => {
  return aiLoading.value && calledFunction.value === 'predictFromPrompt'
})

const handleNavigateToIntegrations = () => {
  vModel.value = false

  workspaceStore.navigateToIntegrations(undefined, undefined, {
    categories: 'ai',
  })
}

const handleRefreshOnError = () => {
  switch (calledFunction.value) {
    case 'predictMore':
      return predictMore()
    case 'predictRefresh':
      return predictRefresh()
    case 'predictFromPrompt':
      return predictFromPrompt()

    default:
  }
}

onBeforeMount(init)

watch(
  () => props.type,
  (newType) => {
    form.type = newType
  },
)

function init() {
  if (props.type === 'AI') {
    toggleAiMode()
  } else {
    form.title = `${capitalize(typeAlias.value)}`

    const repeatCount = views.value.filter((v) => v.title.startsWith(form.title)).length
    if (repeatCount) {
      form.title = `${form.title}-${repeatCount}`
    }
    if (selectedViewId.value) {
      form.copy_from_id = selectedViewId?.value
    }

    initTitle.value = form.title

    nextTick(() => {
      const el = inputEl.value?.$el as HTMLInputElement

      if (el) {
        el.focus()
        el.select()
      }
    })
  }
}
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    class="nc-view-create-modal"
    :show-separator="false"
    size="sm"
    height="auto"
    width="592px"
    :centered="false"
    nc-modal-class-name="!p-0"
  >
    <template #header>
      <div class="px-6 pt-6 flex w-full flex-row justify-between items-center" @dblclick.stop="fullAuto">
        <div class="flex font-bold text-base gap-x-3 items-center">
          <GeneralViewIcon :meta="{ type: form.type }" class="nc-view-icon !text-[24px] !leading-6 max-h-6 max-w-6" />
          <template v-if="form.type === ViewTypes.GRID">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateGridView') }}
            </template>
            <template v-else>
              {{ $t('labels.createGridView') }}
            </template>
          </template>
          <template v-else-if="form.type === ViewTypes.GALLERY">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateGalleryView') }}
            </template>
            <template v-else>
              {{ $t('labels.createGalleryView') }}
            </template>
          </template>
          <template v-else-if="form.type === ViewTypes.FORM">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateFormView') }}
            </template>
            <template v-else>
              {{ $t('labels.createFormView') }}
            </template>
          </template>
          <template v-else-if="form.type === ViewTypes.KANBAN">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateKanbanView') }}
            </template>
            <template v-else>
              {{ $t('labels.createKanbanView') }}
            </template>
          </template>
          <template v-else-if="form.type === ViewTypes.CALENDAR">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateCalendarView') }}
            </template>
            <template v-else>
              {{ $t('labels.createCalendarView') }}
            </template>
          </template>
          <template v-else-if="form.type === 'AI'">
            {{ $t('labels.createViewUsingAi') }}
          </template>
          <template v-else>
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateMapView') }}
            </template>
            <template v-else>
              {{ $t('labels.duplicateView') }}
            </template>
          </template>
        </div>
        <a
          v-if="!form.copy_from_id"
          class="text-sm !text-gray-600 !font-default !hover:text-gray-600"
          :href="`https://docs.nocodb.com/views/view-types/${typeAlias}`"
          target="_blank"
        >
          Docs
        </a>
      </div>
    </template>
    <div class="px-6 pb-6 flex flex-col mt-1" @dblclick.stop="fullAuto">
      <a-form v-if="isNecessaryColumnsPresent" ref="formValidator" :model="form" layout="vertical" class="flex flex-col gap-y-5">
        <a-form-item
          :rules="aiMode ? [] : viewNameRules"
          name="title"
          class="relative"
          :class="{
            'nc-view-ai-mode': !form.copy_from_id,
          }"
        >
          <a-input
            v-if="!aiMode"
            ref="inputEl"
            v-model:value="form.title"
            :placeholder="$t('labels.viewName')"
            autofocus
            class="nc-view-input nc-input-sm nc-input-shadow z-11"
            :class="{
              '!max-w-[calc(100%_-_32px)]': !form.copy_from_id,
            }"
            @keydown.enter="onSubmit"
          />
          <a-input
            v-else
            ref="inputEl"
            autocomplete="off"
            class="nc-view-input nc-input-sm nc-input-shadow !max-w-[calc(100%_-_32px)] z-11"
            hide-details
            :placeholder="selectedViews.length ? '' : 'Select from suggested views...'"
          />
          <!-- overlay selected tags with close icon on input -->
          <div
            v-if="aiMode"
            class="absolute top-0 max-w-[calc(100%_-_48px)] left-0 z-12 h-8 flex items-center gap-2 mx-2 nc-scrollbar-thin overflow-x-auto"
          >
            <a-tag
              v-for="(v, idx) of selectedViews"
              :key="idx"
              class="cursor-pointer !rounded-md !bg-nc-bg-brand hover:!bg-brand-100 !text-nc-content-brand !border-none font-semibold !mx-0"
            >
              <div class="flex flex-row items-center gap-1 py-[3px] text-small leading-[18px]">
                <GeneralViewIcon :meta="{ type: stringToViewTypeMap[v.type] }" />
                <span>{{ v.title }}</span>
                <div class="flex items-center p-0.5 mt-0.5">
                  <GeneralIcon icon="close" class="h-3 w-3 cursor-pointer opacity-80" @click="onTagClose(v)" />
                </div>
              </div>
            </a-tag>
          </div>

          <!-- Black overlay button on end of input -->
          <NcTooltip
            v-if="!form.copy_from_id"
            :title="aiMode ? 'Disable AI suggestions' : 'Suggest views using AI'"
            class="nc-view-ai-toggle-btn absolute right-0 top-0 h-full"
          >
            <NcButton
              size="small"
              type="secondary"
              class="z-10 !border-l-0 !rounded-l-none !pl-3.8"
              :class="{
                '!bg-nc-bg-purple-light hover:!bg-nc-bg-purple-dark disabled:!bg-nc-bg-purple-light !border-purple-100 !text-nc-fill-purple-dark':
                  !aiMode,
                '!bg-purple-700 !border-purple-700 hover:(!bg-nc-fill-purple-medium disabled:!bg-purple-700 !border-nc-fill-purple-medium) !text-white':
                  aiMode,
              }"
              :disabled="aiLoading || isAIViewCreateMode"
              @click.stop="aiMode ? disableAiMode() : toggleAiMode()"
            >
              <div class="w-full flex items-center justify-end">
                <GeneralIcon icon="ncAutoAwesome" class="text-xs !text-current w-4 h-4" />
              </div>
            </NcButton>
          </NcTooltip>
        </a-form-item>
        <template v-if="!aiMode">
          <a-form-item
            v-if="form.type === ViewTypes.GALLERY && !form.copy_from_id"
            :label="`${$t('labels.coverImageField')}`"
            name="fk_cover_image_col_id"
          >
            <NcSelect
              v-model:value="form.fk_cover_image_col_id"
              :disabled="isMetaLoading"
              :loading="isMetaLoading"
              dropdown-match-select-width
              :not-found-content="$t('placeholder.selectGroupFieldNotFound')"
              :placeholder="$t('placeholder.selectCoverImageField')"
              class="nc-select-shadow w-full nc-gallery-cover-image-field-select"
            >
              <a-select-option v-for="option of viewSelectFieldOptions" :key="option.value" :value="option.value">
                <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                  <div class="flex-1 flex items-center gap-1 max-w-[calc(100%_-_24px)]">
                    <SmartsheetHeaderIcon v-if="option.value" :column="option" class="!ml-0" />

                    <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                      <template #title>
                        {{ option.label }}
                      </template>
                      <template #default>{{ option.label }}</template>
                    </NcTooltip>
                  </div>
                  <GeneralIcon
                    v-if="form.fk_cover_image_col_id === option.value"
                    id="nc-selected-item-icon"
                    icon="check"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item>
          <a-form-item
            v-if="form.type === ViewTypes.KANBAN && !form.copy_from_id"
            :label="$t('general.groupingField')"
            :rules="groupingFieldColumnRules"
            name="fk_grp_col_id"
          >
            <NcSelect
              v-model:value="form.fk_grp_col_id"
              :disabled="isMetaLoading"
              :loading="isMetaLoading"
              dropdown-match-select-width
              :not-found-content="$t('placeholder.selectGroupFieldNotFound')"
              :placeholder="$t('placeholder.selectGroupField')"
              class="nc-select-shadow w-full nc-kanban-grouping-field-select"
            >
              <a-select-option v-for="option of viewSelectFieldOptions" :key="option.value" :value="option.value">
                <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                  <div class="flex-1 flex items-center gap-1 max-w-[calc(100%_-_24px)]">
                    <SmartsheetHeaderIcon :column="option" class="!ml-0" />

                    <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                      <template #title>
                        {{ option.label }}
                      </template>
                      <template #default>{{ option.label }}</template>
                    </NcTooltip>
                  </div>
                  <GeneralIcon
                    v-if="form.fk_grp_col_id === option.value"
                    id="nc-selected-item-icon"
                    icon="check"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item>
          <a-form-item
            v-if="form.type === ViewTypes.MAP"
            :label="$t('general.geoDataField')"
            :rules="geoDataFieldColumnRules"
            name="fk_geo_data_col_id"
          >
            <NcSelect
              v-model:value="form.fk_geo_data_col_id"
              :disabled="isMetaLoading"
              :loading="isMetaLoading"
              :not-found-content="$t('placeholder.selectGeoFieldNotFound')"
              :options="viewSelectFieldOptions"
              :placeholder="$t('placeholder.selectGeoField')"
              class="nc-select-shadow w-full"
            />
          </a-form-item>
          <template v-if="form.type === ViewTypes.CALENDAR && !form.copy_from_id">
            <div v-for="(range, index) in form.calendar_range" :key="`range-${index}`" class="flex w-full items-center gap-2">
              <span class="text-gray-800">
                {{ $t('labels.organiseBy') }}
              </span>
              <NcSelect
                v-model:value="range.fk_from_column_id"
                :disabled="isMetaLoading"
                :loading="isMetaLoading"
                class="nc-select-shadow nc-from-select"
              >
                <a-select-option
                  v-for="(option, id) in [...viewSelectFieldOptions!].filter((f) => {
                  // If the fk_from_column_id of first range is Date, then all the other ranges should be Date
                  // If the fk_from_column_id of first range is DateTime, then all the other ranges should be DateTime
                  if (index === 0) return true
                  const firstRange = viewSelectFieldOptions!.find((f) => f.value === form.calendar_range[0].fk_from_column_id)
                  return firstRange?.uidt === f.uidt
                })"
                  :key="id"
                  class="w-40"
                  :value="option.value"
                >
                  <div class="flex w-full gap-2 justify-between items-center">
                    <div class="flex gap-2 items-center">
                      <SmartsheetHeaderIcon :column="option" class="!ml-0" />
                      <NcTooltip class="truncate flex-1 max-w-18" placement="top" show-on-truncate-only>
                        <template #title>{{ option.label }}</template>
                        {{ option.label }}
                      </NcTooltip>
                    </div>
                    <div class="flex-1" />
                    <component
                      :is="iconMap.check"
                      v-if="option.value === range.fk_from_column_id"
                      id="nc-selected-item-icon"
                      class="text-primary min-w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </NcSelect>
              <!--            <div
              v-if="range.fk_to_column_id === null && isEeUI"
              class="cursor-pointer flex items-center text-gray-800 gap-1"
              @click="range.fk_to_column_id = undefined"
            >
              <component :is="iconMap.plus" class="h-4 w-4" />
              {{ $t('activity.addEndDate') }}
            </div>
            <template v-else-if="isEeUI">
              <span>
                {{ $t('activity.withEndDate') }}
              </span>

              <div class="flex">
                <NcSelect
                  v-model:value="range.fk_to_column_id"
                  :disabled="isMetaLoading"
                  :loading="isMetaLoading"
                  :placeholder="$t('placenc-to-seleholder.notSelected')"
                  class="!rounded-r-none ct"
                >
                  <a-select-option
                    v-for="(option, id) in [...viewSelectFieldOptions].filter((f) => {
                      // If the fk_from_column_id of first range is Date, then all the other ranges should be Date
                      // If the fk_from_column_id of first range is DateTime, then all the other ranges should be DateTime

                      const firstRange = viewSelectFieldOptions.find((f) => f.value === form.calendar_range[0].fk_from_column_id)
                      return firstRange?.uidt === f.uidt
                    })"
                    :key="id"
                    :value="option.value"
                  >
                    <div class="flex items-center">
                      <SmartsheetHeaderIcon :column="option" />
                      <NcTooltip class="truncate flex-1 max-w-18" placement="top" show-on-truncate-only>
                        <template #title>{{ option.label }}</template>
                        {{ option.label }}
                      </NcTooltip>
                    </div>
                  </a-select-option>
                </NcSelect>
                <NcButton class="!rounded-l-none !border-l-0" size="small" type="secondary" @click="range.fk_to_column_id = null">
                  <component :is="iconMap.delete" class="h-4 w-4" />
                </NcButton>
              </div>
              <NcButton
                v-if="index !== 0"
                size="small"
                type="secondary"
                @click="
                  () => {
                    form.calendar_range = form.calendar_range.filter((_, i) => i !== index)
                  }
                "
              >
                <component :is="iconMap.close" />
              </NcButton>
            </template>
          </div> -->

              <!--          <NcButton class="mt-2" size="small" type="secondary" @click="addCalendarRange">
            <component :is="iconMap.plus" />
            Add another date field
          </NcButton> -->
            </div>

            <div
              v-if="isCalendarReadonly(form.calendar_range)"
              class="flex flex-row p-4 border-gray-200 border-1 gap-x-4 rounded-lg w-full"
            >
              <div class="text-gray-500 flex gap-4">
                <GeneralIcon class="min-w-6 h-6 text-orange-500" icon="info" />
                <div class="flex flex-col gap-1">
                  <h2 class="font-semibold text-sm mb-0 text-gray-800">Calendar is readonly</h2>
                  <span class="text-gray-500 font-default text-sm"> {{ $t('msg.info.calendarReadOnly') }}</span>
                </div>
              </div>
            </div>
          </template>
        </template>
      </a-form>
      <div v-else-if="!isNecessaryColumnsPresent" class="flex flex-row p-4 border-gray-200 border-1 gap-x-4 rounded-lg w-full">
        <div class="text-gray-500 flex gap-4">
          <GeneralIcon class="min-w-6 h-6 text-orange-500" icon="alertTriangle" />
          <div class="flex flex-col gap-1">
            <h2 class="font-semibold text-sm mb-0 text-gray-800">Suitable fields not present</h2>
            <span class="text-gray-500 font-default text-sm"> {{ errorMessages[form.type] }}</span>
          </div>
        </div>
      </div>

      <!-- Ai table wizard  -->
      <AiWizardCard
        v-if="aiMode"
        v-model:active-tab="activeAiTab"
        :tabs="aiTabs"
        class="mt-4"
        @navigate-to-integrations="handleNavigateToIntegrations"
      >
        <template v-if="aiIntegrationAvailable" #tabExtraRight>
          <template v-if="activeAiTab === TableWizardTabs.AUTO_SUGGESTIONS">
            <template v-if="aiModeStep === AiStep.pick">
              <NcTooltip title="Re-suggest" placement="top">
                <NcButton
                  size="xs"
                  class="!px-1 !text-current hover:!bg-nc-bg-purple-dark"
                  type="text"
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
              <NcTooltip
                v-if="
                  predictHistory.length < selectedViews.length
                    ? predictHistory.length + selectedViews.length < 8
                    : predictHistory.length < 8
                "
                title="Suggest more"
                placement="top"
              >
                <NcButton
                  size="xs"
                  class="!px-1 !text-current hover:!bg-nc-bg-purple-dark"
                  type="text"
                  :loading="aiLoading && calledFunction === 'predictMore'"
                  @click="predictMore"
                >
                  <template #loadingIcon>
                    <!-- eslint-disable vue/no-lone-template -->
                    <template> </template>
                  </template>
                  <GeneralLoader v-if="aiLoading && calledFunction === 'predictMore'" class="!text-current" />
                  <GeneralIcon v-else icon="ncPlusAi" class="!text-current" />
                </NcButton>
              </NcTooltip>
            </template>
          </template>
          <template v-else>
            <NcButton
              size="xs"
              class="hover:(!bg-nc-bg-purple-dark disabled:!bg-transparent) !text-nc-content-purple-dark disabled:!text-nc-content-purple-light"
              :class="{
                '!text-nc-content-purple-light': isPredictFromPromptLoading,
              }"
              type="text"
              :disabled="!prompt.trim()"
              :loading="isPredictFromPromptLoading"
              @click="predictFromPrompt"
            >
              <template #loadingIcon>
                <!-- eslint-disable vue/no-lone-template -->
                <template></template>
              </template>
              <div
                class="flex items-center gap-2"
                :class="{
                  'min-w-[104px]': isPredictFromPromptLoading && !isPromtAlreadyGenerated,
                  'min-w-[124px]': isPredictFromPromptLoading && isPromtAlreadyGenerated,
                }"
              >
                <GeneralIcon icon="ncZap" class="flex-none" />
                <div
                  :class="{
                    'nc-animate-dots': isPredictFromPromptLoading,
                  }"
                >
                  {{
                    isPredictFromPromptLoading
                      ? isPromtAlreadyGenerated
                        ? 'Re-generating'
                        : 'Generating'
                      : isPromtAlreadyGenerated
                      ? 'Re-generate'
                      : 'Generate'
                  }}
                </div>
              </div>
            </NcButton>
          </template>
        </template>
        <template #tabContent>
          <template v-if="aiError">
            <div class="py-3 pl-3 pr-2 flex items-center gap-3">
              <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-4 h-4" />

              <div class="text-sm text-nc-content-gray-subtle flex-1 max-w-[calc(100%_-_24px)]">
                <NcTooltip class="truncate" show-on-truncate-only>
                  <template #title>
                    {{ aiError }}
                  </template>
                  {{ aiError }}
                </NcTooltip>
              </div>

              <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="handleRefreshOnError">
                {{ $t('general.refresh') }}
              </NcButton>
            </div>
          </template>
          <template v-else>
            <template v-if="activeAiTab === TableWizardTabs.AUTO_SUGGESTIONS">
              <div v-if="aiModeStep === 'init'" class="p-4">
                <div class="text-nc-content-purple-light text-sm h-7 flex items-center">
                  <GeneralLoader size="regular" class="!text-nc-content-purple-dark !mr-2" />

                  Auto suggesting view based on your base name and existing views
                  <div class="nc-animate-dots"></div>
                </div>
              </div>
            </template>
            <template v-else>
              <div>
                <a-textarea
                  v-model:value="prompt"
                  :bordered="false"
                  placeholder="Enter your prompt to get table suggestions.."
                  class="!px-4 !py-2 !text-sm !min-h-[120px]"
                  @keydown.enter.stop
                >
                </a-textarea>
              </div>
            </template>

            <div
              v-if="
                (activeAiTab === TableWizardTabs.AUTO_SUGGESTIONS && aiModeStep === 'pick') ||
                (activeAiTab === TableWizardTabs.PROMPT &&
                  (predictedViews.length || selectedViews.length || isPromtAlreadyGenerated))
              "
              class="flex gap-2 flex-wrap p-4"
              :class="{
                'p-4': activeAiTab === TableWizardTabs.AUTO_SUGGESTIONS,
                'border-t-1 border-purple-200': activeAiTab === TableWizardTabs.PROMPT,
              }"
            >
              <template v-for="(v, idx) of predictedViews">
                <NcTooltip v-if="v?.title" :key="idx" :disabled="selectedViews.length < maxSelectionCount">
                  <template #title>
                    <div class="w-[150px]">You can only select 5 views to create at a time.</div>
                  </template>

                  <a-tag
                    class="!rounded-md !bg-nc-bg-purple-light !border-none !mx-0"
                    :class="{
                      'cursor-pointer !text-nc-content-purple-dark hover:!bg-nc-bg-purple-dark':
                        selectedViews.length < maxSelectionCount,
                      'cursor-not-allowed !text-nc-content-purple-light': selectedViews.length >= maxSelectionCount,
                    }"
                    :disabled="selectedViews.length >= maxSelectionCount"
                    @click="onTagClick(v)"
                  >
                    <div class="flex flex-row items-center gap-1 py-[3px] text-small leading-[18px]">
                      <GeneralViewIcon
                        :meta="{ type: stringToViewTypeMap[v.type] }"
                        :class="{
                          'opacity-60': selectedViews.length >= maxSelectionCount,
                        }"
                      />

                      <div>{{ v.title }}</div>

                      <div class="flex items-center p-0.5 mt-0.5">
                        <GeneralIcon
                          icon="close"
                          class="h-3 w-3 opacity-80"
                          :class="{
                            'cursor-pointer ': selectedViews.length < maxSelectionCount,
                          }"
                          @click.stop="onTagRemoveFromPrediction(v)"
                        />
                      </div>
                    </div>
                  </a-tag>
                </NcTooltip>
              </template>

              <NcTooltip
                v-if="predictedViews.length || !selectedViews.length"
                :disabled="selectedViews.length < maxSelectionCount"
              >
                <template #title>
                  <div class="w-[150px]">You can only select 5 views to create at a time.</div>
                </template>
                <NcButton
                  size="xs"
                  class="!h-6 bg-nc-bg-purple-dark"
                  :type="predictedViews.length && selectedViews.length < maxSelectionCount ? 'text' : 'secondary'"
                  :disabled="!predictedViews.length || selectedViews.length >= maxSelectionCount"
                  :class="{
                    '!bg-nc-bg-purple-dark hover:!bg-nc-bg-purple-light !text-nc-content-purple-dark':
                      predictedViews.length && selectedViews.length < maxSelectionCount,
                    '!text-nc-content-purple-light !border-purple-200 !bg-nc-bg-purple-light':
                      !predictedViews.length || selectedViews.length >= maxSelectionCount,
                  }"
                  @click="onSelectAll"
                >
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="ncPlusMultiple" class="flex-none" />

                    Accept all
                  </div>
                </NcButton>
              </NcTooltip>
              <NcButton
                v-else
                size="xs"
                class="!bg-nc-bg-purple-dark hover:!bg-nc-bg-purple-light !text-nc-content-purple-dark !border-transparent !h-6"
                type="text"
                @click="onDeselectAll"
              >
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="ncMinusSquare" class="flex-none" />

                  Remove all
                </div>
              </NcButton>
            </div>
          </template>
        </template>
      </AiWizardCard>

      <a-form-item v-if="enableDescription && !aiMode">
        <div class="flex gap-3 text-gray-800 h-7 mt-4 mb-1 items-center justify-between">
          <span class="text-[13px]">
            {{ $t('labels.description') }}
          </span>

          <NcButton type="text" class="!h-6 !w-5" size="xsmall" @click="removeDescription">
            <GeneralIcon icon="delete" class="text-gray-700 w-3.5 h-3.5" />
          </NcButton>
        </div>

        <a-textarea
          ref="descriptionInputEl"
          v-model:value="form.description"
          class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800 max-h-[150px] min-h-[100px]"
          hide-details
          data-testid="create-table-title-input"
          :placeholder="$t('msg.info.enterViewDescription')"
        />
      </a-form-item>

      <div class="flex flex-row w-full justify-between gap-x-2 mt-5">
        <NcButton v-if="!enableDescription && !aiMode" size="small" type="text" @click.stop="toggleDescription">
          <div class="flex !text-gray-700 items-center gap-2">
            <GeneralIcon icon="plus" class="h-4 w-4" />

            <span class="first-letter:capitalize">
              {{ $t('labels.addDescription') }}
            </span>
          </div>
        </NcButton>
        <div v-else></div>
        <div class="flex gap-2 items-center">
          <NcButton type="secondary" size="small" @click="vModel = false">
            {{ $t('general.cancel') }}
          </NcButton>

          <NcButton
            v-if="!aiMode"
            v-e="[form.copy_from_id ? 'a:view:duplicate' : 'a:view:create']"
            :disabled="!isNecessaryColumnsPresent"
            :loading="isViewCreating"
            type="primary"
            size="small"
            @click="onSubmit"
          >
            {{ $t('labels.createView') }}
            <template #loading> {{ $t('labels.creatingView') }}</template>
          </NcButton>
          <NcButton
            v-else
            v-e="[form.copy_from_id ? 'a:view:duplicate' : 'a:view:create']"
            type="primary"
            size="small"
            :disabled="selectedViews.length === 0"
            :loading="aiLoading && calledFunction === 'createViews'"
            @click="onSubmit"
          >
            <div class="flex items-center gap-2 h-5">
              {{
                selectedViews.length
                  ? selectedViews.length > 1
                    ? $t('labels.createViews_plural', {
                        count: selectedViews.length,
                      })
                    : $t('labels.createViews', {
                        count: selectedViews.length,
                      })
                  : $t('labels.createView')
              }}
            </div>
            <template #loading> {{ $t('title.creatingView') }} </template>
          </NcButton>
        </div>
      </div>
    </div>
    <div v-if="!form.copy_from_id" class="nc-nocoai-footer min-h-9">
      <!-- Footer -->
      <div class="nc-ai-wizard-card-footer-branding text-xs">
        {{ $t('general.poweredBy') }}
        <span class="font-semibold !text-inherit"> {{ $t('general.nocoAI') }} </span>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-input-text-area {
  padding-block: 8px !important;
}

.ant-form-item-required {
  @apply !text-gray-800 font-medium;
  &:before {
    @apply !content-[''];
  }
}

.nc-from-select .ant-select-selector {
  @apply !mr-2;
}

.nc-to-select .ant-select-selector {
  @apply !rounded-r-none;
}

.ant-form-item {
  @apply !mb-0;
}

.nc-input-sm {
  @apply !mb-0;
}

.nc-view-create-modal {
  :deep(.nc-modal) {
  }
}

:deep(.ant-form-item-label > label) {
  @apply !text-sm text-gray-800 flex;

  &.ant-form-item-required:not(.ant-form-item-required-mark-optional)::before {
    @apply content-[''] m-0;
  }
}
:deep(.ant-select) {
  .ant-select-selector {
    @apply !rounded-lg;
  }
}

.nc-nocoai-footer {
  @apply px-6 py-1 flex items-center gap-2 text-nc-content-purple-dark border-t-1 border-purple-100;

  .nc-nocoai-settings {
    &:not(:disabled) {
      @apply hover:!bg-nc-bg-purple-light;
    }
    &.nc-ai-loading {
      @apply !cursor-wait;
    }
  }
}
.nc-view-ai-mode {
  .nc-view-input {
    &:not(:focus) {
      @apply !rounded-r-none !border-r-0;

      & ~ .nc-view-ai-toggle-btn {
        button {
          @apply !pl-[7px] z-11 !border-l-1;
        }
      }
    }
  }
}
</style>

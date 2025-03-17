<script lang="ts" setup>
import type { ComponentPublicInstance } from '@vue/runtime-core'
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
  stringToViewTypeMap,
  viewTypeToStringMap,
} from 'nocodb-sdk'
import { UITypes, ViewTypes } from 'nocodb-sdk'
import { AiWizardTabsType } from '#imports'

const props = withDefaults(defineProps<Props>(), {
  selectedViewId: undefined,
  groupingFieldColumnId: undefined,
  geoDataFieldColumnId: undefined,
  calendarRange: undefined,
  coverImageColumnId: undefined,
})

const emits = defineEmits<Emits>()

const maxSelectionCount = 100

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

type AiSuggestedViewType = SerializedAiViewType & {
  selected?: boolean
  tab?: AiWizardTabsType
}

const { $e } = useNuxtApp()

const { metas, getMeta } = useMetas()

const workspaceStore = useWorkspace()

const { viewsByTable } = storeToRefs(useViewsStore())

const { refreshCommandPalette } = useCommandPalette()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { selectedViewId, groupingFieldColumnId, geoDataFieldColumnId, tableId, coverImageColumnId, baseId } = toRefs(props)

const meta = ref<TableType | undefined>()

const inputEl = ref<ComponentPublicInstance>()

const aiPromptInputRef = ref<HTMLElement>()

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

const { aiIntegrationAvailable, aiLoading, aiError, predictViews: _predictViews, createViews } = useNocoAi()

const aiMode = ref(false)

enum AiStep {
  init = 'init',
  pick = 'pick',
}

const aiModeStep = ref<AiStep | null>(null)

const isAIViewCreateMode = computed(() => props.type === 'AI')

const calledFunction = ref<string>()

const prompt = ref<string>('')

const oldPrompt = ref<string>('')

const isPromtAlreadyGenerated = ref<boolean>(false)

const activeAiTabLocal = ref<AiWizardTabsType>(AiWizardTabsType.AUTO_SUGGESTIONS)

const isAiSaving = computed(() => aiLoading.value && calledFunction.value === 'createViews')

const activeAiTab = computed({
  get: () => {
    return activeAiTabLocal.value
  },
  set: (value: AiWizardTabsType) => {
    activeAiTabLocal.value = value

    aiError.value = ''

    if (value === AiWizardTabsType.PROMPT) {
      nextTick(() => {
        aiPromptInputRef.value?.focus()
      })
    }

    if (aiMode.value) {
      $e(`c:view:ai:tab-change:${value}`)
    }
  },
})

const predictedViews = ref<AiSuggestedViewType[]>([])

const activeTabPredictedViews = computed(() => predictedViews.value.filter((t) => t.tab === activeAiTab.value))

const predictHistory = ref<AiSuggestedViewType[]>([])

const activeTabPredictHistory = computed(() => predictHistory.value.filter((t) => t.tab === activeAiTab.value))

const activeTabSelectedViews = computed(() => {
  return predictedViews.value.filter((v) => !!v.selected && v.tab === activeAiTab.value)
})

onBeforeMount(init)

watch(
  () => props.type,
  (newType) => {
    form.type = newType
  },
)

const onAiEnter = async () => {
  calledFunction.value = 'createViews'

  $e('a:view:ai:create')

  if (activeTabSelectedViews.value.length) {
    try {
      const data = await createViews(activeTabSelectedViews.value, baseId.value)

      emits('created', ncIsArray(data) && data.length ? data[0] : undefined)
    } catch (e) {
      message.error(e)
    } finally {
      await refreshCommandPalette()
    }

    vModel.value = false
  }
}

const getDefaultViewMetas = (viewType: ViewTypes) => {
  switch (viewType) {
    case ViewTypes.FORM:
      return {
        submit_another_form: false,
        show_blank_form: false,
        meta: {
          hide_branding: false,
          background_color: '#F9F9FA',
          hide_banner: false,
        },
      }
  }
  return {}
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
          data = await api.dbView.formCreate(tableId.value, {
            ...form,
            ...getDefaultViewMetas(ViewTypes.FORM),
          })
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

const isRangeEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.CALENDAR_VIEW_RANGE))

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
  }

  if (
    [ViewTypes.GALLERY, ViewTypes.KANBAN, ViewTypes.MAP, ViewTypes.CALENDAR].includes(props.type) ||
    aiIntegrationAvailable.value
  ) {
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
          { value: null, label: t('labels.noImage') },
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

const isDisabled = computed(() => {
  return (
    [UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime, UITypes.Formula].includes(
      viewSelectFieldOptions.value.find((f) => f.value === form.calendar_range[0]?.fk_from_column_id)?.uidt,
    ) && !isRangeEnabled.value
  )
})

const onValueChange = async () => {
  form.calendar_range = form.calendar_range.map((range, i) => {
    if (i === 0) {
      return {
        fk_from_column_id: range.fk_from_column_id,
        fk_to_column_id: null,
      }
    }
    return range
  })
}

const predictViews = async (): Promise<AiSuggestedViewType[]> => {
  const viewType =
    !isAIViewCreateMode.value && form.type && viewTypeToStringMap[form.type] ? viewTypeToStringMap[form.type] : undefined

  return (
    await _predictViews(
      tableId.value,
      activeTabPredictHistory.value,
      baseId.value,
      activeAiTab.value === AiWizardTabsType.PROMPT ? prompt.value : undefined,
      viewType,
    )
  )
    .filter((v: AiSuggestedViewType) => !ncIsArrayIncludes(activeTabPredictedViews.value, v.title, 'title'))
    .map((v: AiSuggestedViewType) => {
      return {
        ...v,
        tab: activeAiTab.value,
        selected: false,
      }
    })
}

const predictMore = async () => {
  calledFunction.value = 'predictMore'

  const predictions = await predictViews()

  if (predictions.length) {
    predictedViews.value.push(...predictions)
    predictHistory.value.push(...predictions)
  } else if (!aiError.value) {
    message.info(`No more auto suggestions were found for ${meta.value?.title || 'the current table'}`)
  }
}

const predictRefresh = async () => {
  calledFunction.value = 'predictRefresh'

  const predictions = await predictViews()

  if (predictions.length) {
    predictedViews.value = [...predictedViews.value.filter((t) => t.tab !== activeAiTab.value), ...predictions]
    predictHistory.value.push(...predictions)
  } else if (!aiError.value) {
    message.info(`No auto suggestions were found for ${meta.value?.title || 'the current table'}`)
  }
  aiModeStep.value = AiStep.pick
}

const predictFromPrompt = async () => {
  calledFunction.value = 'predictFromPrompt'

  const predictions = await predictViews()

  if (predictions.length) {
    predictedViews.value = [...predictedViews.value.filter((t) => t.tab !== activeAiTab.value), ...predictions]
    predictHistory.value.push(...predictions)
    oldPrompt.value = prompt.value
  } else if (!aiError.value) {
    message.info('No suggestions were found with the given prompt. Try again after modifying the prompt.')
  }

  aiModeStep.value = AiStep.pick
  isPromtAlreadyGenerated.value = true
}

const onToggleTag = (view: AiSuggestedViewType) => {
  if (
    isAiSaving.value ||
    (!view.selected &&
      (activeTabSelectedViews.value.length >= maxSelectionCount ||
        ncIsArrayIncludes(activeTabSelectedViews.value, view.title, 'title')))
  ) {
    return
  }

  predictedViews.value = predictedViews.value.map((v) => {
    if (v.title === view.title && v.tab === activeAiTab.value) {
      v.selected = !view.selected
    }
    return v
  })
}

const onSelectAll = () => {
  if (activeTabSelectedViews.value.length >= maxSelectionCount) return

  let count = activeTabSelectedViews.value.length

  predictedViews.value = predictedViews.value.map((view) => {
    // Check if the item can be selected
    if (view.tab === activeAiTab.value && !view.selected && count < maxSelectionCount) {
      view.selected = true
      count++
    }
    return view
  })
}

const toggleAiMode = async (from = false) => {
  if (aiMode.value) return

  if (from) {
    $e('c:view:ai:toggle:true')
  }

  formValidator.value?.clearValidate()
  aiError.value = ''

  aiMode.value = true
  aiModeStep.value = AiStep.init
  predictedViews.value = []
  predictHistory.value = []
  prompt.value = ''
  oldPrompt.value = ''
  isPromtAlreadyGenerated.value = false

  if (aiIntegrationAvailable.value) {
    await predictRefresh()
  }
}

const disableAiMode = () => {
  if (isAIViewCreateMode.value) return

  $e('c:view:ai:toggle:false')

  aiMode.value = false
  aiModeStep.value = null
  predictedViews.value = []
  predictHistory.value = []
  prompt.value = ''
  oldPrompt.value = ''
  isPromtAlreadyGenerated.value = false
  activeAiTab.value = AiWizardTabsType.AUTO_SUGGESTIONS

  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

const fullAuto = async (e) => {
  const target = e.target as HTMLElement
  if (
    !aiIntegrationAvailable.value ||
    !isNecessaryColumnsPresent.value ||
    aiLoading.value ||
    aiError.value ||
    target.closest('button, input, .nc-button, textarea')
  ) {
    return
  }

  if (!aiModeStep.value) {
    await toggleAiMode(true)
  } else if (aiModeStep.value === AiStep.pick && activeTabSelectedViews.value.length === 0) {
    await onSelectAll()
  } else if (aiModeStep.value === AiStep.pick && activeTabSelectedViews.value.length > 0) {
    await onAiEnter()
  }
}

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
    form.title = t(`objects.viewType.${typeAlias.value}`)

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

    nextTick(() => {
      const el = inputEl.value?.$el as HTMLInputElement

      if (el) {
        el.focus()
        el.select()
      }
    })
  }
}

const getPluralName = (name: string) => {
  if (aiMode.value) {
    return `${name}Plural`
  }
  return name
}
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    class="nc-view-create-modal !top-[25vh]"
    :show-separator="false"
    size="xs"
    height="auto"
    :centered="false"
    nc-modal-class-name="!p-0"
    wrap-class-name="nc-modal-view-create-wrapper"
  >
    <div class="py-5 flex flex-col gap-5" @dblclick.stop="fullAuto">
      <div class="px-5 flex w-full flex-row justify-between items-center">
        <div class="flex font-bold text-base gap-x-3 items-center">
          <GeneralIcon v-if="isAIViewCreateMode" icon="ncAutoAwesome" class="text-nc-content-purple-dark h-6 w-6" />
          <GeneralViewIcon v-else :meta="{ type: form.type }" class="nc-view-icon !text-[24px] !leading-6 max-h-6 max-w-6" />
          <template v-if="form.type === ViewTypes.GRID">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateGridView') }}
            </template>
            <template v-else>
              {{ $t(`labels.${getPluralName('createGridView')}`) }}
            </template>
          </template>
          <template v-else-if="form.type === ViewTypes.GALLERY">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateGalleryView') }}
            </template>
            <template v-else>
              {{ $t(`labels.${getPluralName('createGalleryView')}`) }}
            </template>
          </template>
          <template v-else-if="form.type === ViewTypes.FORM">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateFormView') }}
            </template>
            <template v-else>
              {{ $t(`labels.${getPluralName('createFormView')}`) }}
            </template>
          </template>
          <template v-else-if="form.type === ViewTypes.KANBAN">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateKanbanView') }}
            </template>
            <template v-else>
              {{ $t(`labels.${getPluralName('createKanbanView')}`) }}
            </template>
          </template>
          <template v-else-if="form.type === ViewTypes.CALENDAR">
            <template v-if="form.copy_from_id">
              {{ $t('labels.duplicateCalendarView') }}
            </template>
            <template v-else>
              {{ $t(`labels.${getPluralName('createCalendarView')}`) }}
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
        <!-- <a
          v-if="!form.copy_from_id"
          class="text-sm !text-gray-600 !font-default !hover:text-gray-600"
          :href="`https://docs.nocodb.com/views/view-types/${typeAlias}`"
          target="_blank"
        >
          Docs
        </a> -->
        <div
          v-if="!isAIViewCreateMode && isNecessaryColumnsPresent && isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)"
          :class="{
            'cursor-wait': aiLoading,
          }"
        >
          <NcButton
            type="text"
            size="small"
            class="-my-1 !text-nc-content-purple-dark hover:text-nc-content-purple-dark"
            :class="{
              '!pointer-events-none !cursor-not-allowed': aiLoading,
              '!bg-nc-bg-purple-dark hover:!bg-gray-100': aiMode,
            }"
            @click.stop="aiMode ? disableAiMode() : toggleAiMode(true)"
          >
            <div class="flex items-center justify-center">
              <GeneralIcon icon="ncAutoAwesome" />
              <span
                class="overflow-hidden trasition-all ease duration-200"
                :class="{ 'w-[0px] invisible': aiMode, 'ml-1 w-[78px]': !aiMode }"
              >
                Use NocoAI
              </span>
            </div>
          </NcButton>
        </div>
      </div>
      <a-form
        v-if="isNecessaryColumnsPresent"
        ref="formValidator"
        :model="form"
        layout="vertical"
        class="flex flex-col gap-y-5"
        :class="{
          '!px-5': !aiMode,
        }"
      >
        <template v-if="!aiMode">
          <a-form-item :rules="viewNameRules" name="title" class="relative">
            <a-input
              ref="inputEl"
              v-model:value="form.title"
              :placeholder="$t('labels.viewName')"
              autofocus
              class="nc-view-input nc-input-sm nc-input-shadow"
              @keydown.enter="onSubmit"
            />
          </a-form-item>

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
            <div
              v-for="(range, index) in form.calendar_range"
              :key="`range-${index}`"
              :class="{
                '!gap-2': range.fk_to_column_id === null,
              }"
              class="flex flex-col w-full gap-6"
            >
              <div class="w-full space-y-2">
                <div class="text-gray-800">
                  {{ $t('labels.organiseBy') }}
                </div>

                <a-select
                  v-model:value="range.fk_from_column_id"
                  class="nc-select-shadow w-full nc-from-select !rounded-lg"
                  dropdown-class-name="!rounded-lg"
                  :placeholder="$t('placeholder.notSelected')"
                  data-testid="nc-calendar-range-from-field-select"
                  @click.stop
                  @change="onValueChange"
                >
                  <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-gray-700" /></template>
                  <a-select-option
                    v-for="(option, id) in [...viewSelectFieldOptions!].filter((f) => {
                  // If the fk_from_column_id of first range is Date, then all the other ranges should be Date
                  // If the fk_from_column_id of first range is DateTime, then all the other ranges should be DateTime
                  if (index === 0) return true
                  const firstRange = viewSelectFieldOptions!.find((f) => f.value === form.calendar_range[0].fk_from_column_id)
                  return firstRange?.uidt === f.uidt
                })"
                    :key="id"
                    :value="option.value"
                  >
                    <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                      <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                        <SmartsheetHeaderIcon :column="option" />

                        <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                          <template #title>
                            {{ option.label }}
                          </template>
                          <template #default>{{ option.label }}</template>
                        </NcTooltip>
                      </div>
                      <GeneralIcon
                        v-if="option.value === range.fk_from_column_id"
                        id="nc-selected-item-icon"
                        icon="check"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </a-select>
              </div>
              <div v-if="isEeUI" class="w-full space-y-2">
                <NcTooltip v-if="range.fk_to_column_id === null" placement="left" :disabled="!isDisabled">
                  <NcButton size="small" type="text" :disabled="isDisabled" @click="range.fk_to_column_id = undefined">
                    <div class="flex items-center gap-1">
                      <component :is="iconMap.plus" class="h-4 w-4" />
                      {{ $t('activity.endDate') }}
                    </div>
                  </NcButton>
                  <template #title> Coming Soon!! Currently, range support is only available for Date field. </template>
                </NcTooltip>

                <template v-else-if="isEeUI">
                  <span class="text-gray-700">
                    {{ $t('activity.withEndDate') }}
                  </span>

                  <div class="flex">
                    <a-select
                      v-model:value="range.fk_to_column_id"
                      class="nc-select-shadow w-full flex-1"
                      allow-clear
                      :disabled="isMetaLoading || isDisabled"
                      :loading="isMetaLoading"
                      :placeholder="$t('placeholder.notSelected')"
                      data-testid="nc-calendar-range-to-field-select"
                      dropdown-class-name="!rounded-lg"
                      @click.stop
                    >
                      <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-gray-700" /></template>

                      <a-select-option
                        v-for="(option, id) in [...viewSelectFieldOptions].filter((f) => {
                          // If the fk_from_column_id of first range is Date, then all the other ranges should be Date
                          // If the fk_from_column_id of first range is DateTime, then all the other ranges should be DateTime

                          const firstRange = viewSelectFieldOptions.find(
                            (f) => f.value === form.calendar_range[0].fk_from_column_id,
                          )
                          return firstRange?.uidt === f.uidt && f.value !== range.fk_from_column_id
                        })"
                        :key="id"
                        :value="option.value"
                      >
                        <div class="w-full flex gap-2 items-center justify-between" :title="option.label">
                          <div class="flex items-center gap-1 max-w-[calc(100%_-_20px)]">
                            <SmartsheetHeaderIcon :column="option" />

                            <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                              <template #title>
                                {{ option.label }}
                              </template>
                              <template #default>{{ option.label }}</template>
                            </NcTooltip>
                          </div>
                          <GeneralIcon
                            v-if="option.value === range.fk_from_column_id"
                            id="nc-selected-item-icon"
                            icon="check"
                            class="flex-none text-primary w-4 h-4"
                          />
                        </div>
                      </a-select-option>
                    </a-select>
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
              </div>
            </div>

            <!--          <NcButton class="mt-2" size="small" type="secondary" @click="addCalendarRange">
            <component :is="iconMap.plus" />
            Add another date field
          </NcButton> -->

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
        <template v-else>
          <!-- Ai view wizard  -->
          <div v-if="!aiIntegrationAvailable" class="flex items-center gap-3 px-5 pt-2.5 pb-4.5">
            <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
            <div class="text-sm text-nc-content-gray-subtle flex-1">{{ $t('title.noAiIntegrationAvailable') }}</div>
          </div>
          <AiWizardTabs v-else v-model:active-tab="activeAiTab">
            <template #AutoSuggestedContent>
              <div class="px-5 pt-5 pb-2">
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

                <div v-else-if="aiModeStep === 'init'">
                  <div class="text-nc-content-purple-light text-sm h-7 flex items-center gap-2">
                    <GeneralLoader size="regular" class="!text-nc-content-purple-dark" />

                    <div class="nc-animate-dots">Auto suggesting views for {{ meta?.title }}</div>
                  </div>
                </div>
                <div v-else-if="aiModeStep === 'pick'" class="flex gap-3 items-start">
                  <div class="flex-1 flex gap-2 flex-wrap">
                    <template v-if="activeTabPredictedViews.length">
                      <template v-for="v of activeTabPredictedViews" :key="v.title">
                        <NcTooltip :disabled="!(activeTabSelectedViews.length >= maxSelectionCount || !!v?.description)">
                          <template #title>
                            <div v-if="activeTabSelectedViews.length >= maxSelectionCount" class="w-[150px]">
                              You can only select {{ maxSelectionCount }} views to create at a time.
                            </div>
                            <div v-else>{{ v?.description }}</div>
                          </template>

                          <a-tag
                            class="nc-ai-suggested-tag"
                            :class="{
                              'nc-disabled': isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount),
                              'nc-selected': v.selected,
                            }"
                            :disabled="activeTabSelectedViews.length >= maxSelectionCount"
                            @click="onToggleTag(v)"
                          >
                            <div class="flex flex-row items-center gap-2 py-[3px] text-small leading-[18px]">
                              <NcCheckbox
                                :checked="v.selected"
                                theme="ai"
                                class="!-mr-0.5"
                                :disabled="isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount)"
                              />

                              <GeneralViewIcon
                                :meta="{ type: stringToViewTypeMap[v.type] }"
                                :class="{
                                  'opacity-60': isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount),
                                }"
                              />

                              <div>{{ v.title }}</div>
                            </div>
                          </a-tag>
                        </NcTooltip>
                      </template>
                    </template>
                    <div v-else class="text-nc-content-gray-subtle2">{{ $t('labels.noData') }}</div>
                  </div>
                  <div class="flex items-center gap-1">
                    <NcTooltip
                      v-if="
                        activeTabPredictHistory.length < activeTabSelectedViews.length
                          ? activeTabPredictHistory.length + activeTabSelectedViews.length < 10
                          : activeTabPredictHistory.length < 10
                      "
                      title="Suggest more"
                      placement="top"
                    >
                      <NcButton
                        v-e="['a:view:ai:predict-more']"
                        size="xs"
                        class="!px-1"
                        type="text"
                        theme="ai"
                        :disabled="isAiSaving"
                        :loading="aiLoading && calledFunction === 'predictMore'"
                        icon-only
                        @click="predictMore"
                      >
                        <template #icon>
                          <GeneralIcon icon="ncPlusAi" class="!text-current" />
                        </template>
                      </NcButton>
                    </NcTooltip>
                    <NcTooltip title="Clear all and Re-suggest" placement="top">
                      <NcButton
                        v-e="['a:view:ai:predict-refresh']"
                        size="xs"
                        class="!px-1"
                        type="text"
                        theme="ai"
                        :disabled="isAiSaving"
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
              <div class="px-5 pt-5 pb-2 flex flex-col gap-5">
                <div class="relative">
                  <a-textarea
                    ref="aiPromptInputRef"
                    v-model:value="prompt"
                    :disabled="isAiSaving"
                    placeholder="Enter your prompt to get view suggestions.."
                    class="nc-ai-input nc-input-shadow !px-3 !pt-2 !pb-3 !text-sm !min-h-[120px] !rounded-lg"
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
                      isAiSaving
                    "
                    :loading="isPredictFromPromptLoading"
                    icon-only
                    @click="
                      () => {
                        $e('a:view:ai:predict-from-prompt', { prompt })
                        predictFromPrompt()
                      }
                    "
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
                  <div class="text-nc-content-purple-dark font-semibold text-xs">Generated Views(s)</div>
                  <div class="flex gap-2 flex-wrap">
                    <template v-if="activeTabPredictedViews.length">
                      <template v-for="v of activeTabPredictedViews" :key="v.title">
                        <NcTooltip :disabled="!(activeTabSelectedViews.length >= maxSelectionCount || !!v?.description)">
                          <template #title>
                            <div v-if="activeTabSelectedViews.length >= maxSelectionCount" class="w-[150px]">
                              You can only select {{ maxSelectionCount }} views to create at a time.
                            </div>
                            <div v-else>{{ v?.description }}</div>
                          </template>

                          <a-tag
                            class="nc-ai-suggested-tag"
                            :class="{
                              'nc-disabled': isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount),
                              'nc-selected': v.selected,
                            }"
                            :disabled="activeTabSelectedViews.length >= maxSelectionCount"
                            @click="onToggleTag(v)"
                          >
                            <div class="flex flex-row items-center gap-2 py-[3px] text-small leading-[18px]">
                              <NcCheckbox
                                :checked="v.selected"
                                theme="ai"
                                class="!-mr-0.5"
                                :disabled="isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount)"
                              />

                              <GeneralViewIcon
                                :meta="{ type: stringToViewTypeMap[v.type] }"
                                :class="{
                                  'opacity-60': isAiSaving || (!v.selected && activeTabSelectedViews.length >= maxSelectionCount),
                                }"
                              />

                              <div>{{ v.title }}</div>
                            </div>
                          </a-tag>
                        </NcTooltip>
                      </template>
                    </template>
                    <div v-else class="text-nc-content-gray-subtle2">{{ $t('labels.noData') }}</div>
                  </div>
                </div>
              </div>
            </template>
          </AiWizardTabs>
        </template>
      </a-form>
      <div v-else-if="!isNecessaryColumnsPresent" class="px-5">
        <div class="flex flex-row p-4 border-gray-200 border-1 gap-x-4 rounded-lg w-full">
          <div class="text-gray-500 flex gap-4">
            <GeneralIcon class="min-w-6 h-6 text-orange-500" icon="alertTriangle" />
            <div class="flex flex-col gap-1">
              <h2 class="font-semibold text-sm mb-0 text-gray-800">Suitable fields not present</h2>
              <span class="text-gray-500 font-default text-sm"> {{ errorMessages[form.type] }}</span>
            </div>
          </div>
        </div>
      </div>

      <a-form-item v-if="enableDescription && !aiMode" class="!px-5">
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

      <div
        class="flex flex-row w-full justify-between gap-x-2 px-5"
        :class="{
          '-mt-2': aiMode,
        }"
      >
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
          <NcButton type="secondary" size="small" :disabled="isAiSaving" @click="vModel = false">
            {{ $t('general.cancel') }}
          </NcButton>

          <NcButton
            v-if="!aiMode"
            v-e="[form.copy_from_id ? 'a:view:duplicate' : 'a:view:create']"
            :disabled="!isNecessaryColumnsPresent || isViewCreating"
            :loading="isViewCreating"
            type="primary"
            size="small"
            @click="onSubmit"
          >
            {{ $t('labels.createView') }}
            <template #loading> {{ $t('labels.creatingView') }}</template>
          </NcButton>
          <NcButton
            v-else-if="aiIntegrationAvailable"
            type="primary"
            size="small"
            theme="ai"
            :disabled="activeTabSelectedViews.length === 0 || isAiSaving"
            :loading="isAiSaving"
            @click="onSubmit"
          >
            <div class="flex items-center gap-2 h-5">
              {{
                activeTabSelectedViews.length
                  ? activeTabSelectedViews.length > 1
                    ? $t('labels.createViews_plural', {
                        count: activeTabSelectedViews.length,
                      })
                    : $t('labels.createViews', {
                        count: activeTabSelectedViews.length,
                      })
                  : $t('labels.createView')
              }}
            </div>
            <template #loading> {{ $t('labels.creatingView') }} </template>
          </NcButton>
          <NcButton v-else type="primary" size="small" @click="handleNavigateToIntegrations"> Add AI integration </NcButton>
        </div>
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

<style lang="scss">
.nc-modal-wrapper.nc-modal-view-create-wrapper {
  .ant-modal-content {
    @apply !rounded-5;
  }
}
:deep(.ant-select) {
  .ant-select-selector {
    @apply !rounded-lg;
  }
}
</style>

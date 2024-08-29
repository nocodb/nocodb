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
  type TableType,
} from 'nocodb-sdk'
import { UITypes, ViewTypes } from 'nocodb-sdk'

interface Props {
  modelValue: boolean
  type: ViewTypes
  title?: string
  selectedViewId?: string
  groupingFieldColumnId?: string
  geoDataFieldColumnId?: string
  description?: string
  tableId: string
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
  type: ViewTypes
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

const props = withDefaults(defineProps<Props>(), {
  selectedViewId: undefined,
  groupingFieldColumnId: undefined,
  geoDataFieldColumnId: undefined,
  calendarRange: undefined,
  coverImageColumnId: undefined,
})

const emits = defineEmits<Emits>()

const { metas, getMeta } = useMetas()

const { viewsByTable } = storeToRefs(useViewsStore())

const { refreshCommandPalette } = useCommandPalette()

const { selectedViewId, groupingFieldColumnId, geoDataFieldColumnId, tableId, coverImageColumnId } = toRefs(props)

const meta = ref<TableType | undefined>()

const inputEl = ref<ComponentPublicInstance>()

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
    }[props.type]),
)

onBeforeMount(init)

watch(
  () => props.type,
  (newType) => {
    form.type = newType
  },
)

function init() {
  form.title = `${capitalize(typeAlias.value)}`

  const repeatCount = views.value.filter((v) => v.title.startsWith(form.title)).length
  if (repeatCount) {
    form.title = `${form.title}-${repeatCount}`
  }
  if (selectedViewId.value) {
    form.copy_from_id = selectedViewId?.value
  }

  nextTick(() => {
    const el = inputEl.value?.$el as HTMLInputElement

    if (el) {
      el.focus()
      el.select()
    }
  })
}

async function onSubmit() {
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
      inputEl.value?.focus()
    }, 100)
  }
}

const isMetaLoading = ref(false)

onMounted(async () => {
  if (form.copy_from_id) {
    enableDescription.value = true
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
    console.log(range)
    const column = viewSelectFieldOptions.value?.find((c) => c.value === range?.fk_from_column_id)
    return !column || ![UITypes.DateTime, UITypes.Date].includes(column.uidt)
  })
}
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    class="nc-view-create-modal"
    :show-separator="false"
    :size="[ViewTypes.MAP].includes(form.type) ? 'medium' : 'small'"
  >
    <template #header>
      <div class="flex w-full flex-row justify-between items-center">
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
    <div class="mt-1">
      <a-form v-if="isNecessaryColumnsPresent" ref="formValidator" :model="form" layout="vertical" class="flex flex-col gap-y-5">
        <a-form-item :rules="viewNameRules" name="title">
          <a-input
            ref="inputEl"
            v-model:value="form.title"
            :placeholder="$t('labels.viewName')"
            autofocus
            class="nc-input-sm nc-input-shadow"
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

      <a-form-item v-if="enableDescription">
        <div class="flex gap-3 text-gray-800 h-7 mt-4 mb-1 items-center justify-between">
          <span class="text-[13px]">
            {{ $t('labels.description') }}
          </span>

          <NcButton type="text" class="!h-6 !w-5" size="xsmall" @click="removeDescription">
            <GeneralIcon icon="delete" class="text-gray-700 w-3.5 h-3.5" />
          </NcButton>
        </div>

        <a-textarea
          ref="inputEl"
          v-model:value="form.description"
          class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800 max-h-[150px] min-h-[100px]"
          hide-details
          data-testid="create-table-title-input"
          :placeholder="$t('msg.info.enterViewDescription')"
        />
      </a-form-item>

      <div class="flex flex-row w-full justify-between gap-x-2 mt-5">
        <NcButton v-if="!enableDescription" size="small" type="text" @click.stop="toggleDescription">
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
</style>

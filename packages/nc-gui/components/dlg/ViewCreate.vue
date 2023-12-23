<script setup lang="ts">
import type {ComponentPublicInstance} from '@vue/runtime-core'
import {capitalize} from '@vue/runtime-core'
import type {Form as AntForm, SelectProps} from 'ant-design-vue'
import {
  CalendarType,
  FormType,
  GalleryType,
  GridType,
  isSystemColumn,
  KanbanType,
  MapType,
  TableType,
  UITypes,
  ViewTypes
} from 'nocodb-sdk'
import {computed, message, nextTick, onBeforeMount, reactive, ref, useApi, useI18n, useVModel, watch} from '#imports'

interface Props {
  modelValue: boolean
  type: ViewTypes
  title?: string
  selectedViewId?: string
  groupingFieldColumnId?: string
  geoDataFieldColumnId?: string
  tableId: string
  calendar_range: Array<{
    fk_from_column_id: string,
    fk_to_column_id: string | null // for ee only
  }>
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void

  (event: 'created', value: GridType | KanbanType | GalleryType | FormType | MapType | CalendarType): void
}

interface Form {
  title: string
  type: ViewTypes
  copy_from_id: string | null
  // for kanban view only
  fk_grp_col_id: string | null
  fk_geo_data_col_id: string | null

  // for calendar view only
  calendar_range: Array<{
    fk_from_column_id: string,
    fk_to_column_id: string | null // for ee only
  }>
}

const props = withDefaults(defineProps<Props>(), {
  selectedViewId: undefined,
  groupingFieldColumnId: undefined,
  geoDataFieldColumnId: undefined,
  calendar_range: undefined,
})

const emits = defineEmits<Emits>()

const { getMeta } = useMetas()

const { viewsByTable } = storeToRefs(useViewsStore())

const { refreshCommandPalette } = useCommandPalette()

const { selectedViewId, groupingFieldColumnId, geoDataFieldColumnId, tableId } = toRefs(props)

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
  calendar_range: ViewTypes.CALENDAR === props.type ? props.calendar_range : [{
    fk_from_column_id: '',
    fk_to_column_id: null
  }],
})

const viewSelectFieldOptions = ref<SelectProps['options']>([])

const viewNameRules = [
  // name is required
  { required: true, message: `${t('labels.viewName')} ${t('general.required')}` },
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
          data = await api.dbView.calendarCreate(tableId.value, form)
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
      refreshCommandPalette()
    }

    vModel.value = false

    setTimeout(() => {
      isViewCreating.value = false
    }, 500)
  }
}

const isMetaLoading = ref(false)

onMounted(async () => {
  if (props.type === ViewTypes.KANBAN || props.type === ViewTypes.MAP || props.type === ViewTypes.CALENDAR) {
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

      // preset the grouping field column
      if (props.type === ViewTypes.KANBAN) {
        viewSelectFieldOptions.value = meta.value
          .columns!.filter((el) => el.uidt === UITypes.SingleSelect)
          .map((field) => {
            return {
              value: field.id,
              label: field.title,
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
      }

      if (props.type === ViewTypes.CALENDAR) {
        viewSelectFieldOptions.value = meta
          .value!.columns!.filter((el) => el.uidt === UITypes.Date || (el.uidt === UITypes.DateTime && !isSystemColumn(el)))
          .map((field) => {
            return {
              value: field.id,
              label: field.title,
            }
          })

        if (viewSelectFieldOptions.value?.length) {
          // take the first option
          form.calendar_range = [{
            fk_from_column_id: viewSelectFieldOptions.value[0].value as string,
            fk_to_column_id: null // for ee only
          }]
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
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :size="[ViewTypes.KANBAN, ViewTypes.MAP, ViewTypes.CALENDAR].includes(form.type) ? 'medium' : 'small'"
  >
    <template #header>
      <div class="flex w-full flex-row justify-between items-center">
        <div class="flex gap-x-1.5 items-center">
        <GeneralViewIcon :meta="{ type: form.type }" class="nc-view-icon !text-xl" />
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
        <a v-if="!form.copy_from_id" href="https://docs.nocodb.com/views/view-types/calendar/" target="_blank"
           class="text-sm !no-underline !hover:text-brand-500 text-brand-500 ">
          Go to Docs
        </a>
      </div>
    </template>
    <div class="mt-2">
      <a-form v-if="isNecessaryColumnsPresent" ref="formValidator" layout="vertical" :model="form">
        <a-form-item name="title" :rules="viewNameRules">
          <a-input
            ref="inputEl"
            v-model:value="form.title"
            class="nc-input-md h-10"
            autofocus
            :placeholder="$t('labels.viewName')"
            @keydown.enter="onSubmit"
          />
        </a-form-item>
        <a-form-item
          v-if="form.type === ViewTypes.KANBAN"
          :label="$t('general.groupingField')"
          name="fk_grp_col_id"
          :rules="groupingFieldColumnRules"
        >
          <NcSelect
            v-model:value="form.fk_grp_col_id"
            class="w-full nc-kanban-grouping-field-select"
            :disabled="isMetaLoading"
            :loading="isMetaLoading"
            :options="viewSelectFieldOptions"
            :placeholder="$t('placeholder.selectGroupField')"
            :not-found-content="$t('placeholder.selectGroupFieldNotFound')"
          />
        </a-form-item>
        <a-form-item
          v-if="form.type === ViewTypes.MAP"
          :label="$t('general.geoDataField')"
          name="fk_geo_data_col_id"
          :rules="geoDataFieldColumnRules"
        >
          <NcSelect
            v-model:value="form.fk_geo_data_col_id"
            class="w-full"
            :options="viewSelectFieldOptions"
            :disabled="isMetaLoading"
            :loading="isMetaLoading"
            :placeholder="$t('placeholder.selectGeoField')"
            :not-found-content="$t('placeholder.selectGeoFieldNotFound')"
          />
        </a-form-item>
        <div v-if="form.type === ViewTypes.CALENDAR"  v-for="range in form.calendar_range" class="flex w-full gap-3">
          <div class="flex flex-col gap-2 w-1/2">
            <span>
              {{ $t('labels.organizeRecordsBy') }}
            </span>
            <NcSelect
                v-model:value="range.fk_from_column_id"
              class="w-full"
              :disabled="isMetaLoading"
              :loading="isMetaLoading"
              :options="viewSelectFieldOptions"
            />
          </div>
          <div v-if="range.fk_to_column_id === null && isEeUI" class="flex flex-col justify-end w-1/2">
            <div class="cursor-pointer flex items-center font-medium gap-1 mb-1"
                 @click="range.fk_to_column_id = ''">
              <component :is="iconMap.plus" class="h-4 w-4"/>
              {{ $t('activity.setEndDate') }}
            </div>

          </div>
          <div v-else-if="isEeUI" class="flex gap-2 flex-col w-1/2">
            <div class="flex flex-row justify-between">
            <span>
              {{ $t('labels.endDateField') }}
            </span>
              <component :is="iconMap.delete" class="h-4 w-4 cursor-pointer text-red-500"
                         @click="() => {
                           range.fk_to_column_id = null
                         }"/>
            </div>
            <NcSelect
                v-model:value="range.fk_to_column_id"
              class="w-full"
              :disabled="isMetaLoading"
              :loading="isMetaLoading"
              :options="viewSelectFieldOptions"
              :placeholder="$t('placeholder.notSelected')"
            />
          </div>
        </div>
      </a-form>
      <div v-else-if="!isNecessaryColumnsPresent" class="flex flex-row p-4 border-gray-200 border-1 gap-x-4 rounded-lg w-full">
        <GeneralIcon icon="warning" class="!text-5xl text-orange-500" />
        <div class="text-gray-500">
          <h2 class="font-semibold text-sm text-gray-800">Suitable fields not present</h2>
          {{ errorMessages[form.type] }}
        </div>
      </div>

      <div class="flex flex-row w-full justify-end gap-x-2 mt-7">
        <NcButton type="secondary" @click="vModel = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          v-e="[form.copy_from_id ? 'a:view:duplicate' : 'a:view:create']"
          type="primary"
          :disabled="!isNecessaryColumnsPresent"
          :loading="isViewCreating"
          @click="onSubmit"
        >
          {{ $t('labels.createView') }}
          <template #loading> {{ $t('labels.creatingView') }}</template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.ant-form-item-required {
  @apply !text-gray-800 font-medium;
  &:before {
    @apply !content-[''];
  }
}
</style>

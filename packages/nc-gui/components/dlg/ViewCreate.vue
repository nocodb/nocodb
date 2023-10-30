<script setup lang="ts">
import type { ComponentPublicInstance } from '@vue/runtime-core'
import type { Form as AntForm, SelectProps } from 'ant-design-vue'
import { capitalize } from '@vue/runtime-core'
import type { FormType, GalleryType, GridType, KanbanType, MapType, TableType } from 'nocodb-sdk'
import { UITypes, ViewTypes } from 'nocodb-sdk'
import { computed, message, nextTick, onBeforeMount, reactive, ref, useApi, useI18n, useVModel, watch } from '#imports'

interface Props {
  modelValue: boolean
  type: ViewTypes
  title?: string
  selectedViewId?: string
  groupingFieldColumnId?: string
  geoDataFieldColumnId?: string
  tableId: string
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'created', value: GridType | KanbanType | GalleryType | FormType | MapType): void
}

interface Form {
  title: string
  type: ViewTypes
  copy_from_id: string | null
  // for kanban view only
  fk_grp_col_id: string | null
  fk_geo_data_col_id: string | null
}

const props = withDefaults(defineProps<Props>(), {
  selectedViewId: undefined,
  groupingFieldColumnId: undefined,
  geoDataFieldColumnId: undefined,
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

const form = reactive<Form>({
  title: props.title || '',
  type: props.type,
  copy_from_id: null,
  fk_grp_col_id: null,
  fk_geo_data_col_id: null,
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
  if (props.type === ViewTypes.KANBAN || props.type === ViewTypes.MAP) {
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
        } else {
          // take the first option
          form.fk_geo_data_col_id = viewSelectFieldOptions.value?.[0]?.value as string
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
        } else {
          // take the first option
          form.fk_grp_col_id = viewSelectFieldOptions.value?.[0]?.value as string
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
  <NcModal v-model:visible="vModel" size="small">
    <template #header>
      <div class="flex flex-row items-center gap-x-1.5">
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
        <template v-else>
          <template v-if="form.copy_from_id">
            {{ $t('labels.duplicateMapView') }}
          </template>
          <template v-else>
            {{ $t('labels.duplicateView') }}
          </template>
        </template>
      </div>
    </template>
    <div class="mt-2">
      <a-form ref="formValidator" layout="vertical" :model="form">
        <a-form-item name="title" :rules="viewNameRules">
          <a-input
            ref="inputEl"
            v-model:value="form.title"
            class="nc-input-md"
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
            :disabled="groupingFieldColumnId || isMetaLoading"
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
            :disabled="groupingFieldColumnId || isMetaLoading"
            :loading="isMetaLoading"
            :placeholder="$t('placeholder.selectGeoField')"
            :not-found-content="$t('placeholder.selectGeoFieldNotFound')"
          />
        </a-form-item>
      </a-form>

      <div class="flex flex-row w-full justify-end gap-x-2 mt-7">
        <NcButton type="secondary" @click="vModel = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          v-e="[form.copy_from_id ? 'a:view:duplicate' : 'a:view:create']"
          type="primary"
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

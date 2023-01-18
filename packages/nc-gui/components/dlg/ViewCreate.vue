<script setup lang="ts">
import type { ComponentPublicInstance } from '@vue/runtime-core'
import type { Form as AntForm, SelectProps } from 'ant-design-vue'
import { capitalize } from '@vue/runtime-core'
import type { FormType, GalleryType, GridType, KanbanType, MapType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, ViewTypes } from 'nocodb-sdk'
import {
  computed,
  generateUniqueTitle,
  message,
  nextTick,
  onBeforeMount,
  reactive,
  ref,
  unref,
  useApi,
  useI18n,
  useVModel,
  watch,
} from '#imports'

interface Props {
  modelValue: boolean
  type: ViewTypes
  title?: string
  selectedViewId?: string
  groupingFieldColumnId?: string
  geoDataFieldColumnId?: string
  views: ViewType[]
  meta: TableType
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

const { views = [], meta, selectedViewId, groupingFieldColumnId, geoDataFieldColumnId, ...props } = defineProps<Props>()

const emits = defineEmits<Emits>()

const inputEl = $ref<ComponentPublicInstance>()

const formValidator = $ref<typeof AntForm>()

const vModel = useVModel(props, 'modelValue', emits)

const { t } = useI18n()

const { isLoading: loading, api } = useApi()

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
        views.every((v1) => ((v1 as GridType | KanbanType | GalleryType | MapType).alias || v1.title) !== v)
          ? resolve(true)
          : reject(new Error(`View name should be unique`))
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
  form.title = generateUniqueTitle(capitalize(ViewTypes[props.type].toLowerCase()), views, 'title')

  if (selectedViewId) {
    form.copy_from_id = selectedViewId
  }

  // preset the grouping field column
  if (props.type === ViewTypes.KANBAN) {
    viewSelectFieldOptions.value = meta
      .columns!.filter((el) => el.uidt === UITypes.SingleSelect)
      .map((field) => {
        return {
          value: field.id,
          label: field.title,
        }
      })

    if (groupingFieldColumnId) {
      // take from the one from copy view
      form.fk_grp_col_id = groupingFieldColumnId
    } else {
      // take the first option
      form.fk_grp_col_id = viewSelectFieldOptions.value?.[0]?.value as string
    }
  }

  if (props.type === ViewTypes.MAP) {
    viewSelectFieldOptions.value = meta
      .columns!.filter((el) => el.uidt === UITypes.GeoData)
      .map((field) => {
        return {
          value: field.id,
          label: field.title,
        }
      })

    if (geoDataFieldColumnId) {
      // take from the one from copy view
      form.fk_geo_data_col_id = geoDataFieldColumnId
    } else {
      // take the first option
      form.fk_geo_data_col_id = viewSelectFieldOptions.value?.[0]?.value as string
    }
  }

  nextTick(() => {
    const el = inputEl?.$el as HTMLInputElement

    if (el) {
      el.focus()
      el.select()
    }
  })
}

async function onSubmit() {
  const isValid = await formValidator?.validateFields()

  if (isValid && form.type) {
    const _meta = unref(meta)

    if (!_meta || !_meta.id) return

    try {
      let data: GridType | KanbanType | GalleryType | FormType | MapType | null = null

      switch (form.type) {
        case ViewTypes.GRID:
          data = await api.dbView.gridCreate(_meta.id, form)
          break
        case ViewTypes.GALLERY:
          data = await api.dbView.galleryCreate(_meta.id, form)
          break
        case ViewTypes.FORM:
          data = await api.dbView.formCreate(_meta.id, form)
          break
        case ViewTypes.KANBAN:
          data = await api.dbView.kanbanCreate(_meta.id, form)
          break
        case ViewTypes.MAP:
          data = await api.dbView.mapCreate(_meta.id, form)
      }

      if (data) {
        // View created successfully
        message.success(t('msg.toast.createView'))

        emits('created', data)
      }
    } catch (e: any) {
      message.error(e.message)
    }

    vModel.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    class="!top-[35%]"
    :class="{ active: vModel }"
    :confirm-loading="loading"
    wrap-class-name="nc-modal-view-create"
  >
    <template #title>
      {{ $t(`general.${selectedViewId ? 'duplicate' : 'create'}`) }} <span class="capitalize">{{ typeAlias }}</span>
      {{ $t('objects.view') }}
    </template>

    <a-form ref="formValidator" layout="vertical" :model="form">
      <a-form-item :label="$t('labels.viewName')" name="title" :rules="viewNameRules">
        <a-input ref="inputEl" v-model:value="form.title" autofocus @keydown.enter="onSubmit" />
      </a-form-item>
      <a-form-item
        v-if="form.type === ViewTypes.KANBAN"
        :label="$t('general.groupingField')"
        name="fk_grp_col_id"
        :rules="groupingFieldColumnRules"
      >
        <a-select
          v-model:value="form.fk_grp_col_id"
          class="w-full nc-kanban-grouping-field-select"
          :options="viewSelectFieldOptions"
          :disabled="groupingFieldColumnId"
          placeholder="Select a Grouping Field"
          not-found-content="No Single Select Field can be found. Please create one first."
        />
      </a-form-item>
      <a-form-item
        v-if="form.type === ViewTypes.MAP"
        :label="$t('general.geoDataField')"
        name="fk_geo_data_col_id"
        :rules="geoDataFieldColumnRules"
      >
        <a-select
          v-model:value="form.fk_geo_data_col_id"
          class="w-full"
          :options="viewSelectFieldOptions"
          :disabled="geoDataFieldColumnId"
          placeholder="Select a GeoData Field"
          not-found-content="No GeoData Field can be found. Please create one first."
        />
      </a-form-item>
    </a-form>

    <template #footer>
      <a-button key="back" @click="vModel = false">{{ $t('general.cancel') }}</a-button>
      <a-button key="submit" type="primary" :loading="loading" @click="onSubmit">{{ $t('general.submit') }}</a-button>
    </template>
  </a-modal>
</template>

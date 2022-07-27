<script setup lang="ts">
import type { ComponentPublicInstance } from '@vue/runtime-core'
import { notification } from 'ant-design-vue'
import type { Form as AntForm } from 'ant-design-vue'
import { capitalize, inject } from '@vue/runtime-core'
import type { FormType, GalleryType, GridType, KanbanType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'
import { useI18n } from 'vue-i18n'
import { MetaInj, ViewListInj } from '~/context'
import { generateUniqueTitle } from '~/utils'
import { computed, nextTick, reactive, unref, useApi, useVModel, watch } from '#imports'

interface Props {
  modelValue: boolean
  type: ViewTypes
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'created', value: GridType | KanbanType | GalleryType | FormType): void
}

interface Form {
  title: string
  type: ViewTypes
  copy_from_id: string | null
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const inputEl = $ref<ComponentPublicInstance>()

const formValidator = $ref<typeof AntForm>()

const vModel = useVModel(props, 'modelValue', emits)

const { t } = useI18n()

const { isLoading: loading, api } = useApi()

const meta = inject(MetaInj)

const viewList = inject(ViewListInj)

const form = reactive<Form>({
  title: '',
  type: props.type,
  copy_from_id: null,
})

const formRules = [
  // name is required
  { required: true, message: `${t('labels.viewName')} ${t('general.required')}` },
  // name is unique
  {
    validator: (_: unknown, v: string) =>
      new Promise((resolve, reject) => {
        ;(unref(viewList) || []).every((v1) => ((v1 as GridType | KanbanType | GalleryType).alias || v1.title) !== v)
          ? resolve(true)
          : reject(new Error(`View name should be unique`))
      }),
    message: 'View name should be unique',
  },
]

const typeAlias = computed(
  () =>
    ({
      [ViewTypes.GRID]: 'grid',
      [ViewTypes.GALLERY]: 'gallery',
      [ViewTypes.FORM]: 'form',
      [ViewTypes.KANBAN]: 'kanban',
    }[props.type]),
)

watch(vModel, (value) => value && init())

watch(
  () => props.type,
  (newType) => (form.type = newType),
)

function init() {
  form.title = generateUniqueTitle(capitalize(ViewTypes[props.type].toLowerCase()), viewList?.value || [], 'title')

  nextTick(() => {
    const el = inputEl?.$el as HTMLInputElement

    if (el) {
      el.focus()
      el.select()
    }
  })
}

async function onSubmit() {
  const isValid = await formValidator.value?.validate()

  if (isValid && form.type) {
    const _meta = unref(meta)

    if (!_meta || !_meta.id) return

    try {
      let data: GridType | KanbanType | GalleryType | FormType | null = null

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
      }

      if (data) {
        notification.success({
          message: 'View created successfully',
        })

        emits('created', data)
      }
    } catch (e: any) {
      notification.error({
        message: e.message,
      })
    }

    vModel.value = false
  }
}
</script>

<template>
  <a-modal v-model:visible="vModel" :confirm-loading="loading">
    <template #title>
      {{ $t('general.create') }} <span class="text-capitalize">{{ typeAlias }}</span> {{ $t('objects.view') }}
    </template>

    <a-form ref="formValidator" layout="vertical" :model="form">
      <a-form-item :label="$t('labels.viewName')" name="title" :rules="formRules">
        <a-input ref="inputEl" v-model:value="form.title" autofocus />
      </a-form-item>
    </a-form>

    <template #footer>
      <a-button key="back" @click="vModel = false">Return</a-button>
      <a-button key="submit" type="primary" :loading="loading" @click="onSubmit">Submit</a-button>
    </template>
  </a-modal>
</template>

<script lang="ts" setup>
import {
  extractSdkResponseErrorMsg,
  message, nextTick,
  onBeforeMount,
  onKeyStroke,
  reactive,
  useApi,
  useI18n,
  useVModel,
} from '#imports'
import type { SectionType } from '~/lib'
import type { ComponentPublicInstance } from '@vue/runtime-core'
import type { Form as AntForm } from 'ant-design-vue/lib/components'

interface Props {
  modelValue: boolean
  section: SectionType
  validate: (section: SectionType, nextName: string) => true | string
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
  (event: 'renamed'): void
}

interface Form {
  name: string
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { t } = useI18n()

const inputEl = $ref<ComponentPublicInstance>()

const formValidator = $ref<typeof AntForm>()

const vModel = useVModel(props, 'modelValue', emits)

const { api, isLoading } = useApi()

onKeyStroke('Escape', () => (vModel.value = false))

const form = reactive<Form>({
  name: '',
})

const sectionNameRules = [
  // name is required
  { required: true, message: `${t('labels.sectionName')} ${t('general.required')}` },
  // name is unique
  {
    validator: async (_: unknown, v: string) => {
      const validationResult = props.validate(props.section, v)
      if (validationResult === true) return true
      throw new Error(validationResult)
    },
    message: 'Section name should be unique',
  },
]

onBeforeMount(init)

function init() {
  form.name = props.section.name

  nextTick(() => {
    const el = inputEl?.$el as HTMLInputElement

    if (el) {
      el.focus()
      el.select()
    }
  })
}

/** Rename a section */
async function onSubmit() {
  const isValid = await formValidator?.validateFields()
  if (!isValid) return

  try {
    for (const view of props.section.views) {
      await api.dbView.update(view.id!, { section: form.name })
    }

    // Section renamed successfully
    message.success(t('msg.success.sectionRenamed'))

    vModel.value = false

    emits('renamed')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    class="!top-[35%]"
    :class="{ active: vModel }"
    :confirm-loading="isLoading"
    wrap-class-name="nc-modal-section-rename"
  >
    <template #title> {{ $t('general.rename') }} {{ $t('objects.section') }} </template>

    <a-form ref="formValidator" layout="vertical" :model="form">
      <a-form-item :label="$t('labels.sectionName')" name="name" :rules="sectionNameRules">
        <a-input ref="inputEl" v-model:value="form.name" autofocus @keydown.enter="onSubmit" />
      </a-form-item>
    </a-form>

    <template #footer>
      <a-button key="back" @click="vModel = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" :loading="isLoading" @click="onSubmit" @keydown.enter="onSubmit">
        {{ $t('general.submit') }}
      </a-button>
    </template>
  </a-modal>
</template>

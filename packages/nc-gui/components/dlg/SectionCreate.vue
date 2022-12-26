<script setup lang="ts">
import type { ComponentPublicInstance } from '@vue/runtime-core'
import type { Form as AntForm } from 'ant-design-vue'
import { generateUniqueTitle, nextTick, onBeforeMount, reactive, useI18n, useVModel } from '#imports'
import type { SectionType } from '~/lib'

interface Props {
  sections: SectionType[]
  modelValue: boolean
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void

  (event: 'created', value: string): void
}

interface Form {
  name: string
}

const { sections = [], ...props } = defineProps<Props>()

const emits = defineEmits<Emits>()

const inputEl = $ref<ComponentPublicInstance>()

const formValidator = $ref<typeof AntForm>()

const vModel = useVModel(props, 'modelValue', emits)

const { t } = useI18n()

const form = reactive<Form>({
  name: '',
})

const sectionNameRules = [
  // name is required
  { required: true, message: `${t('labels.sectionName')} ${t('general.required')}` },
  // name is unique
  {
    validator: (_: unknown, v: string) =>
      new Promise((resolve, reject) => {
        sections.every((s1) => s1.name !== v)
          ? resolve(true)
          : reject(new Error(`Section name should be unique`))
      }),
    message: 'Section name should be unique',
  },
]

onBeforeMount(init)

function init() {
  form.name = generateUniqueTitle(
    'Section',
    sections.map((s) => ({ ...s, name: `${s.name}` })),
    'name',
  )

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

  if (isValid) {
    emits('created', form.name)

    vModel.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    class="!top-[35%]"
    :class="{ active: vModel }"
    wrap-class-name="nc-modal-section-create"
  >
    <template #title>
      {{ $t('general.create') }} <span class="capitalize">section</span>
      {{ $t('objects.section') }}
    </template>

    <a-form ref="formValidator" layout="vertical" :model="form">
      <a-form-item :label="$t('labels.sectionName')" name="name" :rules="sectionNameRules">
        <a-input ref="inputEl" v-model:value="form.name" autofocus @keydown.enter="onSubmit" />
      </a-form-item>
    </a-form>

    <template #footer>
      <a-button key="back" @click="vModel = false">{{ $t('general.cancel') }}</a-button>
      <a-button key="submit" type="primary" @click="onSubmit">{{ $t('general.submit') }}</a-button>
    </template>
  </a-modal>
</template>

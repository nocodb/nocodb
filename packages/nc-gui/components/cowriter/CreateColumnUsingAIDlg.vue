<script setup lang="ts">
import { message } from 'ant-design-vue'
import type { VNodeRef } from '@vue/runtime-core'
import { Form, extractSdkResponseErrorMsg, fieldRequiredValidator, ref, useVModel } from '#imports'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue', 'success'])

const dialogShow = useVModel(props, 'modelValue', emit)

const formState = ref({
  title: '',
})

const useForm = Form.useForm

const validators = computed(() => {
  return {
    title: [fieldRequiredValidator()],
  }
})

const { validate, validateInfos } = useForm(formState, validators)

const inputEl: VNodeRef = (el) => {
  ;(el as HTMLInputElement)?.focus()
}

const { generateAIColumns, generateColumnBtnLoading } = useCowriterStoreOrThrow()

watch(dialogShow, (val) => {
  if (!val) {
    formState.value = {
      title: '',
    }
  }
})

async function createColumn() {
  try {
    await validate()
  } catch (e: any) {
    e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
    if (e.errorFields.length) return
  }
  try {
    generateColumnBtnLoading.value = true
    await generateAIColumns(formState.value.title)
    emit('success')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    generateColumnBtnLoading.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    width="max(30vw, 600px)"
    centered
    wrap-class-name="nc-modal-cowriter-create-column"
    @keydown.esc="dialogShow = false"
  >
    <template #footer>
      <a-button key="back" size="large" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" size="large" type="primary" :loading="generateColumnBtnLoading" @click="createColumn">
        {{ $t('general.create') }}
      </a-button>
    </template>

    <div class="pl-10 pr-10 pt-5">
      <a-form :model="formState" name="create-new-workspace-form" @keydown.enter="createColumn">
        <div class="prose-xl font-bold self-center my-4">
          <div class="flex items-center py-3">
            <GeneralIcon icon="magic" class="mr-2 text-orange-400" />
            Add New Column Using AI for
          </div>
        </div>

        <a-form-item v-bind="validateInfos.title">
          <a-input
            :ref="inputEl"
            v-model:value="formState.title"
            size="large"
            hide-details
            data-testid="create-workspace-title-input"
            placeholder="GPT Name"
          />
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { InputPassword } from 'ant-design-vue'
import { extractSdkResponseErrorMsg, message, ref, useRoute, useSharedView, useVModel } from '#imports'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const route = useRoute()

const { loadSharedView } = useSharedView()

const formState = ref({ password: undefined })

const onFinish = async () => {
  try {
    await loadSharedView(route.params.viewId as string, formState.value.password)
    vModel.value = false
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const focus: VNodeRef = (el: typeof InputPassword) => el?.$el?.querySelector('input').focus()
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :closable="false"
    width="28rem"
    centered
    :footer="null"
    :mask-closable="false"
    wrap-class-name="nc-modal-shared-view-password-dlg"
    @close="vModel = false"
  >
    <div class="w-full flex flex-col">
      <a-typography-title :level="4">This shared view is protected</a-typography-title>

      <a-form ref="formRef" :model="formState" class="mt-2" @finish="onFinish">
        <a-form-item name="password" :rules="[{ required: true, message: 'Password is required' }]">
          <a-input-password :ref="focus" v-model:value="formState.password" placeholder="Enter password" />
        </a-form-item>

        <a-button type="primary" html-type="submit">Unlock</a-button>
      </a-form>
    </div>
  </a-modal>
</template>

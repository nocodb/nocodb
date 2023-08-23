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
  <NcModal v-model:visible="vModel" c size="small" :class="{ active: vModel }" :mask-closable="false">
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        <GeneralIcon icon="key" />
        This shared view is protected
      </div>
    </template>

    <div class="mt-2">
      <a-form ref="formRef" :model="formState" name="create-new-table-form" @finish="onFinish">
        <a-form-item name="password" :rules="[{ required: true, message: 'Password is required' }]">
          <a-input-password
            ref="focus"
            v-model:value="formState.password"
            class="nc-input-md"
            hide-details
            size="large"
            placeholder="Enter password"
          />
        </a-form-item>
      </a-form>
      <div class="flex flex-row justify-end gap-x-2 mt-6">
        <NcButton type="primary" html-type="submit" @click="onFinish"
          >Unlock
          <template #loading> Verifying Password </template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

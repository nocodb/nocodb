<script setup lang="ts">
import { notification } from 'ant-design-vue'
import { extractSdkResponseErrorMsg } from '~/utils'
const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])
interface Props {
  modelValue: boolean
}

const route = useRoute()
const { loadSharedView } = useSharedView()

const formState = ref({ password: undefined })
const vModel = useVModel(props, 'modelValue', emit)

const onFinish = async () => {
  try {
    await loadSharedView(route.params.viewId as string, formState.value.password)
    vModel.value = false
  } catch (e: any) {
    console.error(e)
    notification.error({
      message: await extractSdkResponseErrorMsg(e),
    })
  }
}
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    :closable="false"
    width="28rem"
    centered
    :footer="null"
    :mask-closable="false"
    @close="vModel = false"
  >
    <div class="w-full flex flex-col">
      <a-typography-title :level="4">This shared view is protected</a-typography-title>
      <a-form ref="formRef" :model="formState" class="mt-2" @finish="onFinish">
        <a-form-item name="password" :rules="[{ required: true, message: 'Password is required' }]">
          <a-input-password v-model:value="formState.password" placeholder="Enter password" />
        </a-form-item>
        <a-button type="primary" html-type="submit">Unlock</a-button>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped lang="scss"></style>

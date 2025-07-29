<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { InputPassword } from 'ant-design-vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const dashboardStore = useDashboardStore()

const route = useRoute()

const { loadSharedDashboard } = dashboardStore

const vModel = useVModel(props, 'modelValue', emit)

const formState = ref({ password: undefined })

const passwordError = ref<string | null>(null)

const onFinish = async () => {
  try {
    await loadSharedDashboard(route.params.dashboardId as string, formState.value.password)
    vModel.value = false
  } catch (e: any) {
    const error = await extractSdkResponseErrorMsgv2(e)
    console.error(error.message)

    if (error.error === NcErrorType.INVALID_SHARED_DASHBOARD_PASSWORD) {
      passwordError.value = error.message
    } else {
      message.error(error.message)
    }
  }
}

const focus: VNodeRef = (el: typeof InputPassword) => {
  return el?.focus?.()
}
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    size="small"
    :class="{ active: vModel }"
    :mask-closable="false"
    :mask-style="{
      backgroundColor: 'rgba(255, 255, 255, 0.64)',
      backdropFilter: 'blur(8px)',
    }"
  >
    <div class="flex flex-col gap-5">
      <div class="flex flex-row items-center gap-x-2 text-base font-weight-700 text-gray-800">
        <GeneralIcon icon="ncKey" class="!text-base w-5 h-5" />
        {{ $t('msg.thisSharedDashboardIsProtected') }}
      </div>

      <a-form ref="formRef" :model="formState" name="create-new-table-form" @finish="onFinish">
        <a-form-item
          name="password"
          :rules="[{ required: true, message: $t('msg.error.signUpRules.passwdRequired') }]"
          class="!mb-0"
        >
          <a-input-password
            :ref="focus"
            v-model:value="formState.password"
            class="!rounded-lg !text-small"
            hide-details
            :placeholder="$t('msg.enterPassword')"
            @input="passwordError = null"
          />
          <Transition name="layout">
            <div v-if="passwordError" class="mt-3 mb-2 text-sm text-red-500">{{ passwordError }}</div>
          </Transition>
        </a-form-item>
      </a-form>
      <div class="flex flex-row justify-end gap-x-2">
        <NcButton
          :disabled="!formState.password"
          type="primary"
          size="small"
          html-type="submit"
          class="!px-2"
          data-testid="nc-shared-dashboard-password-submit-btn"
          @click="onFinish"
        >
          {{ $t('objects.view') }}
          <template #loading> {{ $t('msg.verifyingPassword') }}</template>
        </NcButton>
      </div>
    </div>
  </NcModal>

  <img alt="view image" src="~/assets/img/views/grid.png" class="fixed inset-0 w-full h-full" />
</template>

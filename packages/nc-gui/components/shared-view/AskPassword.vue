<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { InputPassword } from 'ant-design-vue'
import { ViewTypes } from 'nocodb-sdk'
import gridImage from '~/assets/img/views/grid.png'
import galleryImage from '~/assets/img/views/gallery.png'
import kanbanImage from '~/assets/img/views/kanban.png'
import calendarImage from '~/assets/img/views/calendar.png'

const props = defineProps<{
  modelValue: boolean
  viewType?: ViewTypes
}>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const route = useRoute()

const { loadSharedView } = useSharedView()

const formState = ref({ password: undefined })

const passwordError = ref<string | null>(null)

const onFinish = async () => {
  try {
    await loadSharedView(route.params.viewId as string, formState.value.password)
    vModel.value = false
  } catch (e: any) {
    const error = await extractSdkResponseErrorMsgv2(e)
    console.error(error.message)

    if (error.error === NcErrorType.INVALID_SHARED_VIEW_PASSWORD) {
      passwordError.value = error.message
    } else {
      message.error(error.message)
    }
  }
}

const focus: VNodeRef = (el: typeof InputPassword) => {
  return el && el?.focus?.()
}

const bgImageName = computed(() => {
  switch (props.viewType) {
    case ViewTypes.GRID:
      return gridImage
    case ViewTypes.GALLERY:
      return galleryImage
    case ViewTypes.KANBAN:
      return kanbanImage
    case ViewTypes.CALENDAR:
      return calendarImage
    default:
      return gridImage
  }
})
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    c
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
        {{ $t('msg.thisSharedViewIsProtected') }}
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
            <div v-if="passwordError" class="mb-2 text-sm text-red-500">{{ passwordError }}</div>
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
          data-testid="nc-shared-view-password-submit-btn"
          @click="onFinish"
        >
          {{ $t('objects.view') }}
          <template #loading> {{ $t('msg.verifyingPassword') }}</template>
        </NcButton>
      </div>
    </div>
  </NcModal>

  <img alt="view image" :src="bgImageName" class="fixed inset-0 w-full h-full" />
</template>

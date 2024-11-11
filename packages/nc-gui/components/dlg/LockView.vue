<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { ViewType } from 'nocodb-sdk'
import { LockType } from '#imports'

const props = defineProps<{
  modelValue: boolean
  view?: ViewType
  changeType?: LockType
}>()

const emits = defineEmits(['update:modelValue', 'submit'])

const dialogShow = useVModel(props, 'modelValue', emits)

const { $api } = useNuxtApp()

const { user } = useGlobal()

const { idUserMap } = storeToRefs(useBase())

const { activeView } = storeToRefs(useViewsStore())

const view = computed(() => props.view || activeView.value)

const changeType = computed(() =>
  view.value?.lock_type !== LockType.Locked ? LockType.Locked : props.changeType || LockType.Collaborative,
)

const focusInput: VNodeRef = (el) => el && el?.focus?.()

const description = ref('')

const isLoading = ref(false)

const changeLockType = async () => {
  if (!view.value) return
  const payload = {
    lockedViewDescription: changeType.value === LockType.Locked ? description.value : '',
    lockedByUserId: changeType.value === LockType.Locked ? user.value?.id : '',
  }

  isLoading.value = true

  try {
    await $api.dbView.update(view.value.id as string, {
      lock_type: changeType.value,
      meta: {
        ...parseProp(view.value.meta),
        ...payload,
      },
    })

    view.value.meta = {
      ...parseProp(view.value.meta),
      ...payload,
    }

    view.value.lock_type = changeType.value

    message.success(`Successfully Switched to ${changeType.value} view`)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    dialogShow.value = false
    isLoading.value = false
  }
}

watch(dialogShow, (newValue) => {
  if (!newValue) {
    description.value = ''
  }
})
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.createTable')"
    size="small"
    @keydown.esc="dialogShow = false"
  >
    <template v-if="changeType === LockType.Locked" #header>
      <div class="flex flex-col gap-2 w-full">
        <div class="text-base font-bold text-nc-content-gray-emphasis">
          {{ $t('title.lockThisView') }}
        </div>
        <div class="text-sm text-nc-content-gray">
          {{ $t('title.lockThisViewSubtle') }}
        </div>
      </div>
    </template>

    <a-form
      layout="vertical"
      name="create-new-table-form"
      class="flex flex-col gap-5 !mt-1"
      @keydown.enter="emits('submit')"
      @keydown.esc="dialogShow = false"
    >
      <div v-if="changeType === LockType.Locked" class="flex flex-col gap-5">
        <a-form-item>
          <a-textarea
            :ref="focusInput"
            v-model:value="description"
            class="!rounded-lg !text-sm nc-input-shadow !min-h-[120px] max-h-[500px] nc-scrollbar-thin"
            size="large"
            hide-details
            data-testid="lock-view-description-input"
            :placeholder="$t('placeholder.lockViewDescription')"
          />
        </a-form-item>
      </div>
      <div v-else class="flex flex-col gap-2">
        <div class="text-base font-bold text-nc-content-gray-emphasis">
          {{ $t('title.unlockViewTitle') }}
        </div>
        <div v-if="view?.meta?.lockedViewDescription" class="text-sm bg-nc-bg-gray-light rounded-lg px-2 py-2">
          {{ view?.meta?.lockedViewDescription }}
        </div>
        <div class="text-sm text-nc-content-gray">
          {{ $t('title.unlockViewTitleSubtitle') }}
          <span class="font-bold">
            {{ idUserMap[view?.meta?.lockedByUserId]?.display_name || idUserMap[view?.meta?.lockedByUserId]?.email }}
          </span>
        </div>
      </div>

      <div class="flex gap-2 items-center justify-end">
        <NcButton type="secondary" size="small" :disabled="isLoading" @click="dialogShow = false">{{
          $t('general.cancel')
        }}</NcButton>

        <NcButton type="primary" size="small" :loading="isLoading" :disabled="isLoading" @click="changeLockType">
          <template #icon>
            <GeneralIcon :icon="changeType === LockType.Locked ? 'ncLock' : 'ncUnlock'" class="flex-none" />
          </template>
          {{ changeType === LockType.Locked ? $t('labels.lockView') : $t('labels.unlockView') }}
        </NcButton>
      </div>
    </a-form>
  </NcModal>
</template>

<style scoped lang="scss">
.ant-form-item {
  @apply mb-0;
}
</style>

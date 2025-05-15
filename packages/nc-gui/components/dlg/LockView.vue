<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { ViewType } from 'nocodb-sdk'
import { viewTypeAlias } from 'nocodb-sdk'
import { LockType } from '#imports'

const props = defineProps<{
  modelValue?: boolean
  view?: ViewType
  changeType?: LockType
}>()

const emits = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emits, { defaultValue: false })

const isForm = inject(IsFormInj, ref(false))

const { $api, $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const { user } = useGlobal()

const { idUserMap } = storeToRefs(useBase())

const { activeView } = storeToRefs(useViewsStore())

const view = computed(() => props.view || activeView.value)

const changeType = computed(() =>
  view.value?.lock_type !== LockType.Locked ? LockType.Locked : props.changeType || LockType.Collaborative,
)

const focusInput: VNodeRef = (el) => el && el?.focus?.()

const formValidator = ref()

const isErrored = ref(false)

const form = reactive({
  description: '',
})

const formRules = {
  description: [{ max: 1000, message: 'Value must be at most 1000 characters long' }],
}

const isLoading = ref(false)

const changeLockType = async () => {
  if (!view.value) return

  if (changeType.value === LockType.Locked) {
    const valid = await formValidator.value.validate()

    if (!valid) return
  }

  const payload = {
    lockedViewDescription: changeType.value === LockType.Locked ? form.description : '',
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

    message.success(`Successfully Switched to ${view.value.lock_type} view`)

    $e(`a:${viewTypeAlias[view.value.type] || 'view'}:lock`, { lockType: view.value.lock_type, title: view.value.title })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    dialogShow.value = false
    isLoading.value = false
  }
}

onKeyStroke('Enter', () => {
  if (isLoading.value || !dialogShow.value || isForm.value || !(changeType.value !== LockType.Locked)) return

  changeLockType()
})

watch(dialogShow, (newValue) => {
  if (!newValue) {
    form.description = ''
    isErrored.value = false
  }
})

watch(
  () => form.description,
  async () => {
    if (changeType.value !== LockType.Locked) return

    try {
      isErrored.value = !(await formValidator.value.validate())
    } catch (e: any) {
      isErrored.value = true
    }
  },
)
</script>

<template>
  <div v-if="isForm" class="nc-unlock-view-wrapper rounded-2xl bg-white p-6 w-full max-w-[384px] flex flex-col gap-5">
    <div class="flex flex-col gap-2">
      <div class="text-base font-bold text-nc-content-gray-emphasis">
        {{ $t('title.thisFormIsLocked') }}
      </div>
      <div v-if="view?.meta?.lockedViewDescription" class="text-sm bg-nc-bg-gray-light rounded-lg px-2 py-2">
        {{ view?.meta?.lockedViewDescription }}
      </div>
      <div class="text-sm text-nc-content-gray">{{ $t('title.unlockThisVieToMakeChanges') }}</div>
      <div class="text-sm text-nc-content-gray">
        {{ $t('title.unlockViewTitleSubtitle') }}
        <span v-if="idUserMap[view?.meta?.lockedByUserId]?.id === user.id" class="font-bold"> {{ $t('general.you') }} </span>
        <span v-else class="font-bold">
          {{ idUserMap[view?.meta?.lockedByUserId]?.display_name || idUserMap[view?.meta?.lockedByUserId]?.email }}
        </span>
      </div>
    </div>

    <NcButton
      v-if="isUIAllowed('fieldAdd')"
      type="secondary"
      size="small"
      class="!w-full"
      :loading="isLoading"
      :disabled="isLoading"
      @click="changeLockType"
    >
      <template #icon>
        <GeneralIcon icon="ncUnlock" class="flex-none" />
      </template>
      {{ $t('labels.unlockView') }}
    </NcButton>
  </div>
  <NcModal
    v-else
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.createTable')"
    size="small"
    wrap-class-name="nc-lock-view-modal-wrapper"
    @keydown.esc="dialogShow = false"
  >
    <template v-if="changeType === LockType.Locked" #header>
      <div class="flex flex-col gap-2 w-full">
        <div class="text-base font-bold text-nc-content-gray-emphasis">
          {{ $t('title.lockThisView') }}
        </div>
        <div class="text-sm font-normal text-nc-content-gray-subtle">
          {{ $t('title.lockThisViewSubtle') }}
        </div>
      </div>
    </template>

    <a-form
      ref="formValidator"
      :model="form"
      layout="vertical"
      name="create-new-table-form"
      class="flex flex-col gap-5 !mt-1 font-normal"
      @finish="changeLockType"
    >
      <div v-if="changeType === LockType.Locked" class="flex flex-col gap-5">
        <a-form-item name="description" :rules="formRules.description">
          <a-textarea
            :ref="focusInput"
            v-model:value="form.description"
            class="!rounded-lg !text-sm nc-input-shadow !min-h-[120px] max-h-[500px] nc-scrollbar-thin"
            size="large"
            hide-details
            data-testid="nc-lock-view-description-input"
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
          <span v-if="idUserMap[view?.meta?.lockedByUserId]?.id === user.id" class="font-bold"> {{ $t('general.you') }} </span>
          <span v-else class="font-bold">
            {{ idUserMap[view?.meta?.lockedByUserId]?.display_name || idUserMap[view?.meta?.lockedByUserId]?.email }}
          </span>
        </div>
      </div>

      <div class="flex gap-2 items-center justify-end">
        <NcButton type="secondary" size="small" :disabled="isLoading" data-testid="nc-cancel-btn" @click="dialogShow = false">{{
          $t('general.cancel')
        }}</NcButton>

        <NcButton
          type="primary"
          html-type="submit"
          size="small"
          :loading="isLoading"
          :disabled="isLoading || isErrored"
          data-testid="nc-lock-or-unlock-btn"
        >
          <template #icon>
            <GeneralIcon :icon="changeType === LockType.Locked ? 'ncLock' : 'ncUnlock'" class="flex-none" />
          </template>
          <div
            class="flex"
            :class="{
              '-ml-1': !isLoading,
            }"
          >
            {{ changeType === LockType.Locked ? $t('labels.lockView') : $t('labels.unlockView') }}
          </div>
        </NcButton>
      </div>
    </a-form>
  </NcModal>
</template>

<style scoped lang="scss">
.ant-form-item {
  @apply mb-0;
}

.nc-unlock-view-wrapper {
  box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1);
}
</style>

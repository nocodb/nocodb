<script setup lang="ts">
import dayjs from 'dayjs'
import { useSyncFormOrThrow } from '../useSyncForm'

const { syncConfigForm } = useSyncFormOrThrow()

const { activeProjectId, basesUser } = storeToRefs(useBases())

const baseUsersMap = computed(() => {
  if (!activeProjectId.value) return {}

  return (basesUser.value.get(activeProjectId.value) || []).reduce((acc, user) => {
    acc[user.id] = user
    acc[user.email] = user
    return acc
  }, {} as Record<string, User>)
})
</script>

<template>
  <div>
    <div class="text-nc-content-gray text-captionBold font-semibold mb-3">
      {{ $t('title.additionalDetails') }}
    </div>

    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
          {{ $t('labels.createdOn') }}
        </div>
        <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
          {{ dayjs(syncConfigForm.created_at).format('DD MMMM YYYY, h:mm A') }}
        </div>
      </div>

      <div v-if="syncConfigForm.updated_at" class="flex items-center justify-between">
        <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
          {{ $t('labels.lastModified') }}
        </div>
        <div class="text-nc-content-gray-subtle2 text-bodyDefaultSm">
          {{ dayjs(syncConfigForm.updated_at).format('DD MMMM YYYY, h:mm A') }}
        </div>
      </div>

      <div v-if="syncConfigForm.created_by && baseUsersMap[syncConfigForm.created_by]" class="flex flex-col gap-2">
        <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
          {{ $t('labels.createdBy') }}
        </div>

        <NcUserInfo :user="baseUsersMap[syncConfigForm.created_by]" />
      </div>
      <div v-if="syncConfigForm.updated_by && baseUsersMap[syncConfigForm.updated_by]" class="flex flex-col gap-2">
        <div class="text-nc-content-gray text-bodyDefaultSmBold font-semibold">
          {{ $t('labels.lastModifiedBy') }}
        </div>

        <NcUserInfo :user="baseUsersMap[syncConfigForm.updated_by]" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-user-info .nc-user-info-name) {
  @apply text-nc-content-gray-subtle;
}
</style>

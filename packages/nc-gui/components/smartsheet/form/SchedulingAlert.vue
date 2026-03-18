<script setup lang="ts">
import dayjs from 'dayjs'

interface Props {
  startsAt?: string | null
  expiresAt?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  startsAt: null,
  expiresAt: null,
})

const { startsAt, expiresAt } = toRefs(props)

const { t } = useI18n()

const { showEEFeatures, blockFormScheduling } = useEeConfig()

const status = computed(() => {
  if (!showEEFeatures.value || blockFormScheduling.value) return null

  const now = dayjs.utc()

  if (startsAt.value && dayjs.utc(startsAt.value).isAfter(now)) {
    return 'not-started'
  }

  if (expiresAt.value && dayjs.utc(expiresAt.value).isBefore(now)) {
    return 'expired'
  }

  return null
})

const formattedDate = computed(() => {
  const value = status.value === 'not-started' ? startsAt.value : expiresAt.value
  if (!value) return ''
  return dayjs.utc(value).local().format('MMM D, YYYY · h:mm A')
})

const alertMessage = computed(() => {
  return status.value === 'expired' ? t('labels.formExpired') : t('labels.formNotStarted')
})

const alertDescription = computed(() => {
  return status.value === 'expired' ? t('labels.formExpiredSubtext') : t('labels.formNotStartedSubtext')
})

const dateLabel = computed(() => {
  return status.value === 'not-started' ? t('labels.formStartDate') : t('labels.formExpirationDate')
})
</script>

<template>
  <NcAlert v-if="status" type="info" show-icon background :message="alertMessage">
    <template #description>
      <div class="flex flex-col gap-2">
        <span class="text-nc-content-gray-subtle">{{ alertDescription }}</span>
        <div v-if="formattedDate" class="flex items-center gap-2">
          <GeneralIcon icon="calendar" class="w-3.5 h-3.5 text-nc-content-gray-subtle2 flex-none" />
          <span class="text-xs text-nc-content-gray-subtle2">{{ dateLabel }}:</span>
          <span class="text-xs font-semibold text-nc-content-gray">{{ formattedDate }}</span>
        </div>
      </div>
    </template>
  </NcAlert>
</template>

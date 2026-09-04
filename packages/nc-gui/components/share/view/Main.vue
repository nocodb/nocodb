<script lang="ts" setup>
const popover = useShareViewPopover()!

const { isPublicShared, url, isUpdating, isReadOnly, isFormView, toggleShare, goTo } = popover

const isOpeningEmbed = ref(false)

const openEmbed = async () => {
  if (isOpeningEmbed.value || isReadOnly.value) return
  isOpeningEmbed.value = true
  try {
    // Embedding requires a public link — share the view first if it isn't already.
    if (!isPublicShared.value) {
      await toggleShare()
    }
    const target = url.value
    if (!target) return
    window.open(`${target.replace(/\/$/, '')}/embed`, '_blank', 'noopener,noreferrer')
  } finally {
    isOpeningEmbed.value = false
  }
}

const { t } = useI18n()

const toggleDescription = computed(() => {
  if (isPublicShared.value) {
    return isFormView.value ? t('activity.shareFormToWebDescriptionOn') : t('activity.shareViewToWebDescriptionOn')
  }
  return isFormView.value ? t('activity.shareFormToWebDescription') : t('activity.shareViewToWebDescription')
})

const onRowClick = (event: MouseEvent) => {
  if (isReadOnly.value || isUpdating.value.public) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, .ant-switch')) return
  toggleShare()
}
</script>

<template>
  <div class="flex flex-col">
    <div
      class="flex items-start gap-3 px-4 py-2.5 transition-colors"
      :class="{
        'cursor-pointer hover:bg-nc-bg-gray-extralight': !isReadOnly && !isUpdating.public,
      }"
      @click="onRowClick"
    >
      <NcSwitch
        v-e="['c:share:view:enable:toggle']"
        :checked="isPublicShared"
        :loading="isUpdating.public"
        :disabled="isReadOnly"
        size="small"
        class="!mt-1 flex-none"
        data-testid="share-view-toggle"
        @change="toggleShare"
      />
      <div class="flex flex-col flex-1 min-w-0 gap-0.5">
        <span class="text-nc-content-gray-extreme text-body font-weight-600">{{ $t('activity.shareToWeb') }}</span>
        <div class="text-bodySm text-nc-content-gray-subtle leading-snug">
          {{ toggleDescription }}
        </div>
      </div>
      <ShareCommonStatusChip v-if="isPublicShared" :label="$t('activity.publicStatus')" class="flex-none mt-1.5" />
    </div>

    <template v-if="isPublicShared">
      <NcDivider class="!my-0" />
      <ShareCommonUrlBlock :url="url" />
      <NcDivider class="!my-0" />
      <div class="py-1">
        <ShareCommonMenuItem
          icon="settings"
          :label="$t('activity.linkSettings')"
          :hint="$t('activity.linkSettingsHint')"
          trailing="chevron"
          ve-key="c:share:view:open-link-settings"
          testid="nc-share-view-link-settings"
          @click="goTo('link-settings')"
        />
      </div>
    </template>

    <NcDivider class="!my-0" />
    <div class="py-1">
      <ShareCommonMenuItem
        icon="ncCode"
        :label="$t('activity.embedThisView')"
        :hint="$t('activity.embedThisViewHint')"
        :loading="isOpeningEmbed"
        :disabled="isReadOnly"
        trailing="chevron"
        ve-key="c:share:view:embed-open"
        testid="nc-share-view-embed"
        @click="openEmbed"
      />
    </div>
  </div>
</template>

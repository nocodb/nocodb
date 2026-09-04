<script lang="ts" setup>
const popover = useShareBaseModal()!

const { isSharedBaseEnabled, isPrivateBase, isToggleBaseLoading, url, toggleSharedBase, goTo } = popover

const embedUrl = computed(() => (url.value ? `${url.value.replace(/\/$/, '')}/embed` : ''))

const openEmbed = () => {
  if (!embedUrl.value) return
  window.open(embedUrl.value, '_blank', 'noopener,noreferrer')
}

const { t } = useI18n()

const toggleDescription = computed(() => {
  if (isSharedBaseEnabled.value) return t('activity.shareBase.shareToWebDescriptionOn')
  return t('activity.shareBase.shareToWebDescription')
})

const onRowClick = (event: MouseEvent) => {
  if (isPrivateBase.value || isToggleBaseLoading.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, .ant-switch')) return
  toggleSharedBase()
}
</script>

<template>
  <div class="flex flex-col">
    <div
      class="flex items-start gap-3 px-4 py-2.5 transition-colors"
      :class="{
        'cursor-pointer hover:bg-nc-bg-gray-extralight': !isPrivateBase && !isToggleBaseLoading,
      }"
      @click="onRowClick"
    >
      <NcSwitch
        v-if="!isPrivateBase"
        v-e="['c:share:base:enable:toggle']"
        :checked="isSharedBaseEnabled"
        :loading="isToggleBaseLoading"
        size="small"
        class="!mt-1 flex-none"
        data-testid="nc-share-base-toggle"
        @change="toggleSharedBase"
      />
      <div class="flex flex-col flex-1 min-w-0 gap-0.5">
        <span class="text-nc-content-gray-extreme text-body font-weight-600">{{ $t('activity.shareToWeb') }}</span>
        <div class="text-bodySm text-nc-content-gray-subtle leading-snug">
          {{ toggleDescription }}
        </div>
      </div>
      <ShareCommonStatusChip v-if="isSharedBaseEnabled" :label="$t('activity.publicStatus')" class="flex-none mt-1.5" />
      <div v-if="isPrivateBase" class="text-nc-content-gray-muted text-bodySm">
        {{ $t('labels.sharingRestricted') }}
      </div>
    </div>

    <template v-if="isSharedBaseEnabled">
      <NcDivider class="!my-0" />
      <ShareCommonUrlBlock :url="url" />
      <NcDivider class="!my-0" />
      <div class="py-1">
        <ShareCommonMenuItem
          icon="settings"
          :label="$t('activity.linkSettings')"
          :hint="$t('activity.linkSettingsHint')"
          trailing="chevron"
          ve-key="c:share:base:open-link-settings"
          testid="nc-share-base-link-settings"
          @click="goTo('link-settings')"
        />
        <ShareCommonMenuItem
          icon="ncCode"
          :label="$t('activity.embedThisBase')"
          :hint="$t('activity.embedThisBaseHint')"
          trailing="chevron"
          ve-key="c:share:base:embed-open"
          testid="nc-share-base-embed"
          @click="openEmbed"
        />
      </div>
    </template>
  </div>
</template>

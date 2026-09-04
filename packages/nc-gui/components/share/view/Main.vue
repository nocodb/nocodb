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
</script>

<template>
  <div class="flex flex-col">
    <div class="flex items-start gap-3 px-4 py-2.5">
      <NcSwitch
        v-e="['c:share:view:enable:toggle']"
        :checked="isPublicShared"
        :loading="isUpdating.public"
        :disabled="isReadOnly"
        size="small"
        class="!mt-1 flex-none"
        data-testid="share-view-toggle"
        @click="toggleShare"
      />
      <div class="flex flex-col flex-1 min-w-0 gap-0.5">
        <span class="text-nc-content-gray-extreme text-body">{{ $t('activity.shareToWeb') }}</span>
        <div v-if="!isPublicShared" class="text-bodySm text-nc-content-gray-subtle leading-snug">
          {{ isFormView ? $t('activity.shareFormToWebDescription') : $t('activity.shareViewToWebDescription') }}
        </div>
      </div>
    </div>

    <template v-if="isPublicShared">
      <NcDivider class="!my-0" />
      <ShareCommonUrlBlock :url="url" />
      <NcDivider class="!my-0" />
      <div class="py-1">
        <ShareCommonMenuItem
          icon="settings"
          :label="$t('activity.linkSettings')"
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

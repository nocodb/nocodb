<script lang="ts" setup>
const popover = useShareBaseModal()!

const { isSharedBaseEnabled, isPrivateBase, isToggleBaseLoading, url, toggleSharedBase, goTo } = popover

const embedUrl = computed(() => (url.value ? `${url.value.replace(/\/$/, '')}/embed` : ''))

const openEmbed = () => {
  if (!embedUrl.value) return
  window.open(embedUrl.value, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="flex flex-col">
    <div class="flex items-start gap-3 px-4 py-2.5">
      <a-switch
        v-if="!isPrivateBase"
        v-e="['c:share:base:enable:toggle']"
        :checked="isSharedBaseEnabled"
        :loading="isToggleBaseLoading"
        size="small"
        class="!mt-1 flex-none"
        data-testid="nc-share-base-toggle"
        @click="toggleSharedBase"
      />
      <div class="flex flex-col flex-1 min-w-0 gap-0.5">
        <span class="text-nc-content-gray-extreme font-medium">{{ $t('activity.shareToWeb') }}</span>
        <div v-if="!isSharedBaseEnabled" class="text-bodySm text-nc-content-gray-subtle leading-snug">
          {{ $t('activity.shareBase.shareToWebDescription') }}
        </div>
      </div>
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
          :label="$t('activity.manageLinkSettings')"
          trailing="chevron"
          ve-key="c:share:base:open-link-settings"
          testid="nc-share-base-link-settings"
          @click="goTo('link-settings')"
        />
        <ShareCommonMenuItem
          icon="ncCode"
          :label="$t('activity.embedThisBase')"
          trailing="chevron"
          ve-key="c:share:base:embed-open"
          testid="nc-share-base-embed"
          @click="openEmbed"
        />
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
const popover = useShareViewPopover()!

const { isUpdating, regenerateLink, goBack } = popover

const onOk = async () => {
  const ok = await regenerateLink()
  if (ok) goBack()
}
</script>

<template>
  <ShareCommonConfirmScreen
    :title="$t('activity.regenerateLinkConfirmTitle')"
    :description="$t('activity.regenerateLinkConfirmDescription')"
    :ok-text="$t('activity.generateNewLink')"
    :ok-loading="isUpdating.regenerate"
    testid="nc-share-view-regenerate-confirm"
    ve-key="c:share:view:regenerate-confirm"
    @cancel="goBack"
    @ok="onOk"
  />
</template>

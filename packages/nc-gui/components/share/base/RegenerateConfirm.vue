<script lang="ts" setup>
const popover = useShareBaseModal()!

const { isRegeneratingLink, regenerateLink, goBack } = popover

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
    :ok-loading="isRegeneratingLink"
    tone="warning"
    icon="ncAlertTriangle"
    testid="nc-share-base-regenerate-confirm"
    ve-key="c:share:base:regenerate-confirm"
    @cancel="goBack"
    @ok="onOk"
  />
</template>

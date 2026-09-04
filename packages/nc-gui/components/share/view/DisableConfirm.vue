<script lang="ts" setup>
const popover = useShareViewPopover()!

const { isUpdating, disableLink, goBack } = popover
</script>

<template>
  <ShareCommonConfirmScreen
    :title="$t('activity.disableLinkConfirmTitle')"
    :description="$t('activity.disableLinkConfirmDescription')"
    :ok-text="$t('activity.disableLink')"
    :ok-loading="isUpdating.public"
    ok-danger
    tone="destructive"
    icon="ncAlertTriangle"
    testid="nc-share-view-disable-confirm"
    ve-key="c:share:view:disable-confirm"
    @cancel="goBack"
    @ok="disableLink"
  />
</template>

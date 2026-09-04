<script lang="ts" setup>
const popover = useShareBaseModal()!

const { isToggleBaseLoading, disableLink, goBack } = popover
</script>

<template>
  <ShareCommonConfirmScreen
    :title="$t('activity.disableLinkConfirmTitle')"
    :description="$t('activity.disableLinkConfirmDescription')"
    :ok-text="$t('activity.disableLink')"
    :ok-loading="isToggleBaseLoading"
    ok-danger
    tone="destructive"
    icon="ncAlertTriangle"
    testid="nc-share-base-disable-confirm"
    ve-key="c:share:base:disable-confirm"
    @cancel="goBack"
    @ok="disableLink"
  />
</template>

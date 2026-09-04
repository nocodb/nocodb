<script lang="ts" setup>
const modal = useShareBaseModal()!

const {
  goBack,
  goTo,
  sharedBase,
  isRoleToggleLoading,
  isToggleBaseLoading,
  isCustomUrlSaving,
  isPrivateBase,
  onRoleToggle,
  copyCustomUrl,
  createShareBase,
  confirmDisableLink,
} = modal

const { showEEFeatures } = useEeConfig()
const { appInfo } = useGlobal()

const editingAccessEnabled = computed({
  get: () => sharedBase.value?.role === 'editor',
  set: () => onRoleToggle(),
})

const onGenerateNewLink = () => {
  if (isPrivateBase.value) return
  goTo('regenerate-confirm')
}

const onDisableLink = () => {
  if (isPrivateBase.value) return
  confirmDisableLink('link-settings')
}
</script>

<template>
  <div class="flex flex-col">
    <ShareCommonPopoverHeader :title="$t('activity.linkSettings')" show-back @back="goBack" />

    <NcDivider class="!my-0" />

    <div class="flex flex-col py-1">
      <ShareCommonToggleRow
        v-if="!appInfo.ee"
        v-model="editingAccessEnabled"
        :label="$t('activity.editingAccess')"
        :description="$t('activity.editingAccessDescription')"
        :loading="isRoleToggleLoading"
        :disabled="isPrivateBase"
        ve-key="c:share:base:role:toggle"
        testid="nc-share-base-editing-access-toggle"
      />

      <ShareCommonCustomUrl
        v-if="sharedBase?.uuid && showEEFeatures"
        :id="sharedBase.fk_custom_url_id"
        :backend-url="appInfo.ncSiteUrl"
        :copy-custom-url="copyCustomUrl"
        :disabled="isPrivateBase"
        :is-saving="isCustomUrlSaving"
        @update-custom-url="createShareBase(undefined, $event)"
      />
    </div>

    <NcDivider class="!my-0" />

    <div class="py-1">
      <ShareCommonMenuItem
        icon="refresh"
        :icon-badge="false"
        :label="$t('activity.generateNewLink')"
        :disabled="isPrivateBase"
        ve-key="c:share:base:regenerate"
        testid="nc-share-base-regenerate-link"
        @click="onGenerateNewLink"
      />
      <ShareCommonMenuItem
        icon="close"
        :icon-badge="false"
        :label="$t('activity.disableLink')"
        danger
        :disabled="isPrivateBase"
        :loading="isToggleBaseLoading"
        ve-key="c:share:base:disable"
        testid="nc-share-base-disable-link"
        @click="onDisableLink"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
const getRedirectLink = () => {
  return 'https://drive.google.com/drive/u/1/folders/1ilDWrbDjFXSqnDytwVl_8R5NVsZ7'
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3">
    <div class="text-base font-bold text-nc-content-gray">{{ $t('title.youAreLeavingNocoDB') }}</div>
    <div class="text-sm font-weight-500 text-nc-content-gray-subtle2">{{ $t('title.onlyProceedIfYouTrustThisLink') }}</div>
    <div class="text-sm font-weight-500 text-nc-content-gray-subtle">{{ getRedirectLink() }}</div>
    <div class="flex items-center gap-3">
      <NcButton type="secondary">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton>
        {{ $t('labels.proceedToLink') }}
      </NcButton>
    </div>
  </div>
</template>

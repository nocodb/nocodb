<script lang="ts" setup>
const route = useRoute()

const router = useRouter()

const redirectUrl = computed(() => {
  return (route.query.ncRedirectUrl as string) ?? ''
})

const backUrl = computed(() => {
  return (route.query.ncBackUrl as string) ?? ''
})

if (!redirectUrl.value || !backUrl.value) {
  router.replace('/error/404')
}

const handleRedirect = (proceedToLink = false) => {
  if (proceedToLink) {
    window.location.href = redirectUrl.value
    navigateTo(redirectUrl.value, {
      external: true,
      open: { windowFeatures: { noopener: true, noreferrer: true, noprefetch: true } },
    })
  } else {
    navigateTo(backUrl.value)
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 max-w-[420px] mx-auto text-center">
    <div>
      <img class="dark:hidden" width="56px" height="56px" alt="NocoDB" src="~/assets/img/icons/256x256.png" />
    </div>
    <div class="text-xl font-bold text-nc-content-gray">{{ $t('title.youAreLeavingNocoDB') }}</div>
    <div class="text-sm font-weight-500 text-nc-content-gray-subtle2">{{ $t('title.onlyProceedIfYouTrustThisLink') }}</div>
    <a class="text-sm font-weight-500 text-nc-content-gray-subtle" :href="redirectUrl">{{ redirectUrl }}</a>
    <div class="flex items-center gap-3 mt-3">
      <NcButton type="secondary" size="small" @click="handleRedirect(false)">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton size="small" @click="handleRedirect(true)">
        {{ $t('labels.proceedToLink') }}
      </NcButton>
    </div>
  </div>
</template>

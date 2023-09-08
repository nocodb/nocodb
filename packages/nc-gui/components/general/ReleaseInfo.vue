<script setup lang="ts">
import { computed, extractSdkResponseErrorMsg, message, onMounted, useGlobal, useNuxtApp } from '#imports'

const { $api } = useNuxtApp()

const { currentVersion, latestRelease, hiddenRelease, appInfo } = useGlobal()

const releaseAlert = computed({
  get() {
    if (currentVersion.value?.includes('-beta.') || latestRelease.value?.includes('-beta.')) {
      return false
    }
    return (
      currentVersion.value &&
      latestRelease.value &&
      currentVersion.value !== latestRelease.value &&
      latestRelease.value !== hiddenRelease.value
    )
  },
  set(val) {
    hiddenRelease.value = val ? null : latestRelease.value
  },
})

async function fetchReleaseInfo() {
  try {
    const versionInfo = await $api.utils.appVersion()
    if (versionInfo && versionInfo.releaseVersion && versionInfo.currentVersion) {
      currentVersion.value = versionInfo.currentVersion
      latestRelease.value = versionInfo.releaseVersion
    } else {
      currentVersion.value = null
      latestRelease.value = null
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onMounted(async () => await fetchReleaseInfo())
</script>

<template>
  <div v-if="releaseAlert && !appInfo.ee" class="flex items-center">
    <a-dropdown :trigger="['click']" placement="bottom" overlay-class-name="nc-dropdown-upgrade-menu">
      <NcButton class="!bg-primary !border-none !mr-3" size="small">
        <div class="flex gap-1 items-center text-white">
          <span class="text-sm font-weight-medium">{{ $t('activity.upgrade.available') }}</span>
          <mdi-menu-down />
        </div>
      </NcButton>

      <template #overlay>
        <div class="mt-1 bg-white shadow-lg !border">
          <nuxt-link
            no-prefetch
            no-rel
            class="!text-primary !no-underline"
            to="https://github.com/nocodb/nocodb/releases"
            target="_blank"
          >
            <div class="nc-menu-item">
              <mdi-script-text-outline />
              {{ latestRelease }} {{ $t('activity.upgrade.releaseNote') }}
            </div>
          </nuxt-link>

          <nuxt-link
            no-prefetch
            no-rel
            class="!text-primary !no-underline"
            to="https://docs.nocodb.com/getting-started/upgrading"
            target="_blank"
          >
            <div class="nc-menu-item">
              <mdi-rocket-launch-outline />
              <!-- How to upgrade? -->
              {{ $t('activity.upgrade.howTo') }}
            </div>
          </nuxt-link>

          <a-divider class="!m-0" />

          <div class="nc-menu-item" @click="releaseAlert = false">
            <mdi-close />
            <!-- Hide menu -->
            {{ $t('general.hideMenu') }}
          </div>
        </div>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue'
import { extractSdkResponseErrorMsg, onMounted } from '#imports'

const { $api } = useNuxtApp()

const { currentVersion, latestRelease, hiddenRelease } = useGlobal()

const releaseAlert = computed(
  () =>
    currentVersion.value &&
    latestRelease.value &&
    currentVersion.value !== latestRelease.value &&
    latestRelease.value !== hiddenRelease.value,
)

async function fetchReleaseInfo() {
  try {
    const versionInfo = await $api.utils.appVersion()
    if (versionInfo && versionInfo.releaseVersion && versionInfo.currentVersion && !/[^0-9.]/.test(versionInfo.currentVersion)) {
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
  <div v-if="releaseAlert" class="flex items-center">
    <a-dropdown :trigger="['click']" placement="bottom">
      <a-button class="bg-primary border-none">
        <div class="flex gap-1 align-center text-white">
          <span class="text-sm font-weight-medium">{{ $t('activity.upgrade.available') }}</span>
          <mdi-menu-down />
        </div>
      </a-button>
      <template #overlay>
        <div class="mt-1 bg-white shadow-lg !border">
          <nuxt-link class="text-primary" to="https://github.com/nocodb/nocodb/releases" target="_blank">
            <div class="nc-menu-item">
              <mdi-script-text-outline />
              {{ latestRelease }} {{ $t('activity.upgrade.releaseNote') }}
            </div>
          </nuxt-link>
          <nuxt-link class="text-primary" to="https://docs.nocodb.com/getting-started/upgrading" target="_blank">
            <div class="nc-menu-item">
              <mdi-rocket-launch-outline />
              <!-- How to upgrade? -->
              {{ $t('activity.upgrade.howTo') }}
            </div>
          </nuxt-link>
          <a-divider class="ma-0" />
          <div class="nc-menu-item" @click="latestRelease = null">
            <mdi-close />
            <!-- Hide menu -->
            {{ $t('general.hideMenu') }}
          </div>
        </div>
      </template>
    </a-dropdown>
  </div>
</template>

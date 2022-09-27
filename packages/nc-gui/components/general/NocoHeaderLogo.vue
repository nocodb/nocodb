<script lang="ts" setup>
import { useGlobal } from '~/composables'

const { appInfo, currentVersion } = useGlobal()
</script>

<template>
  <a-tooltip placement="bottom">
    <template v-if="currentVersion" #title>
      {{ currentVersion }}
    </template>
    <img v-if="appInfo.useFinnTheme" width="50" alt="NocoDB" src="~/assets/img/brand/finn-white.svg" />
    <img v-else width="35" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
  </a-tooltip>
</template>

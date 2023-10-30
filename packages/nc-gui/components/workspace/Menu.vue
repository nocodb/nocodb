<script lang="ts" setup>
import { useBase } from '#imports'
const backendEnv = await useBase().backendEnv
const logoUrl = backendEnv.LOGO_URL || process.env.LOGO_URL
const logoHref = backendEnv.LOGO_HREF || 'https://github.com/nocodb/nocodb'
const logoWidth = backendEnv.LOGO_WIDTH || process.env.LOGO_WIDTH
</script>

<template>
  <div class="flex flex-row flex-grow pl-0.5 pr-1 py-0.5 rounded-md w-full" style="max-width: calc(100% - 2.5rem)">
    <div class="flex-grow min-w-20">
      <div
        data-testid="nc-workspace-menu"
        class="flex items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25 justify-center w-full ml-2"
      >
        <a class="transition-all duration-200 transform min-w-10" :href="logoHref" target="_blank">
          <img alt="NocoDB" :width="logoWidth" :src="logoUrl" />
        </a>
        <div class="flex flex-grow"></div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-workspace-menu-item {
  @apply flex items-center pl-2 py-2 gap-2 text-sm hover:text-black;
}
</style>

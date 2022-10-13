<script lang="ts" setup>
import { openLink, useGlobal } from '#imports'

const { isLoading } = useGlobal()
</script>

<template>
  <button
    type="button"
    class="cursor-pointer group text-xs text-slate-500 hover:text-primary dark:hover:text-white dark:text-slate-300 mx-auto my-4 flex justify-center gap-1 items-center"
    @click="openLink('https://github.com/nocodb/nocodb')"
  >
    <span class="relative rounded">
      <GeneralNocoIcon v-bind="$attrs" :animate="isLoading" class="!relative !top-0" :size="32" />
    </span>

    <span>Powered by NocoDB</span>
  </button>
</template>

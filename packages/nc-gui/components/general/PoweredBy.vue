<script lang="ts" setup>
import { openLink } from '#imports'
</script>

<template>
  <button
    type="button"
    class="cursor-pointer group text-xs text-slate-500 hover:text-primary dark:hover:text-white dark:text-slate-300 mx-auto my-4 flex justify-center gap-1 items-center"
    @click="openLink('https://github.com/nocodb/nocodb')"
  >
    <span class="rounded">
      <GeneralNocoIcon class="!relative !top-0" :width="32" :height="32" />
    </span>

    <span>Powered by NocoDB</span>
  </button>
</template>

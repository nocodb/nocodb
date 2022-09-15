<script lang="ts" setup>
import { openLink } from '#imports'
</script>

<template>
  <button
    type="button"
    class="cursor-pointer group text-xs text-slate-500 hover:text-primary dark:hover:text-white dark:text-slate-300 mx-auto my-4 flex justify-center gap-2 items-center"
    @click="openLink('https://github.com/nocodb/nocodb')"
  >
    <span class="bg-primary bg-opacity-100 rounded">
      <img width="32" height="32" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
    </span>

    <span class="color-transition transform group-hover:(scale-103)">Powered by NocoDB</span>
  </button>
</template>

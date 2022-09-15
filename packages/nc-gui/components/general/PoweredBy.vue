<script lang="ts" setup>
import { openLink } from '#imports'
</script>

<template>
  <button
    type="button"
    class="cursor-pointer self-end text-xs text-gray-400 hover:text-primary mx-auto my-4 flex justify-center gap-2 items-center"
    @click="openLink('https://github.com/nocodb/nocodb')"
  >
    <span class="bg-primary bg-opacity-100 rounded">
      <img width="32" height="32" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
    </span>

    Powered by NocoDB
  </button>
</template>

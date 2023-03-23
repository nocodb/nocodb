<script lang="ts" setup>
import { iconMap } from '#imports'
</script>

<template>
  <a
    v-e="['c:navbar:join-cloud']"
    class="flex items-center space-x-1 w-full cursor-pointer pl-3 py-1.5 !text-current !no-underline !hover:(text-primary bg-primary bg-opacity-5)"
    href="https://docs.google.com/forms/d/e/1FAIpQLSfKLe8Rcrq0uo2_jM5W1kbVBbzDiQ3IvlP8Iov61FTekVAvzA/viewform?usp=pp_url"
    target="_blank"
  >
    <component :is="iconMap.cloud" class="mr-1" />
    Join NocoDB Cloud
  </a>
</template>

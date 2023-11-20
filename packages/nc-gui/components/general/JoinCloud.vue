<script lang="ts" setup>
import { iconMap } from '#imports'
</script>

<template>
  <a
    v-e="['c:navbar:join-cloud']"
    class="flex !no-underline"
    href="https://app.nocodb.com/#/signin?utm_source=OSS&utm_medium=OSS&utm_campaign=OSS&utm_content=OSS"
  >
    <div
      class="flex justify-center items-center rounded-l-[3px] w-full cursor-pointer px-2 py-1 !text-current !no-underline text-primary border-1 border-[#cdd1d6] bg-[#EFF2F6] hover:bg-[#e9ebef] m-0"
    >
      <component :is="iconMap.cloud" class="mt-[1px] text-black font-bold" />
      <div class="px-1 text-xs font-bold text-gray-800">{{ $t('general.join') }}</div>
    </div>
    <div
      class="group flex justify-center items-center rounded-r-[3px] w-full cursor-pointer px-1 py-1 text-primary border-r-1 border-b-1 border-t-1 border-[#cdd1d6] m-0"
    >
      <div class="px-1 text-xs font-semibold group-hover:text-[#0a69da] text-gray-900">NocoDB Cloud</div>
    </div>
  </a>
</template>

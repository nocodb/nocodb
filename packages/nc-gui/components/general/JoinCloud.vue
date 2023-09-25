<script lang="ts" setup>
import { iconMap } from '#imports'
</script>

<template>
  <a
    v-e="['c:navbar:join-cloud']"
    class="flex !no-underline"
    href="https://docs.google.com/forms/d/e/1FAIpQLSfKLe8Rcrq0uo2_jM5W1kbVBbzDiQ3IvlP8Iov61FTekVAvzA/viewform?usp=pp_url"
  >
    <div
      class="flex justify-center items-center rounded-l-[3px] w-full cursor-pointer px-2 py-1 !text-current !no-underline text-primary border-1 border-[#cdd1d6] bg-[#EFF2F6] hover:bg-[#e9ebef] m-0"
      target="_blank"
    >
      <component :is="iconMap.cloud" class="mt-[1px] text-black font-bold" />
      <div class="px-1 text-xs font-bold text-gray-800">Join</div>
    </div>
    <div
      class="group flex justify-center items-center rounded-r-[3px] w-full cursor-pointer px-1 py-1 text-primary border-r-1 border-b-1 border-t-1 border-[#cdd1d6] m-0"
      target="_blank"
    >
      <div class="px-1 text-xs font-semibold group-hover:text-[#0a69da] text-gray-900">NocoDB Cloud</div>
    </div>
  </a>
</template>

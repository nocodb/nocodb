<script lang="ts" setup>
import { iconMap } from '#imports'
</script>

<template>
  <a v-e="['c:navbar:join-cloud']" class="flex !text-current !no-underline"
    href="https://docs.google.com/forms/d/e/1FAIpQLSfKLe8Rcrq0uo2_jM5W1kbVBbzDiQ3IvlP8Iov61FTekVAvzA/viewform?usp=pp_url">
    <div
      class="group flex justify-center items-center rounded-l-sm w-full cursor-pointer px-2 py-1 !text-current !no-underline text-primary border-1 border-gray-300 bg-gray-100 m-0"
      target="_blank">
      <component :is="iconMap.cloud" class="mr-1 mt-[1px] text-black group-hover:text-pink-400" />
    </div>
    <div
      class="group flex justify-center items-center rounded-r-sm w-full cursor-pointer px-2 py-1 text-primary border-r-1 border-b-1 border-t-1 border-gray-300 m-0"
      target="_blank">
      <div class="px-1 text-xs font-bold text-gray-700">Join Cloud</div>
    </div>
  </a>
</template>

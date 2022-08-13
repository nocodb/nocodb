<script lang="ts" setup>
interface Props {
  nav?: boolean
}

const { nav = false } = defineProps<Props>()
</script>

<template>
  <a-card class="w-[300px] ma-10 shadow-lg rounded-lg" href="https://github.com/sponsors/nocodb" target="_blank">
    <template #cover>
      <img class="max-h-[180px]" alt="cover" src="/ants-leaf-cutter.jpeg" />
    </template>

    <a-card-meta>
      <template #title>
        <span v-if="!nav" class="text-xl pb-4">
          {{ $t('msg.info.sponsor.header') }}
        </span>
      </template>
    </a-card-meta>

    <div v-if="!nav" class="py-5 text-sm">
      {{ $t('msg.info.sponsor.message') }}
    </div>

    <div class="flex justify-center">
      <a-button class="!shadow" size="large">
        <div class="flex items-center">
          <mdi-cards-heart class="text-red-500 mr-2" />
          {{ $t('activity.sponsorUs') }}
        </div>
      </a-button>
    </div>
  </a-card>
</template>

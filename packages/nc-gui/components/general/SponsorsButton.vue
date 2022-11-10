<script lang="ts" setup>
defineProps<{ type?: string; ghost?: boolean }>()
</script>

<template>
  <div class="flex items-center">
    <nuxt-link href="https://github.com/sponsors/nocodb" target="_blank" class="!h-[28px] leading-normal">
      <a-button :ghost="ghost" :type="type" class="!shadow rounded !h-[28px]" size="small">
        <div class="flex items-center text-xs font-weight-bold">
          <mdi-cards-heart class="text-red-500 mr-2" />
          {{ $t('activity.sponsorUs') }}
        </div>
      </a-button>
    </nuxt-link>
  </div>
</template>

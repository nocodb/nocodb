<script lang="ts" setup>
import MdiHeartsCard from '~icons/mdi/cards-heart'

interface Props {
  nav?: boolean
}

const { nav = false } = defineProps<Props>()
</script>

<template>
  <v-card :rounded="0" max-width="300" class="pb-3" href="https://github.com/sponsors/nocodb" target="_blank">
    <v-img src="/ants-leaf-cutter.jpeg" :cover="true" :aspect-ratio="1" :height="nav ? 80 : ''" class="mt-0" />

    <v-card-title v-if="!nav" class="pb-2">
      {{ $t('msg.info.sponsor.header') }}
    </v-card-title>

    <v-card-text v-if="!nav" class="pb-0">
      {{ $t('msg.info.sponsor.message') }}
    </v-card-text>

    <v-card-actions class="justify-center">
      <v-btn color="primary" class="mt-2">
        <MdiHeartsCard class="text-red-500 mr-2" />
        {{ $t('activity.sponsorUs') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

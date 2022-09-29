<template>
  <v-card max-width="300" min-height="" class="pb-3" href="https://github.com/sponsors/nocodb" target="_blank">
    <v-img src="ants-leaf-cutter.jpeg" :height="nav ? 80 : ''" class="mt-0">
      <template #placeholder>
        <v-skeleton-loader width="700" type="image" />
      </template>
    </v-img>
    <!-- You can help us! -->
    <v-card-title v-if="!nav" class="pb-2" :class="{ 'body-2 justify-center mt-n2': nav }">
      {{ $t('msg.info.sponsor.header') }}
    </v-card-title>
    <v-card-text v-if="!nav" class="pb-0">
      <p class="caption text-left body-1 textColor--text text--lighten-1">
        <template>
          <!-- We are a tiny team working full time to make NocoDB open source. We believe a tool like NocoDB should be
          available freely to every problem solver on internet. -->
          {{ $t('msg.info.sponsor.message') }}
        </template>
      </p>
    </v-card-text>
    <v-card-actions class="justify-center">
      <v-btn color="primary" :class="{ 'mt-n2': !nav, 'mt-2 mb-n1': nav }" small outlined>
        <v-icon small color="red" class="mr-2"> mdi-cards-heart </v-icon>
        {{ $t('activity.sponsorUs') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
export default {
  name: 'SponsorMini',
  props: {
    nav: Boolean,
  },
};
</script>

<style scoped></style>

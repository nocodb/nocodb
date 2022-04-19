<template>
  <v-overlay opacity=".98">
    <v-card
      light
      width="450"
      min-height="500"
      class=""
      href="https://github.com/sponsors/nocodb"
      target="_blank"
    >
      <v-img src="ants-leaf-cutter.jpeg" class="mt-0" height="300">
        <template #placeholder>
          <v-skeleton-loader
            height="300"
            width="700"
            type="image"
          />
        </template>
      </v-img>

      <v-card-title class="pb-2">
        You can help us
      </v-card-title>

      <v-card-text class="pb-0">
        <p class="text-left body-1 ">
          We are a tiny team working full time to make NocoDB open source. We believe a tool like NocoDB should be
          available freely to every problem solver on internet.
          <br>
          <br>
          Sincerely,
          Team NocoDB
        </p>
      </v-card-text>

      <v-card-actions class="justify-center pb-6 mt-n1">
        <v-btn large @click.stop.prevent="$emit('close')">
          Use Freely
        </v-btn>
        <v-btn color="primary" large>
          <v-icon small color="red" class="mr-2">
            mdi-cards-heart
          </v-icon>
          Sponsor Us
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-overlay>
</template>

<script>
export default {
  name: 'SponsorOverlay'
}
</script>

<style scoped>

</style>

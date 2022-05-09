<template>
  <div>
    <div class="nc-rating-wrapper ui-type">
      <v-select label="Icon" :items="icons" dense outlined class="caption">
        <template #item="{ item }">
          <v-icon small>
            {{ item }}
          </v-icon>
        </template>
        <template #selection="{ item }">
          <v-icon small>
            {{ item }}
          </v-icon>
        </template>
      </v-select>
      <v-select label="Number of options" :items="[3,4,5,6,7,8,9,10]" dense outlined class="caption" />
    </div>
    <v-color-picker
      class="mx-auto"
      hide-inputs
    />
  </div>
</template>

<script>

export default {
  name: 'RatingOptions',
  props: ['column', 'meta', 'value'],
  data: () => ({
    icons: ['mdi-star', 'mdi-heart']
  })
}
</script>

<style scoped lang="scss">
.nc-rating-wrapper {
  display: flex;
  gap: 16px
}
</style>

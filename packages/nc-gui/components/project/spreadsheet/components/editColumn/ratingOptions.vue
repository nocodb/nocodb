<template>
  <div>
    <div class="nc-rating-wrapper ui-type">
      <v-select
        v-model="colMeta.icon"
        label="Icon"
        :items="icons"
        dense
        outlined
        class="caption"
        :item-value="v=>v"
        :value-comparator="(a,b) => a && b && a.full === b.full && a.empty === b.empty"
      >
        <template #item="{ item }">
          <v-icon small :color="colMeta.color">
            {{ item.full }}
          </v-icon>
          <v-icon class="ml-2" small :color="colMeta.color">
            {{ item.empty }}
          </v-icon>
        </template>
        <template #selection="{ item }">
          <v-icon small :color="colMeta.color">
            {{ item.full }}
          </v-icon>
          <v-icon class="ml-2" small :color="colMeta.color">
            {{ item.empty }}
          </v-icon>
        </template>
      </v-select>
      <v-select
        v-model="colMeta.max"
        label="Max"
        :items="[3,4,5,6,7,8,9,10]"
        dense
        outlined
        class="caption"
      />
    </div>
    <v-color-picker
      v-model="colMeta.color"
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
    colMeta: {
      icon: {
        full: 'mdi-star',
        empty: 'mdi-star-outline'
      },
      color: '#fcb401',
      max: 5
    },
    icons: [{
      full: 'mdi-star',
      empty: 'mdi-star-outline'
    }, {
      full: 'mdi-heart',
      empty: 'mdi-heart-outline'
    }, {
      full: 'mdi-moon-full',
      empty: 'mdi-moon-new'
    }, {
      full: 'mdi-thumb-up',
      empty: 'mdi-thumb-up-outline'
    }, {
      full: 'mdi-flag',
      empty: 'mdi-flag-outline'
    }]
  }),
  watch: {
    value() {
      this.colMeta = this.value || {}
    },
    colMeta(v) {
      this.$emit('input', v)
    }
  },
  created() {
    this.colMeta = this.value || { ...this.colMeta }
  }
}
</script>

<style scoped lang="scss">
.nc-rating-wrapper {
  display: flex;
  gap: 16px
}
</style>

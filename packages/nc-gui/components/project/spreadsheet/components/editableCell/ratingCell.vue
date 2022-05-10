<template>
  <div class="d-100 h-100" :class="{'nc-cell-hover-show': localState == 0 || !localState}">
    <v-rating
      v-model="localState"
      :length="ratingMeta.max"
      dense
      x-small
      clearable
    >
      <template #item="{isFilled, click}">
        <v-icon v-if="isFilled" :size="15" :color="ratingMeta.color" @click="click">
          {{ ratingMeta.icon.full }}
        </v-icon>
        <v-icon
          v-else
          color="grey lighten-1"
          :size="15"
          class="nc-cell-hover-show"
          @click="click"
        >
          {{ ratingMeta.icon.empty }}
        </v-icon>
      </template>
    </v-rating>
  </div>
</template>

<script>
export default {
  name: 'RatingCell',
  props: {
    column: Object,
    value: [String, Number]
  },
  computed: {
    localState: {
      get() {
        return this.value
      },
      set(val) {
        this.$emit('input', val)
      }
    },
    ratingMeta() {
      return this.column && this.column.meta
        ? this.column.meta
        : {
            icon: {
              full: 'mdi-star',
              empty: 'mdi-star-outline'
            },
            color: '#fcb401',
            max: 5
          }
    }
  }
}
</script>

<style scoped>

</style>

<template>
  <div class="d-100 h-100" :class="{ 'nc-cell-hover-show': localState == 0 || !localState }">
    <v-rating v-model="localState" :length="ratingMeta.max" dense x-small :readonly="readOnly" clearable>
      <template #item="{ isFilled, click }">
        <v-icon v-if="isFilled" :size="15" :color="ratingMeta.color" @click="click">
          {{ fullIcon }}
        </v-icon>
        <v-icon v-else :color="ratingMeta.color" :size="15" class="nc-cell-hover-show" @click="click">
          {{ emptyIcon }}
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
    value: [String, Number],
    readOnly: Boolean,
  },
  computed: {
    fullIcon() {
      return (this.ratingMeta && this.ratingMeta.icon && this.ratingMeta.icon.full) || 'mdi-star';
    },
    emptyIcon() {
      return (this.ratingMeta && this.ratingMeta.icon && this.ratingMeta.icon.empty) || 'mdi-star-outline';
    },
    localState: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
    ratingMeta() {
      return {
        icon: {
          full: 'mdi-star',
          empty: 'mdi-star-outline',
        },
        color: '#fcb401',
        max: 5,
        ...(this.column && this.column.meta ? this.column.meta : {}),
      };
    },
  },
};
</script>

<style scoped></style>

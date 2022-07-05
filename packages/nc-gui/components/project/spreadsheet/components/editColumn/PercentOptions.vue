<template>
  <v-row class="percent-wrapper">
    <!-- TODO: i18n -->
    <v-autocomplete
      v-model="colMeta.percentOption"
      hide-details
      class="caption ui-type nc-ui-dt-dropdown"
      label="Precision"
      dense
      outlined
      item-value="id"
      item-text="title"
      :items="percentOptionsList"
    >
      <template #selection="{ item }">
        <div>
          <span class="caption grey--text text--darken-4">
            {{ item.title }}
          </span>
        </div>
      </template>
      <template #item="{ item }">
        <div class="caption">
          {{ item.title }}
        </div>
      </template>
    </v-autocomplete>
  </v-row>
</template>

<script>
import { percentOptions } from '~/helpers/percentHelper'

export default {
  name: 'PercentOptions',
  props: ['column', 'meta', 'value'],
  data: () => ({
    percentOptionsList: percentOptions.map(o => ({
      ...o,
      title: o.title
    })),
    colMeta: {
      percentOption: 0
    }
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
    this.colMeta = this.value ? { ...this.value } : { ...this.colMeta }
  }
}
</script>

<style scoped>
.percent-wrapper {
  margin: 0;
}

.percent-wrapper .caption:first-child {
  margin: -10px 0px 10px 5px;
}
</style>

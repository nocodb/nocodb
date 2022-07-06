<template>
  <v-row class="duration-wrapper">
    <div class="caption">
      A duration of time in minutes or seconds (e.g. 1:23).
    </div>
    <!-- TODO: i18n -->
    <v-autocomplete
      v-model="colMeta.duration"
      hide-details
      class="caption ui-type nc-ui-dt-dropdown"
      label="Duration Format"
      dense
      outlined
      item-value="id"
      item-text="title"
      :items="durationOptionList"
    >
      <template #selection="{ item }">
        <div>
          <span class="caption" color="text">
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
import { durationOptions } from '~/helpers/durationHelper'

export default {
  name: 'DurationOptions',
  props: ['column', 'meta', 'value'],
  data: () => ({
    durationOptionList: durationOptions.map(o => ({
      ...o,
      // h:mm:ss (e.g. 3:45, 1:23:40)
      title: `${o.title} ${o.example}`
    })),
    colMeta: {
      duration: 0
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
.duration-wrapper {
  margin: 0;
}

.duration-wrapper .caption:first-child {
  margin: -10px 0px 10px 5px;
}
</style>

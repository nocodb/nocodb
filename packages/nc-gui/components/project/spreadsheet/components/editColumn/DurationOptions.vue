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
export default {
  name: 'DuractionOptions',
  props: ['column', 'meta', 'value'],
  data: () => ({
    durationOptionList: [
      {id: 0, title: 'h:mm (e.g. 1:23)'},
      {id: 1, title: 'h:mm:ss (e.g. 3:45, 1:23:40)'},
      {id: 2, title: 'h:mm:ss.s (e.g. 3:34.6, 1:23:40,0)'},
      {id: 3, title: 'h:mm:ss.ss (e.g. 3.45.67, 1:23:40,00)'},
      {id: 4, title: 'h:mm:ss.sss (e.g. 3.45.678, 1:23:40.000)'},
    ],
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

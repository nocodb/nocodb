<template>
  <v-pagination
    v-if="count !== Infinity"
    v-model="page"
    style="max-width: 100%"
    :length="Math.ceil(count / size)"
    :total-visible="8"
    color="primary lighten-2 nc-pagination"
    @input="$emit('input',page)"
  />
  <div v-else class="mx-auto d-flex align-center mt-n1 " style="max-width:250px">
    <span class="caption" style="white-space: nowrap"> Change page:</span>
    <v-text-field
      v-model="page"
      class="ml-1 caption"
      :full-width="false"
      outlined
      dense
      hide-details
      type="number"
      @keydown.enter="$emit('input',page)"
    >
      <template #append>
        <x-icon tooltip="Change page" small icon.class="mt-1" @click="$emit('input',page)">
          mdi-keyboard-return
        </x-icon>
      </template>
    </v-text-field>
  </div>
</template>

<script>
export default {
  name: 'Pagination',
  props: {
    count: [Number, String],
    value: [Number, String],
    size: [Number, String]
  },
  data: () => ({
    page: 1
  }),
  watch: {
    value(v) {
      this.page = v
    }
  },
  mounted() {
    this.page = this.value
  }
}
</script>

<style scoped>
</style>

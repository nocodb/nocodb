<template>
  <v-pagination
    v-if="count !== Infinity"
    style="max-width: 100%"
    v-model="page"
    :length="Math.ceil(count / size)"
    :total-visible="8"
    @input="$emit('input',page)"
    color="primary lighten-2"
  ></v-pagination>
  <div v-else class="mx-auto d-flex align-center mt-n1 " style="max-width:250px">
    <span class="caption" style="white-space: nowrap"> Change page:</span>
    <v-text-field
      class="ml-1 caption"
      :full-width="false"
      outlined
      dense
      hide-details
      v-model="page"
      @keydown.enter="$emit('input',page)"
      type="number"
    >
      <template #append>
        <x-icon tooltip="Change page" small icon.class="mt-1" @click="$emit('input',page)">mdi-keyboard-return
        </x-icon>
      </template>
    </v-text-field>
  </div>
</template>

<script>
export default {
  props: {
    count: [Number, String],
    value: [Number, String],
    size: [Number, String],
  },
  data: () => ({
    page: 1
  }),
  mounted() {
    this.page = this.value;
  },
  watch: {
    value(v) {
      this.page = v;
    }
  },
  name: "pagination"
}
</script>

<style scoped>
</style>

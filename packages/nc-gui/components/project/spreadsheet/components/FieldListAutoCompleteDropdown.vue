<template>
  <v-autocomplete
    ref="field"
    v-model="localValue"
    class="caption"
    :items="columns"
    item-value="id"
    item-text="title"
    :label="$t('objects.field')"
    solo
    flat
    dense
    hide-details
    @click.stop
    @change="$emit('change')"
  >
    <template #selection="{ item }">
      <v-icon small class="mr-1">
        {{ item.icon }}
      </v-icon>
      {{ item.title }}
    </template>
    <template #item="{ item }">
      <span :class="`caption font-weight-regular nc-fld-${item.title}`">
        <v-icon color="grey" small class="mr-1">
          {{ item.icon }}
        </v-icon>
        {{ item.title }}
      </span>
    </template>
  </v-autocomplete>
</template>

<script>
export default {
  name: 'FieldListAutoCompleteDropdown',
  props: {
    columns: Array,
    value: String,
  },
  computed: {
    localValue: {
      set(v) {
        this.$emit('input', v);
      },
      get() {
        return this.value;
      },
    },
  },
  mounted() {
    const autocompleteInput = this.$refs.field.$refs.input;
    autocompleteInput.addEventListener('focus', this.onFocus, true);
  },
  methods: {
    onFocus(e) {
      this.$refs.field.isMenuActive = true; // open item list
    },
  },
};
</script>

<style scoped></style>

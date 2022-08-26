<template>
  <v-select v-model="localState" solo dense flat :items="[true, false]" hide-details class="mt-0" />
</template>

<script>
export default {
  name: 'BooleanType',
  props: {
    value: Boolean,
  },
  computed: {
    localState: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      },
    },
  },
};
</script>

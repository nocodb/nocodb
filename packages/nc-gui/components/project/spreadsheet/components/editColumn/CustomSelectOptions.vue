<template>
  <v-container fluid class="wrapper">
    <div v-for="(op, i) in localState" :key="i" class="d-flex py-1">
      <v-icon :color="colors[i % colors.length]" class="mr-2" @click="localState.splice(i, 1)">
        mdi-arrow-down-drop-circle
      </v-icon>
      <v-text-field
        v-model="localState[i]"
        :autofocus="true"
        class="caption"
        dense
        outlined
        @input="listenForComma(i, $event)"
      />
      <v-icon class="ml-2" color="error lighten-2" size="13" @click="localState.splice(i, 1)"> mdi-close </v-icon>
    </div>
    <v-btn x-small color="primary" outlined class="d-100 caption mt-2" @click="localState.push('')">
      <v-icon x-small outlined color="primary" class="mr-2"> mdi-plus </v-icon>
      Add option
    </v-btn>
  </v-container>
</template>

<script>
import colors from '@/components/project/spreadsheet/helpers/colors';

export default {
  name: 'CustomSelectOptions',
  props: ['value'],
  data: () => ({
    localState: [],
  }),
  computed: {
    colors() {
      return this.$store.state.settings.darkTheme ? colors.dark : colors.light;
    },
  },
  watch: {
    localState: {
      handler(v) {
        this.$emit('input', v.map(v => `'${v.replace(/'/g, "\\'")}'`).join(','));
      },
      deep: true,
    },
    value() {
      this.syncState();
    },
  },
  mounted() {
    this.syncState();
  },
  methods: {
    syncState() {
      this.localState = (this.value || '').split(',').map(v => v.replace(/\\'/g, "'").replace(/^'|'$/g, ''));
    },
    listenForComma(index, value) {
      const normalisedValue = value.trim();
      if (normalisedValue.endsWith(',')) {
        this.localState.push('');
        return;
      }
      this.localState[index] = normalisedValue;
    },
  },
};
</script>

<style scoped>
.wrapper {
  border: solid 2px #7f828b33;
  border-radius: 4px;
}

/deep/ .v-input__control {
  height: 33px;
}
</style>

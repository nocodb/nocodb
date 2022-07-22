<template>
  <v-container fluid class="wrapper">
    <draggable v-model="options" handle=".nc-child-draggable-icon">
      <div v-for="(op, i) in options" :key="`${op.color}-${i}`" class="d-flex py-1">
        <v-icon small class="nc-child-draggable-icon handle"> mdi-drag-vertical </v-icon>
        <v-menu v-model="colorMenus[i]" rounded="lg" :close-on-content-click="false" offset-y>
          <template #activator="{ on }">
            <v-icon :color="op.color" class="mr-2" v-on="on"> mdi-arrow-down-drop-circle </v-icon>
          </template>
          <color-picker v-model="op.color" @input="colorMenus[i] = false" />
        </v-menu>
        <v-text-field v-model="op.title" :autofocus="true" class="caption" dense outlined />
        <v-icon class="ml-2" color="error lighten-2" size="13" @click="removeOption(op, i)"> mdi-close </v-icon>
      </div>
      <v-btn slot="footer" x-small color="primary" outlined class="d-100 caption mt-2" @click="addNewOption()">
        <v-icon x-small outlined color="primary" class="mr-2"> mdi-plus </v-icon>
        Add option
      </v-btn>
    </draggable>
    <div v-show="error" class="px-2 py-1 text-left caption error--text">
      {{ error }}
    </div>
  </v-container>
</template>

<script>
import draggable from 'vuedraggable';
import { UITypes } from 'nocodb-sdk';
import ColorPicker from '../ColorPicker.vue';
import { enumColor } from '@/components/project/spreadsheet/helpers/colors';

export default {
  name: 'CustomSelectOptions',
  components: {
    draggable,
    ColorPicker,
  },
  props: ['column', 'meta'],
  data: () => ({
    options: [],
    colorMenus: {},
    colors: enumColor.light,
    error: undefined,
  }),
  computed: {
    alias() {
      return this.column?.column_name;
    },
    isEnumOrSet() {
      return ['enum', 'set'].includes(this.column.dt);
    },
  },
  created() {
    this.options = this.copyOptions(this.column.colOptions?.options) || [];
    // Support for older options
    for (const op of this.options.filter(el => el.order === null)) {
      op.title = op.title.replace(/^'/, '').replace(/'$/, '')
    }
  },
  methods: {
    addNewOption() {
      const tempOption = {
        title: '',
        color: this.getNextColor(),
      };
      this.options.push(tempOption);
    },
    async removeOption(option, index) {
      this.options.splice(index, 1);
    },
    getNextColor() {
      let tempColor = this.colors[0];
      if (this.options.length && this.options[this.options.length - 1].color) {
        const lastColor = this.colors.indexOf(this.options[this.options.length - 1].color);
        tempColor = this.colors[(lastColor + 1) % this.colors.length];
      }
      return tempColor;
    },
    async save() {
      try {
        if (this.checkOptions()) {
          const selectCol = {
            ...this.column,
            title: this.alias,
            colOptions: {
              options: this.options,
            },
          };
          await this.$api.dbTableColumn.create(this.meta.id, selectCol);
          if (this.column.colOptions) {
            this.$store
              .dispatch('meta/ActLoadMeta', { force: true, id: this.column.fk_model_id })
              .then(() => {});
          }
          this.$toast.success('Select column saved successfully').goAway(3000);
          return true;
        }
        return false;
      } catch (e) {
        this.$toast.error(e.message).goAway(3000);
        return false;
      }
    },
    async update() {
      try {
        if (this.checkOptions()) {
          const selectCol = {
            ...this.column,
            title: this.alias,
            colOptions: {
              options: this.options,
            },
          };
          await this.$api.dbTableColumn.update(this.column.id, selectCol);
          if (this.column.colOptions) {
            this.$store
              .dispatch('meta/ActLoadMeta', { force: true, id: this.column.fk_model_id })
              .then(() => {});
          }
          return true;
        }
        return false;
      } catch (e) {
        this.$toast.error(e.message).goAway(3000);
        return false;
      }
    },
    copyOptions(array) {
      const temp = [];
      if (array && array.length) {
        for (const el of array) {
          temp.push({ ...el });
        }
      }
      return temp;
    },
    checkOptions() {
      let failed = false;
      for (const opt of this.options) {
        if (!opt.title.length) {
          this.error = "Select options can't be null";
          failed = true;
          break;
        }
        if (this.column.uidt === UITypes.MultiSelect && opt.title.includes(',')) {
          this.error = "MultiSelect columns can't have commas(',')";
          failed = true;
          break;
        }
        if (this.options.filter(el => el.title === opt.title).length !== 1) {
          this.error = "Select options can't have duplicates";
          failed = true;
          break;
        }
      }
      if (!failed) {
        this.error = null;
        return true;
      }
      return false;
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

.handle {
  cursor: pointer;
}

/deep/ .v-text-field__details {
  position: absolute;
  margin-top: 10px;
  margin-left: 25px;
}
</style>

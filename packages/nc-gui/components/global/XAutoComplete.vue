<template>
  <div>
    <v-text-field
      v-bind="$attrs"
      ref="input"
      v-model="autocomplete"
      :style="styles"
      :class="[
        classNames,
        { 'env-valid': isEnvFound && isEnvUsageValid, 'env-invalid': isEnvFound && !isEnvUsageValid },
      ]"
      @input="onInput"
      @keydown.native="onKeyup"
    />

    <v-menu ref="autoMenu" v-model="show" :position-x="x" :position-y="y" dense :min-width="width">
      <v-list dense>
        <v-list-item
          v-for="(item, index) in envValues"
          :key="index"
          @click="onSelect(item)"
          @keyup.enter="onSelect(item)"
        >
          <v-list-item-title>{{ item }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
// http://jsfiddle.net/pranavcbalan/qg5xyko6/

export default {
  name: 'XAutoComplete',
  props: {
    value: String,
    env: String,
    styles: [Array, Object, String],
  },
  data() {
    return {
      show: false,
      x: 0,
      y: 0,
      activeValue: '',
      curPos: 0,
      input: null,
      el: null,
    };
  },
  computed: {
    // filtered list based on input
    items() {
      return this.envValues.filter(s => s.includes(this.activeValue));
    },
    // for setting menu width to textfield width
    width() {
      return this.input && this.input.clientWidth;
    },
    // extracting class names from root element
    classNames() {
      return this.el && this.el.className;
    },
    // v-model for the text filed
    autocomplete: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
    //  extracting current env keys
    envValues() {
      const envObj = this.isDashboard
        ? this.$store.getters['project/GtrApiEnvironment']
        : this.$store.getters['project/GtrDefaultApiEnvironment'];
      return envObj && envObj[this.env] ? Object.keys(envObj[this.env]) : [];
    },
    isEnvFound() {
      return /{{\s*\w+\s*}}/.test(this.value);
    },
    isEnvUsageValid() {
      const re = /{{\s*(\w+)\s*}}/g;
      let m;
      // eslint-disable-next-line no-cond-assign
      while ((m = re.exec(this.value))) {
        if (!this.envValues.includes(m[1])) {
          return false;
        }
      }
      return true;
    },
  },
  mounted() {
    this.el = this.$el;
    // getting input element reference
    this.input = this.$refs.input && this.$refs.input.$el.querySelector('input');
  },
  created() {},
  methods: {
    // handling input event
    onInput(v) {
      this.curPos = this.input.selectionStart || 0;
      // extracting string from beginning to caret position
      // then using regex to check and extract certain pattern like
      // eg: {{ , {{ someWord,...
      const m = v.slice(0, this.curPos).match(/{{\s?(\w*)$/);
      if (m) {
        this.activeValue = m[1] || '';
        this.show = true;
        // calculate menu position relative to input element
        this.x = this.input.getBoundingClientRect().left; // + (this.curPos * 8) % this.$refs.input.$el.clientWidth;
        this.y = this.input.getBoundingClientRect().top + this.input.clientHeight;
      } else {
        this.show = false;
      }
    },
    onKeyup(e) {
      const menu = this.$refs.autoMenu;
      // handlig up and down keys
      if (this.show && (e.which === 40 || e.which === 38)) {
        e.preventDefault();
        menu.onKeyDown(e);
        return;
      }
      // handling enter and space
      if (this.show && (e.which === 13 || e.which === 32)) {
        menu.onKeyDown(e);
      }
    },
    onSelect(item) {
      // appending menu value to the input
      this.input.setRangeText(
        // add closing only when its necessary
        item.slice(this.activeValue.length) +
          (this.autocomplete.substr(this.input.selectionEnd, 2) === '}}' ? '' : '}}'),
        this.input.selectionStart,
        this.input.selectionEnd,
        'end'
      );
      // trigger input event to sync with vue model
      this.input.dispatchEvent(new Event('input'));
      this.show = false;
    },
  },
};
</script>

<style scoped>
/deep/ .env-valid input {
  color: var(--v-success-base) !important;
}

/deep/ .env-invalid input {
  color: var(--v-error-base) !important;
}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->

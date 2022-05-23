<template>
  <div>
    <v-toolbar dense>
      <v-spacer />
      <v-btn outlined x-small :disabled="!index" @click="prev">
        Prev
      </v-btn>
      <v-btn outlined x-small :disabled="index===history.length -1" @click="next">
        Next
      </v-btn>
    </v-toolbar>
    <div id="editor" style="height:500px; width:100%;position: relative">
      <div ref="diff" />
    </div>
  </div>
</template>

<script>

// import ace from 'ace-builds'
//
import AceDiff from 'ace-diff'
/// / optionally, include CSS, or use your own
import 'ace-diff/dist/ace-diff.min.css'
// Or use the dark mode
// import 'ace-diff/dist/ace-diff-dark.min.css';

export default {
  name: 'XcDiff',
  props: {
    value: String,
    history: Array
  },
  data: () => ({
    differ: null,
    index: 0,
    editors: null
  }),
  watch: {
    index(i) {
      if (this.editors) {
        this.editors.right.setValue(this.history[i])
      }
    }
  },
  mounted() {
    this.differ = new AceDiff({
      element: this.$refs.diff,
      left: {
        content: this.value,
        copyLinkEnabled: false
      },
      right: {
        content: this.history[this.index],
        editable: false
      },
      diffGranularity: 'specific'

    })

    this.editors = this.differ.getEditors()
    this.editors.left.on('change', () => {
      this.$emit('input', this.editors.left.getValue())
    })
  },
  methods: {
    prev() {
      this.index && --this.index
    },
    next() {
      if (this.index < this.history.length - 1) { ++this.index }
    }
  }
}
</script>

<style scoped>
/deep/ *, /deep/ div {
  font-size: 12px !important;
  font-family: monospace !important;
  word-spacing: 0;
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

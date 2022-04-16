<template>
  <v-container class="ma-0 pa-0" fluid>
    <v-col cols="12" class="px-0">
      <v-toolbar text height="42" class="grey--text">
        {{ heading }}
        <v-spacer />
        <x-btn tooltip="Prettify SQL" small outlined btn.class="grey--text" @click="pretify">
          Prettify
        </x-btn>
      </v-toolbar>
      <monaco-editor
        ref="editor"
        v-model="codeLocal"
        :style="cssStyle ? cssStyle : ''"
        class="editor card"
        theme="vs-dark"
        lang="sql"
        :minimap="minimap"
        :read-only="readOnly"
        @selection="selectionFn"
      />
    </v-col>
  </v-container>
</template>

<script>
import sqlFormatter from 'sql-formatter'
import MonacoEditor from './index.js'

export default {
  ssr: false,
  components: {
    MonacoEditor
    // sqlFormatter
  },
  props: ['code', 'cssStyle', 'readOnly', 'heading'],
  data() {
    return {
      codeLocal: `${this.code || ''}`,
      selection: null,
      minimap: {
        enabled: true
      }
    }
  },
  computed: {},
  watch: {
    codeLocal(newValue) {
      // INFO: for updating value of prop `code` in parent comp
      this.$emit('update:code', newValue)
    },
    code(newValue) {
      this.codeLocal = newValue
    }
  },
  beforeCreate() {
    // console.log(MonacoEditor)
  },
  created() {
    //
  },
  methods: {
    selectionFn() {
      const editor = this.$refs.editor.getMonaco()
      const range = editor.getSelection()
      const selectedText = editor.getModel().getValueInRange(range)
      this.selection = selectedText
      this.selectionRange = range
    },
    pretify() {
      // console.log("this.code", this.code);
      const editor = this.$refs.editor.getMonaco()

      if (this.selection && this.selectionRange) {
        const op = {
          identifier: 'prettifySelection',
          range: this.selectionRange,
          text: sqlFormatter.format(this.selection),
          forceMoveMarkers: true
        }
        editor.executeEdits('sqlFormatter', [op])
        this.selection = null
        this.selectionRange = null
      } else {
        // console.log("selected format before:: ", this.codeLocal);
        const op = {
          identifier: 'prettifyDoc',
          range: editor.getModel().getFullModelRange(),
          text: sqlFormatter.format(this.codeLocal || ''),
          forceMoveMarkers: true
        }
        editor.executeEdits('sqlFormatter', [op])
      }
    },
    toggleMiniMap() {
      const editor = this.$refs.editor.getMonaco()
      this.minimap.enabled = !this.minimap.enabled
      editor.updateOptions({
        minimap: {
          enabled: this.minimap.enabled
        }
      })
    }
  }
}
</script>

<style>
  .editor {
    /* width: 100%;
    height: 800px; */
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

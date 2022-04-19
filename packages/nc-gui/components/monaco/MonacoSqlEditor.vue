<template>
  <v-container
    class="ma-0 pa-0"
    style="height:calc(100% - 50px)"
    fluid
    :style="cssStyle ? cssStyle : ''"
  >
    <monaco-editor
      ref="editor"
      v-model="codeLocal"
      style="height: 100% "
      class="editor card"
      theme="vs-dark"
      lang="sql"
      :minimap="minimap"
      :read-only="readOnly"
      :actions="actions"
      :tables="tables"
      :column-names="columnNames"
      :column-name-cbk="columnNameCbk"
      @selection="selectionFn"
    />
  </v-container>
</template>

<script>
import sqlFormatter from 'sql-formatter'
import MonacoEditor from './index.js'

const monaco = require('monaco-editor')
export default {
  ssr: false,
  components: {
    MonacoEditor
    // sqlFormatter
  },
  props: ['code', 'cssStyle', 'readOnly', 'heading', 'tables', 'columnNames', 'columnNameCbk'],
  data() {
    const vm = this
    return {
      codeLocal: `${this.code || ''}`,
      selection: null,
      minimap: {
        enabled: true
      },
      actions: [{
        // An unique identifier of the contributed action.
        id: 'x-sql-pretify',
        // A label of the action that will be presented to the user.
        label: 'Format SQL',
        // An optional array of keybindings for the action.
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KEY_L
        ],
        // A precondition for this action.
        precondition: null,
        // A rule to evaluate on top of the precondition in order to dispatch the keybindings.
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        // Method that will be executed when the action is triggered.
        // @param editor The editor instance is passed in as a convinience
        run(ed) {
          vm.pretify()
        }
      }, {
        // An unique identifier of the contributed action.
        id: 'x-sql-execute',
        // A label of the action that will be presented to the user.
        label: 'Run Query',
        // An optional array of keybindings for the action.
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter
        ],
        // A precondition for this action.
        precondition: null,
        // A rule to evaluate on top of the precondition in order to dispatch the keybindings.
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        // Method that will be executed when the action is triggered.
        // @param editor The editor instance is passed in as a convinience
        run(ed) {
          vm.$emit('execute', ed)
        }
      }, {
        id: 'x-sql-run-all',
        label: 'Run All',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.Enter
        ],
        precondition: null,
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run(ed) {
          vm.$emit('runAll', ed)
        }
      }, {
        id: 'x-sql-bookmark',
        label: 'Bookmark Query',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_B
        ],
        precondition: null,
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run(ed) {
          vm.$emit('bookmark', ed)
        }
      }, {
        id: 'x-sql-search',
        label: 'Search Query History',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_P
        ],
        precondition: null,
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run(ed) {
          vm.$emit('searchHistory', ed)
        }
      }, {
        id: 'x-sql-toggle-bookmark',
        label: 'Show/Hide Bookmarks',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_K
        ],
        precondition: null,
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run(ed) {
          vm.$emit('toggleBookmark', ed)
        }
      }, {
        id: 'x-sql-file-open',
        label: 'Open File',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_O
        ],
        precondition: null,
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run(ed) {
          vm.$emit('openFile', ed)
        }
      }, {
        id: 'x-sql-save-file',
        label: 'Save File',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S
        ],
        precondition: null,
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run(ed) {
          vm.$emit('saveFile', ed)
        }
      }, {
        id: 'x-sql-clear-editor',
        label: 'Clear Editor',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_N
        ],
        precondition: null,
        keybindingContext: null,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run(ed) {
          vm.$emit('clearEditor', ed)
        }
      }]

    }
  },
  computed: {},
  watch: {
    codeLocal(newValue) {
      // INFO: for updating value of prop `code` in parent comp
      // console.log("update:code Event Emitted", newValue);
      this.$emit('update:code', newValue)
    },
    code(newValue) {
      this.codeLocal = newValue
    }
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
    },
    getCurrentQuery() {
      return this.$refs.editor.getCurrentQuery()
    },
    getAllContent() {
      return this.$refs.editor.getAllContent()
    },
    focus() {
      this.$refs.editor.focus()
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

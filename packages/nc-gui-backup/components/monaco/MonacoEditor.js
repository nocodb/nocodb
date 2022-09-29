/* eslint-disable  */
import assign from "nano-assign";
import sqlAutoCompletions from "./sqlAutoCompletions";


export default {
  name: "MonacoEditor",

  props: {
    value: String,
    theme: {
      type: String,
      default: "vs"
    },
    lang: String,
    options: Object,
    readOnly: Boolean,
    amdRequire: {
      type: Function
    },
    sqlType: String,
    actions: Array,
    tables: Array,
    columnNames: Object,
    columnNameCbk: Function
  },

  model: {
    event: "change"
  },
  data() {
    return {completionItemProvider: null}
    //   return {
    //     tables: ["abc", "efg", "actor", "country"],
    //     columnNames: {
    //       abc: ["id", "name"],
    //       efg: ["eid", "title"],
    //       actor: ["aid", "firstName"],
    //       country: ["id", "code", "name"]
    //     }
    //   }
  },
  watch: {
    options: {
      deep: true,
      handler(options) {
        if (this.editor) {
          this.editor.updateOptions(options);
        }
      }
    },

    value(newValue) {
      if (this.editor) {
        if (newValue !== this.editor.getValue()) {
          this.editor.setValue(newValue);
        }
      }
    },

    lang(newVal) {
      if (this.editor) {
        window.monaco.editor.setModelLanguage(this.editor.getModel(), newVal);
      }
    },

    theme(newVal) {
      if (this.editor) {
        window.monaco.editor.setTheme(newVal);
      }
    }
  },

  mounted() {
    if (this.amdRequire) {
      this.amdRequire(["vs/editor/editor.main"], () => {
        this.initMonaco(window.monaco);
      });
    } else {
      // ESM format so it can't be resolved by commonjs `require` in eslint
      // eslint-disable import/no-unresolved
      const monaco = require("monaco-editor");
      // monaco.editor.defineTheme('monokai', require('./Cobalt.json'))
      // monaco.editor.setTheme('monokai')

      this.monaco = monaco;

      // this.completionItemProvider =  monaco.languages.registerCompletionItemProvider("sql", {
      //   async provideCompletionItems(model, position) {
      //      // console.log(sqlAutoCompletions(monaco).actions[0])
      //     console.log(model === vm.editor,model,vm.editor)
      //      return model === vm.editor.getModel() ? {suggestions: await vm.getLiveSuggestionsList(model, position)} : {};
      //    }
      //  });
      this.initMonaco(monaco);
    }
  },
  unmounted() {

  },

  beforeDestroy() {
    this.editor && this.editor.dispose();
  },

  methods: {
    initMonaco(monaco) {
      const options = assign(
        {
          value: this.value,
          theme: this.theme,
          language: this.lang,
          // quickSuggestions: { other: true, comments: true, strings: true },
          automaticLayout: true,
          readOnly: false
        },
        this.options
      );

      this.editor = monaco.editor.create(this.$el, options);
      this.$emit("editorDidMount", this.editor);
      this.editor.onContextMenu(event => this.$emit("contextMenu", event));
      this.editor.onDidBlurEditorWidget(() => this.$emit("blur"));
      this.editor.onDidBlurEditorText(() => this.$emit("blurText"));
      this.editor.onDidChangeConfiguration(event => this.$emit("configuration", event));
      this.editor.onDidChangeCursorPosition(event => this.$emit("position", event));
      this.editor.onDidChangeCursorSelection(event => this.$emit("selection", event));
      this.editor.onDidChangeModel(event => this.$emit("model", event));
      this.editor.onDidChangeModelContent(event => {
        const value = this.editor.getValue();
        if (this.value !== value) {
          this.$emit("change", value, event);
        }
      });
      this.editor.onDidChangeModelDecorations(event => this.$emit("modelDecorations", event));
      this.editor.onDidChangeModelLanguage(event => this.$emit("modelLanguage", event));
      this.editor.onDidChangeModelOptions(event => this.$emit("modelOptions", event));
      this.editor.onDidDispose(event => this.$emit("afterDispose", event));
      this.editor.onDidFocusEditorWidget(() => this.$emit("focus"));
      this.editor.onDidFocusEditorText(() => this.$emit("focusText"));
      this.editor.onDidLayoutChange(event => this.$emit("layout", event));
      this.editor.onDidScrollChange(event => this.$emit("scroll", event));
      this.editor.onKeyDown(event => this.$emit("keydown", event));
      this.editor.onKeyUp(event => this.$emit("keyup", event));
      this.editor.onMouseDown(event => this.$emit("mouseDown", event));
      this.editor.onMouseLeave(event => this.$emit("mouseLeave", event));
      this.editor.onMouseMove(event => this.$emit("mouseMove", event));
      this.editor.onMouseUp(event => this.$emit("mouseUp", event));

      if (this.actions && this.actions.length)
        this.actions.forEach(action => this.editor.addAction(action));
    },

    getMonaco() {
      return this.editor;
    },
    getMonacoModule() {
      return this.monaco;
    },

    focus() {
      this.editor.focus();
      this.$nextTick(() => {
        this.editor.setPosition({lineNumber: this.editor.getModel().getLineCount(), column: 1})
        this.editor.revealLineInCenter(this.editor.getModel().getLineCount())
      })
    },
    getCurrentQuery() {
      return this.editor.getModel().getValueInRange(this.editor.getSelection()) || this.getCurrentFocusedQuery().trim();
    },
    getAllContent() {
      return this.editor.getModel().getValueInRange(this.editor.getSelection()) || this.editor.getValue();
    },
    getCurrentFocusedQuery() {
      const line = this.editor.getPosition().lineNumber;
      if (this.editor.getValue().split('\n')[line - 1].trim() === '') return '';
      let c = 1;
      return this.editor.getValue()
        .split(/\n\n/)
        .find((query, i) => {
          let lines = query.split('\n');
          return c + 2 * i <= line && 2 * i + (c += lines.length - 1) >= line;
        }) || '';
    },
    async getLiveSuggestionsList(model, position) {

      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });

      var suggestions;
      var match;

      if (this.tables) {
        if (
          (match = textUntilPosition.match(/(from|table|update|select|into)\s+$/i))
        ) {
          suggestions = this.tables.map(name => ({
            insertText: `\`${name}\`${
              match[1].toLowerCase() === "select" ? "." : " "
            }`,
            label: name
          }));
        }
      }

      if (this.columnNames) {
        if (
          (match = textUntilPosition.match(/select\s+(`?)(\w+)\1\.$/i))
        ) {
          suggestions = (await this.getColumnNames(match[2]) || []).map(name => ({
            insertText: `\`${name}\``,
            label: name
          }));
        } else if (
          (match = textUntilPosition.match(
            /insert\s+into\s+(`?)(\w+)\1\s+\(\s*(\s*`?\w+`?\s*,\s*)*$/i
          ))
        ) {
          let columns = (await this.getColumnNames(match[2]) || []);
          if (!match[3] && columns.length) columns =  [...columns,columns.join('`,`')]
          suggestions = columns.map(name => ({
            insertText: `\`${name}\``,
            label: name
          }));
        } else if (
          (match = textUntilPosition.match(
            /update\s+(`?)(\w+)\1\s+set\s+(?:\s*`?\w+`?\s*=\s*(?:'(?:[^']|\\')*'|\d+|NULL)\s*,\s*)*$/i
          ))
        ) {
          suggestions = (await this.getColumnNames(match[2]) || []).map(name => ({
            insertText: `\`${name}\` = `,
            label: name
          }));
        } else if (
          (match = textUntilPosition.match(
            /(?:from|update)\s*(`?)(\w+)\1[\s\S]*?(?:where|and|or)\s*$/i
          ))
        ) {
          suggestions = (await this.getColumnNames(match[2]) || []).map(name => ({
            insertText: `\`${name}\` `,
            label: name
          }));
        }
      }
      return suggestions || sqlAutoCompletions(monaco);

    }, async getColumnNames(tn) {
      if (tn in this.columnNames) return this.columnNames[tn];
      else {
        if (this.columnNameCbk) return await this.columnNameCbk(tn);
      }
    }
  },

  render(h) {
    return h("div");
  },
  created() {
    const vm = this;
    const monaco = require("monaco-editor");
    this.completionItemProvider = monaco.languages.registerCompletionItemProvider("sql", {
      async provideCompletionItems(model, position) {
        return model === vm.editor.getModel() ? {suggestions: await vm.getLiveSuggestionsList(model, position)} : {};
      }
    });
  },
  destroyed() {
    if (this.completionItemProvider) this.completionItemProvider.dispose();
  }
};
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

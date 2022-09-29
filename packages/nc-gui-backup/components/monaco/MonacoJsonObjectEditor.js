/* eslint-disable  */
// import assign from "nano-assign";
// import sqlAutoCompletions from "./sqlAutoCompletions";
// import {ext} from "vee-validate/dist/rules.esm";


export default {
  name: "MonacoJsonObjectEditor",

  props: {
    value: {
      type: Object
    },
    theme: {
      type: String,
      default: "vs-dark"
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
    columnNameCbk: Function,
    validate: {
      type: Boolean,
      default: true
    }
  },
  emits: ['validate'],
  model: {
    event: "change"
  },
  watch: {
    value(newVal) {
      if (this.editor && !this.deepcompare(newVal, JSON.parse(this.editor.getValue())))
        this.editor.setValue(JSON.stringify(newVal, 0, 2));

    }
  },

  mounted() {
    this.$nextTick(() => {
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
        setTimeout(() => this.resizeLayout(), 1000)
      }
    });
  },
  unmounted() {

  },

  beforeDestroy() {
    this.editor && this.editor.dispose();
  },

  methods: {
    resizeLayout() {
      this.editor.layout();
    },
    initMonaco(monaco) {


      var jsonCode = JSON.stringify(this.value, 0, 2);
      var model = monaco.editor.createModel(jsonCode, "json");


      // this.editor = monaco.editor.create(this.$el, options);


// configure the JSON language support with schemas and schema associations
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: this.validate,
      });


      this.editor = monaco.editor.create(this.$el, {
        model: model,
        theme: this.theme,
      });

      this.editor.onDidChangeModelContent(event => {
        const value = this.editor.getValue();
        try {
          if (!this.deepcompare(this.value, JSON.parse(value))) {
            this.$emit("change", JSON.parse(value), event);
          }
          this.$emit("validate", true);
        } catch (e) {
          this.$emit("validate", false, e);
          // console.log('monaco', e)
        }
      });


    },

    getMonaco() {
      return this.editor;
    },
    getMonacoModule() {
      return this.monaco;
    },
    deepcompare(a, b) {
      if (a === b) return true;
      if (a == null || b === null) return false;
      if (typeof a !== typeof b) return false;
      if (typeof a !== 'object') return a === b;
      if (Object.keys(a).length != Object.keys(b).length) return false;

      for (var k in a) {
        if (!(k in b)) return false;
        if (!this.deepcompare(a[k], b[k])) return false;
      }
      return true;
    }

  },

  render(h) {
    return h("div");
  },
  created() {
  },
  destroyed() {
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

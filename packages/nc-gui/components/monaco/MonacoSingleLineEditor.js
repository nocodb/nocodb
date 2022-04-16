/* eslint-disable  */
// import assign from "nano-assign";
// import sqlAutoCompletions from "./sqlAutoCompletions";
// import {ext} from "vee-validate/dist/rules.esm";


export default {
  name: "MonacoSingleLineEditor",

  props: {
    value: {
      default: "",
      type: String
    },
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
    columnNameCbk: Function,
    lineDecorationsWidth: 0,
    scrollbar: {
      vertical: 'hidden'
    },
    env: String
  },

  model: {
    event: "change"
  },
  watch: {
    value(val) {
      if (val !== this.editor.getValue())
        this.editor.setValue(val)
    }
  },
  data() {
    return {
      tokRef: null,
      completionItemProvider: null,
      envValues: []
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
      setTimeout( () => this.editor.layout(),100);
    }
  },
  unmounted() {

  },

  beforeDestroy() {
    this.editor && this.editor.dispose();
  },

  methods: {
    initMonaco(monaco) {


      const initValue = this.value.replace(/\n/g, ' ');


      /*----------------------------------------SAMPLE JS START*/
// Register a new language
      monaco.languages.register({id: 'mySpecialLanguage'});
// Register a tokens provider for the language
      this.tokRef = monaco.languages.setMonarchTokensProvider('mySpecialLanguage', {
        tokenizer: {
          root: [
            [new RegExp('{{\\s*(' + this.envValues.join('|') + ')\\s*}}'), "custom-valid"],
            [/{{\s*\w+\s*}}/, "custom-invalid"]
          ]
        }
      });
// Define a new theme that contains only rules that match this language
      monaco.editor.defineTheme('myCoolTheme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          {token: 'custom-valid', foreground: '4CAF50', fontStyle: 'bold'},
          {token: 'custom-invalid', foreground: 'ff0000', fontStyle: 'bold red wavy underline'}
        ]
      });
// Register a completion item provider for the new language
//       monaco.languages.registerCompletionItemProvider('', {
//         provideCompletionItems:
//       });
      ;
      /*----------------------------------------SAMPLE CSS END*/


      monaco.languages.setLanguageConfiguration('mySpecialLanguage', {
        onEnterRules: [
          {
            action: {
              beforeText: /.*/, appendText: ''
            }
          }
        ]
      })


      const cssFormatProvider = {
        provideDocumentFormattingEdits(model, options, token) {
          return [{
            text: model.getValue().replace(/\n/g, ' '),
            range: model.getFullModelRange()
          }];
        }
      };
      const languageId = 'mySpecialLanguage';

      monaco.languages.registerDocumentFormattingEditProvider(languageId, cssFormatProvider);


      this.editor = monaco.editor.create(this.$el, {
        theme: 'myCoolTheme',
        value: initValue,
        language: 'mySpecialLanguage',
        lineNumbers: 'off',
        codeLens: false,
        disableLayerHinting: true,
        minimap: {
          enabled: false
        },
        glyphMargin: false,
        "autoIndent": true,
        lineHeight: '46px',
      });

      // this.editor.addCommand(monaco.KeyCode.Enter, function (accessor) {
      //   this.editor.trigger('bla', 'type', {text: ''});
      // });

//       var model = monaco.editor.createModel(code, "mySpecialLanguage");
//
//
//       // this.editor = monaco.editor.create(this.$el, options);
//
//
// // configure the JSON language support with schemas and schema associations
//       monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
//         validate: true,
//       });
//
//
//       this.editor = monaco.editor.create(this.$el, {
//         model: model
//       });
//
      this.editor.onDidChangeModelContent(event => {
        const value = this.editor.getValue();
        if (this.value !== value) {
          this.$emit("change", value.replace(/\n/g,' '), event);
        }
      });


    },

    getMonaco() {
      return this.editor;
    },
    getMonacoModule() {
      return this.monaco;
    },
    getLiveSuggestionsList(model, position) {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      });

      let suggestions = [];
      let match;

      if (
        (match = textUntilPosition.match(/{{\s*(\w*)$/))
      ) {

        // (match[1] ? this.envValues.filter(env => env.indexOf(match[1]) > -1) :
        suggestions = this.envValues.map(name => ({
          insertText: name,
          label: name
        }));
      }


      return suggestions;
    }


  },

  render(h) {
    return h("div");
  },
  created() {
    const vm = this;
    const monaco = require("monaco-editor");


    if (this.$store.getters['project/GtrProjectJson'])
      this.envValues = [...Object.keys(this.$store.getters['project/GtrProjectJson'].api),
        ...(this.$store.getters['project/GtrProjectJson'].envs ?
          Object.keys(this.$store.getters['project/GtrProjectJson'].envs[this.env].api) : [])];

    this.$store.watch(
      (state) => state.project.unserializedList,
      (unserializedList) => {
        if (this.tokRef) this.tokRef.dispose();
        this.envValues = [...Object.keys(this.$store.getters['project/GtrProjectJson'].api),
          ...(this.$store.getters['project/GtrProjectJson'].envs ?
            Object.keys(this.$store.getters['project/GtrProjectJson'].envs[this.env].api) : [])];

        this.tokRef = monaco.languages.setMonarchTokensProvider('mySpecialLanguage', {
          tokenizer: {
            root: [
              [new RegExp('{{\\s*(' + this.envValues.join('|') + ')\\s*}}'), "custom-valid"],
              [/{{\s*\w+\s*}}/, "custom-invalid"]
            ]
          }
        });
      }
    )


    this.completionItemProvider = monaco.languages.registerCompletionItemProvider("mySpecialLanguage", {
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

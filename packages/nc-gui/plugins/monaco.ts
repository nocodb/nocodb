import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&inline'

export default defineNuxtPlugin(() => {
  /**
   * Adding monaco editor to Vite
   *
   **/
  self.MonacoEnvironment = window.MonacoEnvironment = {
    async getWorker(_: any, label: string) {
      switch (label) {
        case 'typescript':
        case 'javascript': {
          return new TypeScriptWorker()
        }
        case 'json': {
          return new JsonWorker()
        }
        default: {
          return new EditorWorker()
        }
      }
    },
  }
})

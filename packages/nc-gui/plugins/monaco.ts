import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline'

export default defineNuxtPlugin(() => {
  import('monaco-editor/esm/vs/language/typescript/ts.worker?worker&inline').then((md) => {
    const TypeScriptWorker = md.default

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
})

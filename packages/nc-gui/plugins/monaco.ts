import getCrossOriginWorkerURL from 'crossoriginworker';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&url'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&url'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url'

export default defineNuxtPlugin(async () => {
  const editorWorker = new Worker(await getCrossOriginWorkerURL(EditorWorker), { type: 'module' })
  const jsonWorker = new Worker(await getCrossOriginWorkerURL(JsonWorker), { type: 'module' })
  const tsWorker = new Worker(await getCrossOriginWorkerURL(TypeScriptWorker), { type: 'module' })

  /**
   * Adding monaco editor to Vite
   *
   **/
  self.MonacoEnvironment = window.MonacoEnvironment = {
    async getWorker(_: any, label: string) {
      switch (label) {
        case 'typescript':
        case 'javascript': {
          return tsWorker
        }
        case 'json': {
          return jsonWorker
        }
        default: {
          return editorWorker
        }
      }
    },
  }
})

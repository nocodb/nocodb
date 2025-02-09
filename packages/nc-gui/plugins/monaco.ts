import getCrossOriginWorkerURL from 'crossoriginworker'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&url'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&url'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url'

export default defineNuxtPlugin(async () => {
  const editorWorker = new Worker(
    await getCrossOriginWorkerURL(EditorWorker),
    process.env.NODE_ENV === 'development' ? { type: 'module' } : undefined,
  )
  const jsonWorker = new Worker(
    await getCrossOriginWorkerURL(JsonWorker),
    process.env.NODE_ENV === 'development' ? { type: 'module' } : undefined,
  )
  const tsWorker = new Worker(
    await getCrossOriginWorkerURL(TypeScriptWorker),
    process.env.NODE_ENV === 'development' ? { type: 'module' } : undefined,
  )

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

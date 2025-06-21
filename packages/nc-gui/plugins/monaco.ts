import getCrossOriginWorkerURL from 'crossoriginworker'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&url'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&url'
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url'
import * as monaco from 'monaco-editor'

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

  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    diagnosticCodesToIgnore: [1375, 1378, 2451, 6385, 1108],
    noSyntaxValidation: false,
  })

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    noLib: false,
    strictFunctionTypes: true,
    strict: true,
  })

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

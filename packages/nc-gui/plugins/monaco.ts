import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline'

export default defineNuxtPlugin(() => {
  /**
   * Adding monaco editor to Vite
   *
   * @ts-expect-error */
  self.MonacoEnvironment = window.MonacoEnvironment = {
    async getWorker(_: any, label: string) {
      switch (label) {
        case 'json': {
          const workerBlob = new Blob([JsonWorker], { type: 'text/javascript' })
          return await initWorker(URL.createObjectURL(workerBlob))
        }
        default: {
          const workerBlob = new Blob([EditorWorker], { type: 'text/javascript' })
          return await initWorker(URL.createObjectURL(workerBlob))
        }
      }
    },
  }
})

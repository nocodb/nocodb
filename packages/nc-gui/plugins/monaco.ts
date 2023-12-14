import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'

import EditorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker?worker&url'
import TsWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url'
import JsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?worker&url'

import { initWorker } from '#imports'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
window.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'typescript' || label === 'javascript') return initWorker(TsWorkerUrl)
    if (label === 'json') return initWorker(JsonWorkerUrl)
    return initWorker(EditorWorkerUrl)
  },
}

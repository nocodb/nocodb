import * as esbuild from 'esbuild-wasm'
import wasmUrl from 'esbuild-wasm/esbuild.wasm?url'

let isEsbuildInitialized = false
let initPromise: Promise<void> | null = null

export function useEsbuild() {
  const isInitializing = ref(false)
  const initError = ref(null)

  const initWasm = async () => {
    if (isEsbuildInitialized) {
      return
    }

    // If initialization is already in progress, return the existing promise
    if (initPromise) {
      return initPromise
    }

    isInitializing.value = true
    initError.value = null

    initPromise = (async () => {
      try {
        await esbuild.initialize({
          wasmURL: wasmUrl,
        })
        isEsbuildInitialized = true
      } catch (error) {
        console.error('Failed to initialize esbuild:', error)
        initError.value = error
      } finally {
        isInitializing.value = false
        initPromise = null
      }
    })()

    return initPromise
  }

  const transform = async (code: string) => {
    await initWasm()

    if (!isEsbuildInitialized) {
      throw new Error('esbuild initialization failed')
    }

    try {
      const result = await esbuild.transform(code, {
        loader: 'ts',
        minify: true,
        platform: 'browser',
        target: 'chrome64',
      })
      return {
        code: result.code,
        map: result.map,
        warnings: result.warnings,
        error: null,
      }
    } catch (error) {
      return {
        code: null,
        map: null,
        warnings: [],
        error: error.message,
      }
    }
  }

  return {
    initWasm,
    transform,
    esbuildInitialized: computed(() => isEsbuildInitialized),
    isInitializing,
    initError,
  }
}

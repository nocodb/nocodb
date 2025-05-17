import * as esbuild from 'esbuild-wasm'
import wasmUrl from 'esbuild-wasm/esbuild.wasm?url'

export function useEsbuild() {
  const esbuildInitialized = ref(false)
  const isInitializing = ref(false)
  const initError = ref(null)

  const initWasm = async () => {
    if (esbuildInitialized.value) {
      return
    }

    if (isInitializing.value) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!isInitializing.value) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
      })
    }

    isInitializing.value = true
    initError.value = null

    try {
      await esbuild.initialize({
        wasmURL: wasmUrl,
      })
      esbuildInitialized.value = true
    } catch (error) {
      console.error('Failed to initialize esbuild:', error)
      initError.value = error
    } finally {
      isInitializing.value = false
    }
  }

  const transform = async (code: string) => {
    await initWasm()

    if (!esbuildInitialized.value) {
      throw new Error('esbuild initialization failed')
    }
    try {
      const result = await esbuild.transform(code, { loader: 'js', minify: true, platform: 'browser', target: 'chrome64' })
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
    esbuildInitialized,
    isInitializing,
    initError,
  }
}

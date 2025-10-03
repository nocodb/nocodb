import * as esbuild from 'esbuild-wasm'
import type { Plugin } from 'esbuild-wasm'
import wasmUrl from 'esbuild-wasm/esbuild.wasm?url'

let isEsbuildInitialized = false
let initPromise: Promise<void> | null = null
const moduleCache = new Map<string, string>()

interface TransformResult {
  code: string | null
  map: string | null
  warnings: esbuild.Message[]
  error: string | null
}

export function useEsbuild() {
  const isInitializing = ref(false)
  const initError = ref()

  const initWasm = async () => {
    if (initPromise) return initPromise

    isInitializing.value = true
    initError.value = null

    initPromise = (async () => {
      try {
        await esbuild.initialize({ wasmURL: wasmUrl })
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

  const getCdnUrl = async (packageName: string): Promise<string> => {
    const cdnUrls = [
      `https://esm.sh/${packageName}`,
      `https://unpkg.com/${packageName}?module`,
      `https://cdn.skypack.dev/${packageName}`,
      `https://cdn.jsdelivr.net/npm/${packageName}/+esm`,
    ]

    for (const url of cdnUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' })
        if (response.ok) {
          return url
        }
      } catch (error) {
        console.warn(`Failed to check availability of ${url}: ${error}`)
      }
    }
    return cdnUrls[0] as string
  }

  const createHttpPlugin = (): Plugin => ({
    name: 'http',
    setup(build) {
      // Intercept imports
      build.onResolve({ filter: /.*/ }, async (args) => {
        // Skip if already in http-url namespace
        if (args.namespace === 'http-url') {
          // Handle relative/absolute paths within downloaded modules
          if (args.path.startsWith('/')) {
            const importerUrl = new URL(args.importer)
            return {
              path: `${importerUrl.origin}${args.path}`,
              namespace: 'http-url',
            }
          } else if (args.path.startsWith('./') || args.path.startsWith('../')) {
            return {
              path: new URL(args.path, args.importer).toString(),
              namespace: 'http-url',
            }
          }
          return undefined
        }

        // Handle explicit http/https URLs
        if (/^https?:\/\//.test(args.path)) {
          return {
            path: args.path,
            namespace: 'http-url',
          }
        }

        // Handle bare imports (package names) - convert to CDN URL
        if (!/^\./.test(args.path) && args.namespace !== 'file') {
          const cdnUrl = await getCdnUrl(args.path)

          return {
            path: cdnUrl,
            namespace: 'http-url',
          }
        }

        return undefined
      })

      // Load from HTTP
      build.onLoad({ filter: /.*/, namespace: 'http-url' }, async (args) => {
        if (moduleCache.has(args.path)) {
          return {
            contents: moduleCache.get(args.path),
            loader: 'js',
          }
        }

        try {
          const response = await fetch(args.path)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const contents = await response.text()
          moduleCache.set(args.path, contents)

          return {
            contents,
            loader: 'js',
          }
        } catch (error) {
          return {
            errors: [
              {
                text: `Failed to fetch ${args.path}: ${error.message}`,
              },
            ],
          }
        }
      })
    },
  })

  const transformWithImports = async (code: string): Promise<TransformResult> => {
    await initWasm()

    if (!isEsbuildInitialized) {
      throw new Error('esbuild initialization failed')
    }

    try {
      const result = await esbuild.build({
        stdin: {
          contents: code,
          loader: 'ts',
          sourcefile: 'input.ts',
        },
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        target: 'es2020',
        sourcemap: 'inline',
        plugins: [createHttpPlugin()],
        external: [],
      })

      const outputFile = result.outputFiles?.[0]

      return {
        code: outputFile?.text || null,
        map: null,
        warnings: result.warnings,
        error: null,
      }
    } catch (error) {
      console.error('Build error:', error)
      return {
        code: null,
        map: null,
        warnings: [],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  return {
    initWasm,
    transformWithImports,
    isInitializing,
    initError,
  }
}

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const testRoot = fileURLToPath(new URL('.', import.meta.url))
const guiRoot = fileURLToPath(new URL('../../', import.meta.url))
const coreContext = `${testRoot}fixtures/core-context.ts`
const uiContext = `${testRoot}fixtures/ui-context.ts`
const sourceContext = process.env.NOCODB_INDICATOR_TEST_CONTEXT || testRoot
const createContext = `${testRoot}fixtures/create-context.ts`
const createSdk = `${testRoot}fixtures/create-sdk.ts`
const coreImports = [
  'computed',
  'inject',
  'nextTick',
  'provide',
  'ref',
  'watch',
  'storeToRefs',
  'onKeyStroke',
  'useDebounceFn',
  'useMagicKeys',
  'useVModel',
  'ActiveViewInj',
  'IsLockedInj',
  'MetaInj',
  'ProjectInj',
  'SidebarSectionIndentInj',
  'TreeViewInj',
  'useViewsStore',
  'useBases',
  'useNuxtApp',
  'useI18n',
  'useGlobal',
  'useMetas',
  'useRtl',
  'usePersonalViewPermissions',
  'baseOwnSourceId',
  'viewLockIcons',
  'NOCO',
]
const uiImports = [
  'computed',
  'ref',
  'watch',
  'storeToRefs',
  'useVModel',
  'useViewsStore',
  'useI18n',
  'usePersonalViewPermissions',
  'message',
  'extractSdkResponseErrorMsg',
]
const createImports = [
  'computed',
  'ref',
  'reactive',
  'toRefs',
  'storeToRefs',
  'watch',
  'nextTick',
  'onBeforeMount',
  'onMounted',
  'useVModel',
  'useNuxtApp',
  'useGlobal',
  'useMetas',
  'useWorkspace',
  'useBase',
  'useBases',
  'useEeConfig',
  'useRoles',
  'useViewsStore',
  'useCommandPalette',
  'useI18n',
  'useNocoAi',
  'isMac',
  'isAttachment',
  'generateUniqueTitle',
  'ncIsArray',
  'ncIsArrayIncludes',
  'message',
  'extractSdkResponseErrorMsg',
  'viewLockIcons',
]
const modules: Record<string, { path: string; imports?: string[]; context?: string }> = {
  'ViewCreate.vue': { path: 'components/dlg/View/Create.vue', imports: createImports, context: createContext },
  'createContext': { path: 'test/viewRecordIndicators/fixtures/create-context.ts' },
  'ViewNode.vue': { path: 'components/dashboard/TreeView/Views/Node.vue', imports: coreImports, context: coreContext },
  'context': { path: 'context/index.ts' },
  'viewRecordIndicators': { path: 'lib/viewRecordIndicators.ts' },
  'useViewRecordIndicators': { path: 'composables/useViewRecordIndicators.ts' },
  'viewRecordIndicatorPersistence': { path: 'lib/viewRecordIndicatorPersistence.ts' },
  'ViewRecordIndicatorsSettings.vue': {
    path: 'components/smartsheet/toolbar/ViewRecordIndicatorsSettings.vue',
    imports: uiImports,
    context: uiContext,
  },
  'ViewRecordIndicatorsDialog.vue': { path: 'components/dlg/View/RecordIndicators.vue', imports: uiImports, context: uiContext },
  'usePersonalViewPermissions': {
    path: 'composables/usePersonalViewPermissions.ts',
    imports: ['computed', 'useRoles', 'useGlobal'],
    context: uiContext,
  },
}
const virtualPath = (name: string) => `${sourceContext.replace(/\/$/, '')}/.source-${name}${name.endsWith('.vue') ? '' : '.ts'}`
const aliases = Object.entries(modules).map(([name, source]) => ({
  find: `~/${source.path.replace(/\.(ts|vue)$/, '')}`,
  replacement: virtualPath(name),
}))

const isCreateImporter = (importer?: string) =>
  !!importer &&
  /(?:^|\/)(?:create\.spec\.ts|create-context\.ts|create-sdk\.ts|\.source-ViewCreate\.vue|\.source-createContext\.ts)(?:\?|$)/.test(
    importer,
  )

export default defineConfig({
  root: testRoot,
  plugins: [
    {
      name: 'nocodb-component-unit-source',
      enforce: 'pre',
      resolveId(id, importer) {
        if (id === 'nocodb-sdk') return isCreateImporter(importer) ? createSdk : `${testRoot}fixtures/sdk-exports.ts`
        if (id === '#imports') return isCreateImporter(importer) ? createContext : coreContext
        if (id.startsWith('nocodb:') && modules[id.slice(7)]) return virtualPath(id.slice(7))
        if (Object.keys(modules).some((name) => virtualPath(name) === id)) return id
        if (id.startsWith('.') && importer) {
          const originalImporter = Object.entries(modules).find(([name]) => virtualPath(name) === importer)?.[1].path
          const sourcePath = resolve(dirname(originalImporter ? `${guiRoot}${originalImporter}` : importer), id)
          const match = Object.entries(modules).find(([, source]) =>
            [`${guiRoot}${source.path}`, `${guiRoot}${source.path.replace(/\.(ts|vue)$/, '')}`].includes(sourcePath),
          )
          if (match) return virtualPath(match[0])
        }
      },
      load(id) {
        const entry = Object.entries(modules).find(([name]) => virtualPath(name) === id)
        if (!entry) return
        const source = entry[1]
        let content = readFileSync(`${guiRoot}${source.path}`, 'utf8')
        // These tests exercise script/template behavior, not scoped CSS rendering.
        if (entry[0] === 'ViewCreate.vue') content = content.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
        if (!source.imports) return content
        const imports = `import { ${source.imports.join(', ')} } from ${JSON.stringify(source.context)};\n`
        return source.path.endsWith('.vue')
          ? content.replace(/<script\b(?=[^>]*\bsetup\b)[^>]*>/, (opening) => `${opening}\n${imports}`)
          : imports + content
      },
    },
    vue(),
  ],
  resolve: {
    alias: aliases,
    dedupe: ['vue', 'pinia'],
  },
  test: { environment: 'happy-dom', include: ['*.spec.ts'], fileParallelism: false, maxWorkers: 1, restoreMocks: true },
})

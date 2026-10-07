<script setup lang="ts">
import { exampleTokens, usePlaygroundTokens } from '../-helper/tokens'
import type { TokenMode } from '../-helper/tokens'
import AllTokensTab from './token-editor/AllTokensTab.vue'
import ColoursTab from './token-editor/ColoursTab.vue'
import IconsTab from './token-editor/IconsTab.vue'
import ShapeTab from './token-editor/ShapeTab.vue'
import TypographyTab from './token-editor/TypographyTab.vue'

const { isDark } = useTheme()

const { overrides, css, overrideCount, reset, importJson } = usePlaygroundTokens()

const { copy } = useClipboard()

const { t } = useI18n()

const TABS = [
  { key: 'colours', label: 'Colours' },
  { key: 'type', label: 'Type' },
  { key: 'icons', label: 'Icons' },
  { key: 'shape', label: 'Shape' },
  { key: 'all', label: 'All' },
] as const

const tab = ref<(typeof TABS)[number]['key']>('colours')

const editMode = ref<TokenMode>(isDark.value ? 'dark' : 'light')

const importText = ref('')

const isImportOpen = ref(false)

const importError = ref('')

const isImported = ref(false)

const rootRef = ref<HTMLElement>()

const fileInputRef = ref<HTMLInputElement>()

const bodyRef = ref<HTMLElement>()

const isModeScoped = computed(() => tab.value === 'colours' || tab.value === 'all')

function copyCss() {
  copy(css.value || '/* no overrides */')
  message.success(t('msg.success.cssCopied'))
}

function copyJson() {
  copy(JSON.stringify(overrides.value, null, 2))
  message.success(t('msg.success.jsonCopied'))
}

function useExample() {
  importText.value = JSON.stringify(exampleTokens(), null, 2)
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) importText.value = await file.text()
}

const { start: flashImported } = useTimeoutFn(() => (isImported.value = false), 2500, { immediate: false })

function applyImport() {
  const result = importJson(importText.value)
  if (result !== 'ok') {
    importError.value = t(result === 'invalidJson' ? 'msg.error.invalidJson' : 'msg.error.invalidTokensJson')
    return
  }
  importError.value = ''
  isImportOpen.value = false
  importText.value = ''
  isImported.value = true
  flashImported()
}

watch(importText, () => (importError.value = ''))

watch(isDark, (dark) => {
  editMode.value = dark ? 'dark' : 'light'
})

watch(tab, () => {
  if (bodyRef.value) bodyRef.value.scrollTop = 0
})

onMounted(() => {
  rootRef.value?.querySelector<HTMLElement>('button:not([disabled]), input, [tabindex="0"]')?.focus()
})
</script>

<template>
  <aside ref="rootRef" class="nc-playground-token-editor flex flex-col bg-nc-bg-default">
    <div class="flex-none px-4 h-11 flex items-center gap-2 border-b-1 border-nc-border-gray-medium">
      <span class="text-captionBold text-nc-content-gray-emphasis">Design tokens</span>
      <span class="text-captionSm text-nc-content-gray-muted">{{ overrideCount }} changed</span>
      <NcButton class="!ml-auto !px-2" size="xsmall" type="text" :disabled="!overrideCount" @click="reset">
        <div class="flex items-center gap-1">
          <GeneralIcon icon="ncRotateCcw" class="w-3.5 h-3.5" />
          Reset all
        </div>
      </NcButton>
    </div>

    <div class="flex-none px-4 pt-2 flex items-end gap-2 border-b-1 border-nc-border-gray-medium">
      <button
        v-for="tabItem in TABS"
        :key="tabItem.key"
        class="h-8 px-1.5 -mb-px border-b-2 text-captionSm"
        :class="
          tab === tabItem.key
            ? 'border-nc-border-brand text-nc-content-brand'
            : 'border-transparent text-nc-content-gray-subtle hover:text-nc-content-gray-emphasis'
        "
        :data-testid="`nc-playground-tokens-tab-${tabItem.key}`"
        @click="tab = tabItem.key"
      >
        {{ tabItem.label }}
      </button>
      <div v-if="isModeScoped" class="ml-auto mb-1.5 flex items-center p-0.5 rounded-md bg-nc-bg-gray-light">
        <NcTooltip v-for="m in ['light', 'dark'] as const" :key="m" :title="`Edit ${m}-mode values`" :arrow="false">
          <button
            class="w-6 h-5 rounded flex items-center justify-center"
            :class="editMode === m ? 'bg-nc-bg-default shadow-sm text-nc-content-gray-emphasis' : 'text-nc-content-gray-muted'"
            @click="editMode = m"
          >
            <GeneralIcon :icon="m === 'light' ? 'ncSun' : 'ncMoon'" class="w-3 h-3" />
          </button>
        </NcTooltip>
      </div>
    </div>

    <div ref="bodyRef" class="flex-1 min-h-0 overflow-y-auto nc-scrollbar-thin">
      <ColoursTab v-if="tab === 'colours'" :mode="editMode" />
      <TypographyTab v-else-if="tab === 'type'" />
      <IconsTab v-else-if="tab === 'icons'" />
      <ShapeTab v-else-if="tab === 'shape'" />
      <AllTokensTab v-else :mode="editMode" />
    </div>

    <div class="flex-none p-3 border-t-1 border-nc-border-gray-medium flex flex-col gap-2">
      <div v-if="isImportOpen" class="flex flex-col gap-2">
        <a-textarea
          v-model:value="importText"
          :rows="4"
          placeholder="Paste exported JSON"
          class="!text-captionXs font-mono !rounded-lg"
          :status="importError ? 'error' : undefined"
        />
        <div v-if="importError" class="text-captionXs text-nc-content-red-dark">{{ importError }}</div>
        <div class="flex gap-2 items-center">
          <NcButton size="xsmall" type="text" data-testid="nc-playground-tokens-import-example" class="!px-2" @click="useExample">
            Use example
          </NcButton>
          <NcButton
            size="xsmall"
            type="text"
            data-testid="nc-playground-tokens-import-file"
            class="!px-2"
            @click="fileInputRef?.click()"
          >
            Choose file
          </NcButton>
          <input ref="fileInputRef" type="file" accept=".json,application/json" class="hidden" @change="onFilePicked" />
          <div class="flex-1" />
          <NcButton size="xsmall" type="text" class="!px-2" @click="isImportOpen = false">Cancel</NcButton>
          <NcButton size="xsmall" :disabled="!importText" class="!px-2" @click="applyImport">Apply</NcButton>
        </div>
      </div>
      <div class="flex gap-2">
        <NcButton size="small" type="secondary" class="flex-1" @click="copyCss">Copy CSS</NcButton>
        <NcButton size="small" type="secondary" class="flex-1" @click="copyJson">Copy JSON</NcButton>
        <NcButton size="small" type="secondary" @click="isImportOpen = !isImportOpen">Import</NcButton>
      </div>
      <div v-if="isImported" class="flex items-center gap-1 text-captionXs text-nc-content-green-dark">
        <GeneralIcon icon="check" class="w-3.5 h-3.5" />
        {{ $t('msg.success.tokensImported') }}
      </div>
    </div>
  </aside>
</template>

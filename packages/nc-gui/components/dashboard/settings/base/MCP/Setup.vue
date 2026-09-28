<script setup lang="ts">
interface Props {
  token: MCPTokenExtendedType
  /** Name the server after the connection's workspace and base rather than the open base. */
  showWorkspaceBaseInfo?: boolean
  showRegenerateButton?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showWorkspaceBaseInfo: false,
  showRegenerateButton: false,
  loading: false,
})

const emits = defineEmits(['regenerate'])

const { appInfo } = useGlobal()

const { openedProject } = storeToRefs(useBases())

const activeTab = ref<'claude' | 'cursor' | 'windsurf' | 'antigravity' | 'codex'>('claude')

/** A connection whose authority is its scopes names no base, so it is named after itself. */
const isScopedConnection = computed(() => !props.token.base)

const serverName = computed(() => {
  let title = ''

  if (props.showWorkspaceBaseInfo) {
    title = isScopedConnection.value
      ? `NocoDB - ${props.token.title}`
      : isEeUI
      ? `NocoDB ${props.token.workspace?.title || 'Workspace'} - ${props.token.base?.title || 'Base'}`
      : `NocoDB - ${props.token.base?.title || 'Base'}`
  } else {
    title = `NocoDB Base - ${openedProject.value?.title}`
  }

  if (activeTab.value === 'antigravity') {
    title = title.replaceAll(' ', '_').replaceAll('-', '')
  }

  return title
})

// Codex reads TOML, and a table key has to be a bare key.
const codexServerName = computed(() => serverName.value.replace(/[^A-Za-z0-9_-]+/g, '_'))

const secret = computed(() => props.token.token ?? 'xxxxxxxxxxxxxxxxxxxxxxxxxxx')

const code = computed(
  () => `
{
  "mcpServers": {
    "${serverName.value}": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${appInfo.value.ncSiteUrl}/mcp/${props.token.id}",
        "--header",
        "x-api-key: ${secret.value}"
      ]
    }
  }
}
`,
)

// Codex talks to the MCP endpoint over HTTP directly, so it needs no `mcp-remote` bridge.
const codexCode = computed(
  () => `[mcp_servers.${codexServerName.value}]
url = "${appInfo.value.ncSiteUrl}/mcp/${props.token.id}"
http_headers = { "x-api-key" = "${secret.value}" }
`,
)

const clients = [
  { key: 'claude', label: 'Claude', icon: 'ncLogoClaude' },
  { key: 'codex', label: 'Codex', icon: 'ncLogoOpenAiColored' },
  { key: 'antigravity', label: 'AntiGravity', icon: 'ncLogoGeminiAiColored' },
  { key: 'cursor', label: 'Cursor', icon: 'ncCode' },
  { key: 'windsurf', label: 'Windsurf', icon: 'ncCode' },
] as const
</script>

<template>
  <NcTabs v-model:active-key="activeTab" class="nc-mcp-setup-tabs">
    <a-tab-pane v-for="client in clients" :key="client.key" class="!h-full">
      <template #tab>
        <div class="flex items-center gap-2">
          <GeneralIcon :icon="client.icon" class="h-4 w-4 flex-none" />
          <span
            :class="{
              'text-nc-content-brand font-medium': activeTab === client.key,
              'text-nc-content-gray-subtle': activeTab !== client.key,
            }"
            class="text-sm"
          >
            {{ client.label }}
          </span>
        </div>
      </template>

      <div class="relative flex flex-col leading-6 text-nc-content-gray-subtle2 gap-3 my-3">
        <template v-if="client.key === 'claude'">
          {{ $t('msg.info.mcpSetupIntroClaude') }}

          <ol class="list-decimal pl-5">
            <li>{{ $t('msg.info.mcpSetupClaudeStep1') }}</li>
            <li>{{ $t('msg.info.mcpSetupClaudeStep2') }}</li>
            <li>{{ $t('msg.info.mcpSetupClaudeStep3') }}</li>
          </ol>
        </template>

        <template v-else-if="client.key === 'codex'">
          {{ $t('msg.info.mcpSetupIntroCodex') }}

          <ol class="list-decimal pl-5">
            <li>Open <code>~/.codex/config.toml</code>, creating it if it doesn’t exist.</li>
            <li>{{ $t('msg.info.mcpSetupCodexStep2') }}</li>
            <li>Run <code>codex mcp list</code> to confirm the server is connected.</li>
          </ol>
        </template>

        <template v-else-if="client.key === 'antigravity'">
          {{ $t('msg.info.mcpSetupIntroAntigravity') }}

          <ol class="list-decimal pl-5">
            <li>{{ $t('msg.info.mcpSetupAntigravityStep1') }}</li>
            <li>{{ $t('msg.info.mcpSetupAntigravityStep2') }}</li>
            <li>{{ $t('msg.info.mcpSetupViewRawConfig') }}</li>
            <li>{{ $t('msg.info.mcpSetupPasteJsonConfig') }}</li>
          </ol>
        </template>

        <template v-else-if="client.key === 'cursor'">
          {{ $t('msg.info.mcpSetupIntroCursor') }}

          <ol class="list-decimal pl-5">
            <li>{{ $t('msg.info.mcpSetupCursorStep1') }}</li>
            <li>{{ $t('msg.info.mcpSetupCursorStep2') }}</li>
            <li>{{ $t('msg.info.mcpSetupCursorStep3') }}</li>
          </ol>
        </template>

        <template v-else>
          {{ $t('msg.info.mcpSetupIntroWindsurf') }}

          <ol class="list-decimal pl-5">
            <li>{{ $t('msg.info.mcpSetupWindsurfStep1') }}</li>
            <li>{{ $t('msg.info.mcpSetupWindsurfStep2') }}</li>
            <li>{{ $t('msg.info.mcpSetupViewRawConfig') }}</li>
            <li>{{ $t('msg.info.mcpSetupPasteJsonConfig') }}</li>
          </ol>
        </template>

        <NcButton
          v-if="showRegenerateButton"
          type="secondary"
          class="w-44"
          size="small"
          :loading="loading"
          @click="emits('regenerate')"
        >
          {{ $t('labels.regenerateToken') }}
        </NcButton>

        <DashboardSettingsBaseMCPCode v-if="client.key === 'codex'" :key="codexCode" :code="codexCode" lang="ini" />
        <DashboardSettingsBaseMCPCode v-else :key="code" :code="code" />
      </div>
    </a-tab-pane>
  </NcTabs>
</template>

<style lang="scss" scoped>
.nc-mcp-setup-tabs {
  :deep(.ant-tabs-nav) {
    @apply !pl-0;
  }

  :deep(.ant-tabs-tab) {
    @apply pt-1 pb-1.5;
  }
}
</style>

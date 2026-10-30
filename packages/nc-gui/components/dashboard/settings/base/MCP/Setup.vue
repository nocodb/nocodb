<script setup lang="ts">
import { MCP_DISCOVERY_PATH } from 'nocodb-sdk'

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

type McpClient = 'claude' | 'claudeCode' | 'cursor' | 'windsurf' | 'copilot' | 'antigravity' | 'codex'

const activeTab = ref<McpClient>('claudeCode')

/** A connection whose authority is its scopes names no base, so it is named after itself. */
const isScopedConnection = computed(() => !props.token.base)

const serverName = computed(() => {
  let title = ''

  if (props.showWorkspaceBaseInfo) {
    title = isScopedConnection.value
      ? `NocoDB - ${props.token.title}`
      : isEeUI
      ? `NocoDB ${props.token.workspace?.title || 'Workspace'} - ${props.token.base?.title || 'Project'}`
      : `NocoDB - ${props.token.base?.title || 'Project'}`
  } else {
    title = `NocoDB Project - ${openedProject.value?.title}`
  }

  if (activeTab.value === 'antigravity') {
    title = title.replaceAll(' ', '_').replaceAll('-', '')
  }

  return title
})

// Codex reads TOML (a table key has to be a bare key), and Claude Code accepts only these characters.
const bareServerName = computed(() => serverName.value.replace(/[^A-Za-z0-9_-]+/g, '_'))

const secret = computed(() => props.token.token ?? 'xxxxxxxxxxxxxxxxxxxxxxxxxxx')

const mcpUrl = computed(() => `${appInfo.value.ncSiteUrl}/mcp/${props.token.id}`)

// Windsurf, Copilot and AntiGravity cap the tool list at 100 and cannot defer schemas, so on EE
// they use the endpoint that keeps writes behind `listTools`/`callTool`. CE lists few enough tools.
const cappedClientUrl = computed(() =>
  isEeUI ? `${appInfo.value.ncSiteUrl}/${MCP_DISCOVERY_PATH}/${props.token.id}` : mcpUrl.value,
)

const toJson = (server: Record<string, unknown>) => JSON.stringify({ mcpServers: { [serverName.value]: server } }, null, 2)

// Claude Desktop and AntiGravity only launch stdio servers, so they still need the
// `mcp-remote` bridge; every other client connects over HTTP and skips npx's startup.
// `http-only` because the endpoint 405s the SSE fallback.
const bridgeCodeFor = (url: string) =>
  toJson({
    command: 'npx',
    args: ['-y', 'mcp-remote', url, '--transport', 'http-only', '--header', `x-api-key:${secret.value}`],
  })

const bridgeCode = computed(() => bridgeCodeFor(mcpUrl.value))

const antigravityCode = computed(() => bridgeCodeFor(cappedClientUrl.value))

const cursorCode = computed(() => toJson({ url: mcpUrl.value, headers: { 'x-api-key': secret.value } }))

const windsurfCode = computed(() => toJson({ serverUrl: cappedClientUrl.value, headers: { 'x-api-key': secret.value } }))

const copilotCode = computed(() =>
  JSON.stringify(
    {
      servers: {
        [bareServerName.value]: { type: 'http', url: cappedClientUrl.value, headers: { 'x-api-key': secret.value } },
      },
    },
    null,
    2,
  ),
)

const claudeCodeCode = computed(
  () => `claude mcp add --transport http --scope user ${bareServerName.value} \\
  ${mcpUrl.value} \\
  --header "x-api-key: ${secret.value}"
`,
)

const codexCode = computed(
  () => `[mcp_servers.${bareServerName.value}]
url = "${mcpUrl.value}"
http_headers = { "x-api-key" = "${secret.value}" }
`,
)

const snippet = computed<{ code: string; lang: string }>(() => {
  switch (activeTab.value) {
    case 'claudeCode':
      return { code: claudeCodeCode.value, lang: 'shell' }
    case 'codex':
      return { code: codexCode.value, lang: 'ini' }
    case 'cursor':
      return { code: cursorCode.value, lang: 'json' }
    case 'windsurf':
      return { code: windsurfCode.value, lang: 'json' }
    case 'copilot':
      return { code: copilotCode.value, lang: 'json' }
    case 'antigravity':
      return { code: antigravityCode.value, lang: 'json' }
    default:
      return { code: bridgeCode.value, lang: 'json' }
  }
})

const clients = [
  { key: 'claudeCode', label: 'Claude Code', icon: 'ncLogoClaude' },
  { key: 'claude', label: 'Claude Desktop', icon: 'ncLogoClaude' },
  { key: 'codex', label: 'Codex', icon: 'ncLogoOpenAiColored' },
  { key: 'antigravity', label: 'AntiGravity', icon: 'ncLogoGeminiAiColored' },
  { key: 'cursor', label: 'Cursor', icon: 'ncCode' },
  { key: 'windsurf', label: 'Windsurf', icon: 'ncCode' },
  { key: 'copilot', label: 'Copilot', icon: 'ncGithub' },
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

        <template v-else-if="client.key === 'claudeCode'">
          {{ $t('msg.info.mcpSetupIntroClaudeCode') }}

          <ol class="list-decimal pl-5">
            <li>{{ $t('msg.info.mcpSetupClaudeCodeStep1') }}</li>
            <li>Run <code>claude mcp list</code> to confirm the server is connected.</li>
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

        <template v-else-if="client.key === 'copilot'">
          {{ $t('msg.info.mcpSetupIntroCopilot') }}

          <ol class="list-decimal pl-5">
            <li>{{ $t('msg.info.mcpSetupCopilotStep1') }}</li>
            <li>{{ $t('msg.info.mcpSetupCopilotStep2') }}</li>
            <li>{{ $t('msg.info.mcpSetupCopilotStep3') }}</li>
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

        <DashboardSettingsBaseMCPCode :key="snippet.code" :code="snippet.code" :lang="snippet.lang" />
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

<script setup lang="ts">
interface Props {
  value: boolean
  token: MCPTokenExtendedType
}

const props = defineProps<Props>()

const emits = defineEmits(['close', 'update:value', 'update:token'])

const modalVisible = useVModel(props, 'value')

const { appInfo } = useGlobal()

const { openedProject } = storeToRefs(useBases())

const token = useVModel(props, 'token')

const supportedDocs = [
  {
    title: 'Getting with MCP Server',
    href: 'https://docs.nocodb.com/automation/webhook/create-webhook/',
  },
  {
    title: 'Setting up MCP Server with Claude',
    href: 'https://docs.nocodb.com/automation/webhook/webhook-overview',
  },
  {
    title: 'Setting up MCP Server with Cursor',
    href: 'https://docs.nocodb.com/automation/webhook/create-webhook#webhook-with-custom-payload-',
  },
  {
    title: 'Setting up MCP Server with Windsurf',
    href: 'https://docs.nocodb.com/automation/webhook/create-webhook#webhook-with-conditions',
  },
]

const { updateMcpToken } = useMcpSettings()

const regenerateToken = async () => {
  const newToken = await updateMcpToken(token.value)
  if (newToken) {
    token.value = newToken
  }
}

const closeModal = () => {
  emits('close')
  modalVisible.value = false
}

const activeTab = ref<'claude' | 'cursor' | 'windsurf'>('claude')

const code = computed(
  () => `
{
  "mcpServers": {
    "NocoDB Base - ${openedProject.value?.title}": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${appInfo.value.ncSiteUrl}/mcp/${token.value.id}",
        "--header",
        "xc-mcp-token: ${token.value?.token ?? 'xxxxxxxxxxxxxxxxxxxxxxxxxxx'}"
      ]
    }
  }
}
`,
)
</script>

<template>
  <NcModal v-model:visible="modalVisible" :show-separator="true" size="large" wrap-class-name="nc-modal-mcp-token-create-edit">
    <template #header>
      <div class="flex w-full items-center p-2 justify-between">
        <div class="flex items-center gap-3 pl-1 flex-1">
          <GeneralIcon class="text-gray-900 h-5 w-5" icon="mcp" />
          <span class="text-gray-900 truncate font-semibold text-xl">
            {{ token.title }}
          </span>
        </div>

        <div class="flex justify-end items-center gap-3 pr-0.5 flex-1">
          <NcButton type="text" size="small" data-testid="nc-close-webhook-modal" @click.stop="closeModal">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>
    <div class="flex bg-white rounded-b-2xl h-[calc(100%_-_66px)]">
      <div
        ref="containerElem"
        class="h-full flex-1 flex flex-col overflow-y-auto scroll-smooth nc-scrollbar-thin px-24 py-6 mx-auto"
      >
        <div class="flex flex-col max-w-[640px] w-full mx-auto gap-3">
          <div class="text-nc-content-gray font-bold leading-6">
            {{ $t('labels.mcpSetup') }}
          </div>

          <NcTabs v-model:activeKey="activeTab">
            <a-tab-pane key="claude" class="!h-full">
              <template #tab>
                <span
                  :class="{
                    'text-brand-500 font-medium': activeTab === 'claude',
                    'text-gray-700': activeTab !== 'claude',
                  }"
                  class="text-sm"
                >
                  Claude
                </span>
              </template>
              <div class="relative flex flex-col leading-6 text-nc-content-gray-subtle2 gap-3 my-3">
                Get started with the NocoDB MCP with Claude Desktop in 3 simple steps

                <ol class="list-decimal pl-5">
                  <li>Navigate to Claude Desktop settings from the navigation bar.</li>
                  <li>Go to the Develop Tab, and click on “Edit Config”.</li>
                  <li>Add the JSON configuration that’s provided after creating a token in claude_desktop_config.json</li>
                </ol>

                <NcButton type="secondary" class="w-39" size="small" :loading="token.loading" @click="regenerateToken(token)">
                  {{ $t('labels.regenerateToken') }}
                </NcButton>

                <DashboardSettingsBaseMCPCode :key="code" :code="code" />
              </div>
            </a-tab-pane>
            <a-tab-pane key="cursor" class="!h-full">
              <template #tab>
                <span
                  :class="{
                    'text-brand-500 font-medium': activeTab === 'cursor',
                    'text-gray-700': activeTab !== 'cursor',
                  }"
                  class="text-sm"
                >
                  Cursor
                </span>
              </template>
              <div class="relative flex flex-col leading-6 text-nc-content-gray-subtle2 gap-3 my-3">
                Get started with the NocoDB MCP with Cursor in 3 simple steps

                <ol class="list-decimal pl-5">
                  <li>Open Cursor Settings (press Shift+Cmd+J)</li>
                  <li>Select the "MCP" tab and click "Add MCP Server" .</li>
                  <li>Add the JSON configuration that’s provided after creating a token.</li>
                </ol>

                <NcButton type="secondary" class="w-44" size="small" :loading="token.loading" @click="regenerateToken(token)">
                  {{ $t('labels.regenerateToken') }}
                </NcButton>
                <DashboardSettingsBaseMCPCode :key="code" :code="code" />
              </div>
            </a-tab-pane>
            <a-tab-pane key="windsurf" class="!h-full">
              <template #tab>
                <span
                  :class="{
                    'text-brand-500 font-medium': activeTab === 'windsurf',
                    'text-gray-700': activeTab !== 'windsurf',
                  }"
                  class="text-sm"
                >
                  Windsurf
                </span>
              </template>
              <div class="relative flex flex-col leading-6 text-nc-content-gray-subtle2 gap-3 my-3">
                Get started with the NocoDB MCP with Windsurf in 4 simple steps

                <ol class="list-decimal pl-5">
                  <li>Access Windsurf settings and Select Cascade Tab in the left sidebar</li>
                  <li>Click on Add Server.</li>
                  <li>Now click on Add Custom Server in the modal.</li>
                  <li>Paste the JSON configuration that’s provided after creating a token in the opened file</li>
                </ol>

                <NcButton type="secondary" class="w-44" size="small" :loading="token.loading" @click="regenerateToken(token)">
                  {{ $t('labels.regenerateToken') }}
                </NcButton>

                <DashboardSettingsBaseMCPCode :code="code" />
              </div>
            </a-tab-pane>
          </NcTabs>
        </div>

        <NcAlert type="info" class="mt-3 max-w-[640px] w-full mx-auto">
          <template #message>
            {{ $t('labels.mcpTokenVisibilityInfo') }}
          </template>
          <template #description>
            {{ $t('labels.mcpTokenVisibilityInfoDescription') }} <br />
            {{ $t('labels.mcpTokenVisibilityInfoDescription2') }}
          </template>
        </NcAlert>
      </div>
      <div class="h-full bg-gray-50 border-l-1 w-80 p-5 rounded-br-2xl border-gray-200">
        <div class="w-full flex flex-col gap-3">
          <h2 class="text-sm text-gray-700 font-semibold !my-0">{{ $t('labels.supportDocs') }}</h2>
          <div>
            <div v-for="(doc, idx) of supportedDocs" :key="idx" class="flex items-center gap-1">
              <div class="h-7 w-7 flex items-center justify-center">
                <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-gray-500" />
              </div>
              <NuxtLink
                :href="doc.href"
                target="_blank"
                rel="noopener noreferrer"
                class="!text-gray-500 text-sm !no-underline !hover:underline"
              >
                {{ doc.title }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-mcp-token-create-edit {
  z-index: 1050;
  a {
    @apply !no-underline !text-gray-700 !hover:text-primary;
  }
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0;
  }

  .ant-tabs-nav {
    @apply !pl-0;
  }

  .ant-tabs-tab {
    @apply pt-1 pb-1.5;
  }
}
</style>

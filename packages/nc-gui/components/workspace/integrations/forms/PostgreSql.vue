<script lang="ts" setup>
const { activeIntegration, categories, activeCategory } = useIntegrationStore()

const { copy } = useCopy()

const copyIp = async () => {
  await copy('52.15.226.51')
  message.success('Copied to clipboard')
}

const panelsRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!panelsRef.value) return

  const panels = panelsRef.value.querySelectorAll('.panel')
  panels.forEach((panel) => {
    categories.value.push({
      label: panel.getAttribute('data-label') as string,
      icon: panel.getAttribute('data-icon'),
    })
  })

  // focus first input
  nextTick(() => {
    const firstInput = panels[0].querySelector('input')
    if (firstInput) firstInput.focus()
  })
})

const onInputFocus = () => {
  const target = document.activeElement
  const panel = target?.closest('.panel')
  if (panel) {
    activeCategory.value = {
      label: panel.getAttribute('data-label') as string,
      icon: panel.getAttribute('data-icon'),
    }
  }
}
</script>

<template>
  <div ref="panelsRef" class="panels">
    <WorkspaceIntegrationsPanel title="Integration Details" icon="info">
      <template #header-info>
        <div
          class="text-gray-500 !text-xs font-weight-normal flex items-center gap-2 cursor-pointer flex items-center"
          @click="copyIp"
        >
          <GeneralIcon icon="info" class="text-primary" />
          Whitelist our ip: 52.15.226.51 to allow database access
          <GeneralIcon icon="duplicate" class="text-gray-800 w-5 h-5 p-1 border-1 rounded-md border-gray-200" />
        </div>
      </template>
      <div>
        <div class="flex flex-col w-1/2 pr-3">
          <label class="!text-xs font-weight-normal pb-1">Title</label>
          <a-input v-model:value="activeIntegration.payload.title" class="input-text" :maxlength="255" @focus="onInputFocus" />
        </div>
      </div>
    </WorkspaceIntegrationsPanel>
    <WorkspaceIntegrationsPanel title="Connection Details" icon="link">
      <div class="input-group">
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">Host</label>
          <a-input v-model:value="activeIntegration.payload.host" class="input-text" @focus="onInputFocus" />
        </div>
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">Port</label>
          <a-input v-model:value="activeIntegration.payload.port" class="input-text" @focus="onInputFocus" />
        </div>
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">User</label>
          <a-input v-model:value="activeIntegration.payload.user" class="input-text" autocomplete="off" @focus="onInputFocus" />
        </div>
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">Password</label>
          <a-input
            v-model:value="activeIntegration.payload.password"
            class="input-text"
            type="password"
            autocomplete="off"
            @focus="onInputFocus"
          />
        </div>
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">Schema</label>
          <a-input v-model:value="activeIntegration.payload.schema" class="input-text" @focus="onInputFocus" />
        </div>
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">Database</label>
          <a-input v-model:value="activeIntegration.payload.database" class="input-text" @focus="onInputFocus" />
        </div>
      </div>
    </WorkspaceIntegrationsPanel>
    <WorkspaceIntegrationsPanel title="SSL & Advanced Parameters" icon="lock" :collapsible="true">
      <div class="input-group">
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">SSL Mode</label>
          <a-select v-model:value="activeIntegration.payload.sslMode" class="input-text" @focus="onInputFocus">
            <a-select-option value="disable">Disable</a-select-option>
            <a-select-option value="require">Require</a-select-option>
            <a-select-option value="verify-ca">Verify CA</a-select-option>
            <a-select-option value="verify-full">Verify Full</a-select-option>
          </a-select>
        </div>
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">SSL Root Certificate</label>
          <a-input v-model:value="activeIntegration.payload.sslRootCert" class="input-text" @focus="onInputFocus" />
        </div>
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">SSL Certificate</label>
          <a-input v-model:value="activeIntegration.payload.sslCert" class="input-text" @focus="onInputFocus" />
        </div>
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">SSL Key</label>
          <a-input v-model:value="activeIntegration.payload.sslKey" class="input-text" @focus="onInputFocus" />
        </div>
      </div>
      <div class="w-full border-t-1 mt-2 mb-4"></div>
      <div class="input-group">
        <div class="input-item">
          <label class="!text-xs font-weight-normal pb-1">Extra Connection Parameters</label>
          <a-input v-model:value="activeIntegration.payload.sslCert" class="input-text" @focus="onInputFocus" />
        </div>
      </div>
    </WorkspaceIntegrationsPanel>
    <WorkspaceIntegrationsPanel title="Connection JSON" icon="code">DUMMY</WorkspaceIntegrationsPanel>
  </div>
</template>

<style lang="scss" scoped>
.panels {
  @apply w-3/4 flex flex-col;

  .panel {
    @apply border-1 border-gray-200 px-4 py-4 rounded-lg mb-4;

    .panel-label {
      @apply text-md font-weight-bold;
    }

    .input-text {
      @apply w-full rounded-md;
    }

    .input-group {
      @apply flex flex-wrap w-full;

      .input-item {
        @apply flex flex-col w-1/2 pr-3 mb-3;
      }
    }
  }
}
</style>

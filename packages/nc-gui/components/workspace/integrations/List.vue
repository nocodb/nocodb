<script lang="ts" setup>
const { integrationType, addIntegration } = useIntegrationsPage()

const integrations = ref([])
</script>

<template>
  <div class="flex flex-col nc-workspace-settings-integrations">
    <div class="flex flex-col border-b-1 border-gray-200">
      <div class="flex flex-col gap-1 pt-6 px-6">
        <div class="text-xl">Add an Integration</div>
        <div>Connect tools into your workspace to enhance your workflows.</div>
      </div>
      <div class="flex gap-2 p-6">
        <div class="source-card" @click="addIntegration(integrationType.MySQL)">
          <WorkspaceIntegrationsIcon :integration-type="integrationType.MySQL" size="md" />
          <div class="name">MySQL</div>
        </div>
        <div class="source-card" @click="addIntegration(integrationType.PostgreSQL)">
          <WorkspaceIntegrationsIcon :integration-type="integrationType.PostgreSQL" size="md" />
          <div class="name">PostgreSQL</div>
        </div>
        <a
          class="source-card source-card-link"
          href="https://github.com/nocodb/nocodb/issues"
          target="_blank"
          rel="noreferrer noopener"
        >
          <WorkspaceIntegrationsIcon integration-type="request" size="md" />
          <div class="name">Request New Integration</div>
        </a>
      </div>
    </div>
    <div class="flex flex-col" style="max-width: 1024px">
      <div class="flex gap-1 pt-6 px-6 justify-between items-center">
        <div class="text-xl">Integrations</div>
        <a-input class="!max-w-90 !rounded-md mr-4" placeholder="Search Integrations">
          <template #prefix>
            <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
          </template>
        </a-input>
      </div>
      <div class="flex p-6">
        <div class="integrations-table">
          <div class="integrations-table-header">
            <div>Integration name</div>
            <div>Integration type</div>
            <div>Date added</div>
            <div>Actions</div>
          </div>
          <div class="integrations-table-body">
            <template v-if="integrations.length"></template>
            <template v-else>
              <img src="~assets/img/placeholder/link-records.png" class="!w-[18.5rem] flex-none" />
              <div class="text-2xl text-gray-700 font-bold">No Integrations added</div>
              <div class="text-gray-700 text-center">
                Looks like no integrations have been linked yet.
                <br />
                Add a New Integration using the ‘New Integration’ button.
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.source-card-link {
  @apply !text-black !no-underline;
}

.source-card {
  @apply flex items-center border-1 rounded-lg p-3 cursor-pointer hover:bg-gray-50;
  width: 288px;
  .name {
    @apply ml-4 text-md font-semibold;
  }
}

.integrations-table {
  @apply w-full border-1 border-gray-200 rounded-lg cursor-default;
  .integrations-table-header {
    @apply flex gap-4 py-2 px-6 bg-gray-100 justify-between;
  }
  .integrations-table-body {
    @apply flex flex-col items-center justify-center p-6;
    img {
      @apply !mb-4 mx-auto;
    }
  }
}
</style>

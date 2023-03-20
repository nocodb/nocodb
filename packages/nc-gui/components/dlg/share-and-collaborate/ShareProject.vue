<script setup lang="ts">
import Collaborate from './Collaborate.vue'
import PublicShare from './PublicShare.vue'

const { formStatus } = useShare()

onMounted(async () => {
  formStatus.value = 'project-collaborate'
})
</script>

<template>
  <div class="flex flex-col mx-4 mb-4 mt-2">
    <a-tabs v-model:activeKey="formStatus">
      <a-tab-pane key="project-collaborate">
        <template #tab>
          <div class="flex flex-row items-center text-xs px-2">
            <MdiAccountPlusOutline class="mr-1" />
            <div>Add Collaborators</div>
          </div>
        </template>
        <Collaborate />
      </a-tab-pane>
      <a-tab-pane key="project-public">
        <template #tab>
          <div class="flex flex-row items-center text-xs px-2">
            <MdiEarth class="mr-1" />
            <div>Share Public Viewing</div>
          </div>
        </template>
        <PublicShare />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  isSaving?: boolean
  isRunning?: boolean
  hasManualTrigger?: boolean
  isActive?: boolean
}>()

const emit = defineEmits<{
  save: []
  run: []
  active: [value: boolean]
}>()

const handleSave = () => {
  emit('save')
}

const handleRun = () => {
  emit('run')
}
</script>

<template>
  <div class="workflow-topbar">
    <div class="workflow-topbar-left">
      <h2 class="workflow-title">{{ title }}</h2>
    </div>
    <div class="workflow-topbar-right">
      <div class="workflow-topbar-center">
        <div class="workflow-status">
          <span class="workflow-status-label">Active</span>
          <NcSwitch :checked="isActive" @change="(checked: boolean) => emit('active', checked)" />
        </div>
      </div>
      <NcButton v-if="hasManualTrigger" size="small" :loading="isRunning" :disabled="isRunning || isSaving" @click="handleRun">
        <template #icon>
          <GeneralIcon v-if="!isRunning" icon="play" />
        </template>
        {{ isRunning ? 'Running...' : 'Run' }}
      </NcButton>
      <NcButton type="primary" size="small" :loading="isSaving" :disabled="isSaving || isRunning" @click="handleSave">
        <template #icon>
          <GeneralIcon v-if="!isSaving" icon="save" />
        </template>
        {{ isSaving ? 'Saving...' : 'Save' }}
      </NcButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.workflow-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  min-height: 48px;
}

.workflow-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workflow-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.workflow-topbar-center {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: center;
}

.workflow-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workflow-status-label {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.workflow-topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>

<script setup lang="ts">
defineProps<{
  title: string
  isSaving?: boolean
}>()

const emit = defineEmits<{
  save: []
}>()

const handleSave = () => {
  emit('save')
}
</script>

<template>
  <div class="workflow-topbar">
    <div class="workflow-topbar-left">
      <h2 class="workflow-title">{{ title }}</h2>
    </div>
    <div class="workflow-topbar-right">
      <NcButton type="primary" size="small" :loading="isSaving" :disabled="isSaving" @click="handleSave">
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

.workflow-topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>

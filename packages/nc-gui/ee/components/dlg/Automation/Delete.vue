<script lang="ts" setup>
import type { ScriptType } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  script: ScriptType
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const script = toRef(props, 'script')

const automationStore = useAutomationStore()

const { deleteAutomation } = automationStore

const { $e } = useNuxtApp()

const isLoading = ref(false)

const onDelete = async () => {
  if (!script.value) return

  isLoading.value = true
  try {
    await deleteAutomation(script.value.base_id, script.value.id as string)

    $e('a:script:delete')

    visible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="visible" :entity-name="$t('objects.script')" :on-delete="onDelete">
    <template #entity-preview>
      <div
        v-if="script"
        class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle"
      >
        <GeneralIcon class="nc-view-icon" icon="ncScript" />
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ script.title }}
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>

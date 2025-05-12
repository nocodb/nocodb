<script lang="ts" setup>
interface Props {
  modelValue: boolean
  mcpToken: MCPTokenExtendedType
}

interface Emits {
  (event: 'update:modelValue', data: boolean): void
  (event: 'deleted'): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const { mcpToken } = props

const vModel = useVModel(props, 'modelValue', emits)

const { deleteMcpToken } = useMcpSettings()

async function onDelete() {
  if (!mcpToken.id) return  

  try {
    await deleteMcpToken(mcpToken)

    vModel.value = false
    emits('deleted')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="vModel" :entity-name="$t('labels.mcpToken')" :on-delete="onDelete">
    <template #entity-preview>
      <div class="flex flex-row items-center py-2 px-3 bg-gray-50 rounded-lg text-gray-700">
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-3"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          <span>
            {{ mcpToken.title }}
          </span>
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>

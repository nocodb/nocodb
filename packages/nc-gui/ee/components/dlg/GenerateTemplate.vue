<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const vModel = useVModel(props, 'modelValue')

const workspaceStore = useWorkspace()
const basesStore = useBases()

const { navigateToProject } = useGlobal()

const { $api } = useNuxtApp()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const generatePrompt = ref('')

const generateInstructions = ref('')

const generateOptions = ref({
  generateViews: true,
  generateData: false,
})

const generatePromptInput = ref<HTMLInputElement | null>(null)

const toggleGenerateModal = (value: boolean) => {
  vModel.value = value
  if (value) {
    nextTick(() => {
      generatePromptInput.value?.focus()
    })
  }
}

const isGenerating = ref(false)

const progressMessage = ref('')

const progressDots = ref('')

const generate = async () => {
  if (!generatePrompt.value || !activeWorkspaceId.value || isGenerating.value) {
    return
  }

  isGenerating.value = true
  progressMessage.value = 'Generating'
  const dotsInterval = window.setInterval(() => {
    if (progressDots.value.length === 3) {
      progressDots.value = ''
    } else {
      progressDots.value += '.'
    }
  }, 500)

  try {
    const response = await $api.ai.templateCreate(activeWorkspaceId.value, {
      input: generatePrompt.value,
      ...(generateInstructions.value.length > 0 && { instructions: generateInstructions.value }),
      options: generateOptions.value,
    })
    await basesStore.loadProjects()
    console.log(response)
    navigateToProject({
      baseId: response.id,
      workspaceId: activeWorkspaceId.value,
      type: response.type,
    })
    progressMessage.value = 'Generated!'
  } catch (error) {
    console.error(error)
    progressMessage.value = 'Failed to generate'
  } finally {
    progressDots.value = ''
    window.clearInterval(dotsInterval)
    window.setTimeout(() => {
      isGenerating.value = false
      progressMessage.value = ''
      toggleGenerateModal(false)
    }, 1000)
  }
}
</script>

<template>
  <NcModal v-model:visible="vModel" :show-separator="false" size="small" @keydown.esc="toggleGenerateModal(false)">
    <template #header>
      <div class="flex items-center gap-x-2">
        <GeneralIcon icon="magic" class="!h-5 text-orange-500" />
        <div class="!font-semibold">Generate with AI</div>
      </div>
    </template>
    <div>
      <div class="flex flex-col px-2">
        <span class="text-gray-600">What do you want to generate?</span>
        <span class="text-xs text-gray-400">(Sales CRM, Dairy Business, Project Management etc.)</span>
      </div>
      <div class="flex flex-col gap-2 mt-4">
        <a-input
          ref="generatePromptInput"
          v-model:value="generatePrompt"
          placeholder="Enter your prompt"
          class="!w-full !rounded-lg"
          size="large"
          :auto-focus="true"
          :disabled="isGenerating"
        />
        <a-textarea
          v-model:value="generateInstructions"
          placeholder="Instructions for AI (optional)"
          class="!w-full !rounded-lg mt-2"
          size="large"
          :rows="3"
          :disabled="isGenerating"
        />
      </div>
      <div class="flex items-center m-2">
        <a-checkbox v-model:checked="generateOptions.generateViews" :disabled="isGenerating"> Generate Views </a-checkbox>
        <!-- <a-checkbox v-model:checked="generateOptions.generateData" :disabled="isGenerating"> Generate Data </a-checkbox> -->
      </div>
      <div class="mt-4">
        <NcButton
          type="primary"
          size="small"
          class="!w-full"
          :disabled="isGenerating"
          :is-loading="isGenerating"
          @click="generate"
        >
          <template v-if="isGenerating">{{ progressMessage }}{{ progressDots }}</template>
          <template v-else>Generate</template>
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped></style>

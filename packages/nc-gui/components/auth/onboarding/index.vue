<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'

const { showOnboardingFlow, onInitOnboardingFlow, onCompleteOnboardingFlow, visibleQuestions, stepper } = useOnboardingFlow()

const autoScrollQuestionRefs = ref<HTMLDivElement>()

const onSelectRef: VNodeRef = (el) => {
  if (el) {
    autoScrollQuestionRefs.value = (el as any)?.$el as HTMLDivElement
  }
}

let timer: any
watch(
  [() => visibleQuestions.value.length, () => stepper.index.value],
  ([newValue, newStepperIndex], [oldValue, oldStepperIndex], cleanup) => {
    if (newValue !== 2 || oldValue !== 1 || newStepperIndex !== oldStepperIndex) return

    timer = setTimeout(() => {
      autoScrollQuestionRefs.value?.scrollIntoView({ behavior: 'smooth' })
    }, 300)

    cleanup(() => {
      clearTimeout(timer)
    })
  },
)

onMounted(() => {
  onInitOnboardingFlow()
})

useEventListener('beforeunload', (event) => {
  if (!showOnboardingFlow.value) return

  // Recommended
  event.preventDefault()

  // Included for legacy support, e.g. Chrome/Edge < 119
  event.returnValue = ''
})
</script>

<template>
  <AuthOnboardingLayout>
    <template #content>
      <template v-for="(question, index) of visibleQuestions" :key="question.id">
        <AuthOnboardingQuestion :question="question" :question-index="index" :ref="onSelectRef" />
      </template>
    </template>
  </AuthOnboardingLayout>
</template>

<style lang="scss" scoped></style>

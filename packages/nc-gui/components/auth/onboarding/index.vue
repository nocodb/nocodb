<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'

const { showOnboardingFlow, onInitOnboardingFlow, visibleQuestion, stepper } = useOnboardingFlow()

const autoScrollQuestionRefs = ref<HTMLDivElement>()

const onSelectRef: VNodeRef = (el) => {
  if (el) {
    autoScrollQuestionRefs.value = (el as any)?.$el as HTMLDivElement
  }
}

let timer: any
watch(
  () => visibleQuestion.value.id,
  (_newValue, _oldValue, cleanup) => {
    timer = setTimeout(() => {
      autoScrollQuestionRefs.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 300)

    cleanup(() => {
      clearTimeout(timer)
    })
  },
)

onMounted(() => {
  onInitOnboardingFlow()
})

// useEventListener('beforeunload', (event) => {
//   if (!showOnboardingFlow.value) return

//   // Recommended
//   event.preventDefault()

//   // Included for legacy support, e.g. Chrome/Edge < 119
//   event.returnValue = ''
// })
</script>

<template>
  <AuthOnboardingLayout>
    <template #content>
      <AuthOnboardingQuestion :question="visibleQuestion" :question-index="stepper.index.value" :ref="onSelectRef" />
    </template>
  </AuthOnboardingLayout>
</template>

<style lang="scss" scoped></style>

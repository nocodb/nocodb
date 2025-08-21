<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'

const { onInitOnboardingFlow, visibleQuestion, stepper } = useOnboardingFlow()

const autoScrollQuestionRefs = ref<HTMLDivElement>()

const onSelectRef: VNodeRef = (el) => {
  if (el) {
    autoScrollQuestionRefs.value = (el as any).$el as HTMLDivElement
  }
}

const transitionName = ref<'slide-left' | 'slide-right' | null>(null)

watch(stepper.index, (newIndex, oldIndex) => {
  if (oldIndex === undefined) return

  transitionName.value = newIndex > (oldIndex ?? 0) ? 'slide-left' : 'slide-right'
})

onMounted(() => {
  onInitOnboardingFlow()
})
</script>

<template>
  <AuthOnboardingLayout>
    <template #content>
      <div class="relative w-full">
        <Transition :name="transitionName ?? ''" mode="out-in">
          <AuthOnboardingQuestion
            :key="stepper.index.value"
            :ref="onSelectRef"
            :question="visibleQuestion"
            :question-index="stepper.index.value"
          />
        </Transition>
      </div>
    </template>
  </AuthOnboardingLayout>
</template>

<style lang="scss" scoped>
.slide-left-enter-active,
.slide-right-enter-active,
.slide-left-leave-active,
.slide-right-leave-active {
  transition: all 0.25s ease;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.slide-left-enter-to {
  opacity: 1;
  transform: translateX(0);
}
.slide-left-leave-from {
  opacity: 1;
  transform: translateX(0);
}
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-100%);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-100%);
}
.slide-right-enter-to {
  opacity: 1;
  transform: translateX(0);
}
.slide-right-leave-from {
  opacity: 1;
  transform: translateX(0);
}
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>

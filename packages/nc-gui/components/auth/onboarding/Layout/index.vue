<script lang="ts" setup>
const { stepper, onCompleteOnboardingFlow, isFilledQuestionAnswer, isFilledVisibleOptions, questionsMap, formState } =
  useOnboardingFlow()

const { index: stepIndex, steps, isLast, isFirst, goToNext, goToPrevious } = stepper

const imagePreviewSectionRef = ref()

const isFilledSecondScreenOptions = computed(() => {
  return questionsMap.value[2] ? isFilledQuestionAnswer(questionsMap.value[2]) : false
})

const progress = computed(() => {
  return {
    percentage: ((stepIndex.value + (isFilledVisibleOptions.value ? 1 : 0)) / steps.value.length) * 100,
    text: `${stepIndex.value + 1} / ${steps.value.length}`,
  }
})

const showNextButton = computed(() => {
  return stepIndex.value !== 0 || isFilledSecondScreenOptions.value || Object.keys(formState.value).length > 2
})

const isDisabledSkipButton = ref(false)

useEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    if (!event.shiftKey && isFilledVisibleOptions.value) {
      if (isLast.value) {
        onCompleteOnboardingFlow(false)
      } else {
        goToNext()
      }
    }

    if (event.shiftKey && !isFirst.value) {
      goToPrevious()
    }
  }
})

let timer: any

/**
 * To avoid accidental skip of onboarding flow while pressing back button continuously,
 * disable skip button for 2 second
 */
watch(
  () => stepIndex.value,
  (newIndex, oldIndex, cleanup) => {
    if (newIndex !== 0 || oldIndex === undefined) {
      isDisabledSkipButton.value = false
      return
    }

    isDisabledSkipButton.value = true

    timer = setTimeout(() => {
      isDisabledSkipButton.value = false
    }, 2000)

    cleanup(() => {
      clearTimeout(timer)
    })
  },
)
</script>

<template>
  <div class="w-full flex items-stretch h-full">
    <div class="hidden lg:block w-1/2">
      <slot name="imagePreviewSection">
        <AuthOnboardingLayoutImagePreviewSection ref="imagePreviewSectionRef" />
      </slot>
    </div>
    <div
      class="w-full lg:(w-1/2) transition-width duration-250 h-full flex flex-col gap-[120px] nc-scrollbar-thin relative border-l-1 border-nc-border-gray-medium"
    >
      <header
        class="px-4 pt-6 lg:(pt-12 px-8) flex items-center justify-between w-full max-w-[672px] lg:max-w-[704px] mx-auto sticky top-0 lg:-top-4 bg-white z-10"
      >
        <GeneralIcon icon="nocodb1" class="w-12 h-12 flex-none" />

        <div class="w-[200px] text-bodyBold pr-1">
          <a-progress
            :percent="progress.percentage"
            size="small"
            status="normal"
            stroke-color="#3366FF"
            trail-color="#F0F3FF"
            :show-info="false"
          />
        </div>
      </header>
      <div class="flex-1 w-full max-w-[672px] lg:max-w-[704px] mx-auto flex flex-col gap-[120px] px-4 lg:(px-8)">
        <slot name="content"></slot>
      </div>

      <slot name="footer">
        <footer
          class="flex flex-col justify-end w-full max-w-[672px] lg:max-w-[704px] mx-auto px-4 pb-6 lg:(pb-12 px-8) sticky bottom-0 bg-white z-10"
        >
          <div
            class="flex items-center"
            :class="{
              'justify-center': !showNextButton,
              'justify-between': showNextButton,
            }"
          >
            <NcButton
              v-if="stepIndex === 0"
              type="text"
              size="small"
              :disabled="isDisabledSkipButton"
              @click="onCompleteOnboardingFlow(true)"
            >
              <div class="opacity-50">
                {{ $t('general.skip') }}
              </div>
            </NcButton>
            <NcButton v-else type="text" size="small" :disabled="isFirst" @click="goToPrevious()">
              <template #icon>
                <GeneralIcon icon="ncArrowLeft" class="w-4 h-4" />
              </template>
              {{ $t('general.back') }}
            </NcButton>
            <template v-if="showNextButton">
              <NcButton
                type="primary"
                size="small"
                :disabled="!isFilledVisibleOptions"
                @click="isLast ? onCompleteOnboardingFlow(false) : goToNext()"
              >
                <div class="flex items-center gap-2">
                  {{ isLast ? $t('general.finish') : $t('labels.next') }}
                  <div class="h-full rounded px-1 py-0.5">
                    <GeneralIcon icon="ncEnter" class="w-4 h-4" />
                  </div>
                </div>
              </NcButton>
            </template>
          </div>
        </footer>
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

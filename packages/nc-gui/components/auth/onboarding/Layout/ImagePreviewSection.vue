<script lang="ts" setup>
import gridImage from '~/assets/img/views/grid-with-sidebar.png'
import galleryImage from '~/assets/img/views/gallery-with-sidebar.png'
import kanbanImage from '~/assets/img/views/kanban-with-sidebar.png'
import calendarImage from '~/assets/img/views/calendar-with-sidebar.png'

import moscotWelcomeOrange from '~/assets/img/moscot/welcome-orange.png'
import moscotWelcomeGreen from '~/assets/img/moscot/welcome-green.png'
import moscotWelcomePurple from '~/assets/img/moscot/welcome-purple.png'

import moscotCollaboration from '~/assets/img/moscot/collabe.png'

import moscotGridTableOrange from '~/assets/img/moscot/grid-table-orange.png'
import moscotGridTableBrand from '~/assets/img/moscot/grid-table-brand.png'

const { questions, lastVisibleQuestionIndex, formState } = useOnboardingFlow()

const currentQuestion = computed(() => questions.value[lastVisibleQuestionIndex.value]!)

/**
 * Next question is used to preload images to avoid flickering
 */
const nextQuestion = computed(() => questions.value[lastVisibleQuestionIndex.value + 1])

const getRightSectionInfo = (question: OnboardingQuestionType): OnboardingRightSectionType => {
  if (!question || !question.rightSection) {
    return {
      themeColor: 'orange',
      moscot: 'moscotWelcomeOrange',
      imageName: 'grid',
    }
  }

  return ncIsFunction(question.rightSection) ? question.rightSection(formState.value) : question.rightSection
}

const rightSectionInfo = computed<OnboardingRightSectionType>(() => {
  return getRightSectionInfo(currentQuestion.value)
})

const nextQuestionRightSectionInfo = computed<OnboardingRightSectionType | undefined>(() => {
  return nextQuestion.value ? getRightSectionInfo(nextQuestion.value) : undefined
})

const bgColorClass = computed(() => {
  return onboardingFlowColoursMapping[rightSectionInfo.value.themeColor || 'orange']?.lightBg
})

const getMoscotImage = (moscot: OnboardingRightSectionType['moscot']) => {
  switch (moscot) {
    case 'moscotWelcomeGreen':
      return moscotWelcomeGreen
    case 'moscotWelcomePurple':
      return moscotWelcomePurple
    case 'moscotCollaboration':
      return moscotCollaboration
    case 'moscotGridTableBrand':
      return moscotGridTableBrand
    case 'moscotGridTableOrange':
      return moscotGridTableOrange
    default:
      return moscotWelcomeOrange
  }
}

const moscotImage = computed(() => {
  return getMoscotImage(rightSectionInfo.value.moscot)
})

const nextQuestionMoscotImage = computed(() => {
  return nextQuestionRightSectionInfo.value ? getMoscotImage(nextQuestionRightSectionInfo.value.moscot) : undefined
})

const moscotImageSize = computed(() => {
  switch (rightSectionInfo.value.moscot) {
    case 'moscotCollaboration':
      return {
        height: '311px',
        width: '536px',
      }
    case 'moscotGridTableBrand':
    case 'moscotGridTableOrange':
      return {
        height: '335px',
        width: '440px',
      }
    default:
      return {
        height: '233px',
        width: '263px',
      }
  }
})

const getViewImage = (imageName: OnboardingRightSectionType['imageName']) => {
  switch (imageName) {
    case 'grid':
      return gridImage
    case 'gallery':
      return galleryImage
    case 'kanban':
      return kanbanImage
    case 'calendar':
      return calendarImage
    default:
      return gridImage
  }
}

const viewImage = computed(() => {
  return getViewImage(rightSectionInfo.value.imageName)
})

const nextQuestionViewImage = computed(() => {
  return nextQuestionRightSectionInfo.value ? getViewImage(nextQuestionRightSectionInfo.value.imageName) : undefined
})

defineExpose({
  bgColorClass,
})
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full relative overflow-hidden" :class="[bgColorClass]">
    <div class="nc-view-image-box" :style="{ backgroundImage: `url(${viewImage})` }"></div>

    <div class="nc-view-image-box nc-moscot-image-box">
      <div class="h-full w-full relative">
        <img
          alt="moscot image"
          :src="moscotImage"
          class="nc-moscot-image transition-width duration-350 ease-linear"
          :class="{
            '!-left-[234px]': rightSectionInfo.moscot === 'moscotCollaboration',
          }"
          :style="moscotImageSize"
        />
      </div>
    </div>

    <div class="hidden">
      <!-- Pre-render images to avoid flickering -->
      <img v-if="nextQuestionMoscotImage" alt="prerender moscot image" :src="nextQuestionMoscotImage" />
      <img v-if="nextQuestionViewImage" alt="prerender view image" :src="nextQuestionViewImage" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-view-image-box {
  @apply border border-nc-border-gray-medium bg-cover bg-no-repeat overflow-hidden rounded-lg absolute left-[240px] top-[50%] transform -translate-y-1/2 h-[min(760px,80%)] w-[1351px];
  box-shadow: 0 0 12px 4px rgba(0, 0, 0, 0.08);

  &.nc-moscot-image-box {
    @apply overflow-visible;
    box-shadow: none;

    .nc-moscot-image {
      @apply absolute -left-[184px] -bottom-[50px] object-contain;
    }
  }
}
</style>

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

const rightSectionInfo = computed<OnboardingRightSectionType>(() => {
  if (!currentQuestion.value || !currentQuestion.value.rightSection) {
    return {
      themeColor: 'orange',
      moscot: 'moscotWelcomeOrange',
      imageName: 'grid',
    }
  }

  return ncIsFunction(currentQuestion.value.rightSection)
    ? currentQuestion.value.rightSection(formState.value)
    : currentQuestion.value.rightSection
})

const bgColorClass = computed(() => {
  return onboardingFlowColoursMapping[rightSectionInfo.value.themeColor || 'orange'].lightBg
})

const moscotImage = computed(() => {
  switch (rightSectionInfo.value.moscot) {
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
        height: '358px',
        width: '480px',
      }
    default:
      return {
        height: '233px',
        width: '263px',
      }
  }
})

const viewImage = computed(() => {
  switch (rightSectionInfo.value.imageName) {
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
})
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full relative" :class="[bgColorClass]">
    <div class="nc-view-image-box" :style="{ backgroundImage: `url(${viewImage})` }"></div>
    <div class="nc-view-image-box nc-moscot-image-box">
      <div class="h-full w-full relative">
        <img alt="moscot image" :src="moscotImage" class="nc-moscot-image" :style="moscotImageSize" />
      </div>
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

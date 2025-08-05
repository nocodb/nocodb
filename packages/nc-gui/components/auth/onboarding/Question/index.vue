<script lang="ts" setup>
interface Props {
  question: OnboardingQuestionType
  questionIndex: number
}

const props = withDefaults(defineProps<Props>(), {})

const { question, questionIndex } = toRefs(props)

const { questionsMap, formState, onSelectOption, stepper, lastVisibleQuestionIndex } = useOnboardingFlow()

const options = computed(() => {
  if (ncIsFunction(question.value.options)) {
    return question.value.options(formState.value) || []
  }

  return question.value.options || []
})

const anyOptionHasIcon = computed(() => {
  return options.value.some((option) => option.iconType || (!option.iconType && option.icon))
})

const anyOptionHasBgColor = computed(() => {
  return options.value.some((option) => option.iconColor)
})

const isOptionSelected = (option: OnboardingOptionType) => {
  if (question.value.inputType === 'singleSelect') {
    return formState.value[question.value.id] === option.value
  }

  if (question.value.inputType === 'multiSelect') {
    return ((formState.value[question.value.id] || []) as string[]).includes(option.value)
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <h3 class="my-0 text-heading3 text-nc-content-gray-emphasis">{{ question.question }}</h3>
    <div class="flex flex-wrap gap-4 children:(w-[calc(50%-8px)] flex-none)">
      <template v-for="(option, index) of options" :key="option.value">
        <AuthOnboardingQuestionOption
          :option="option"
          :index="index"
          :total-options="options.length"
          :icon-size="question.iconSize"
          @click="onSelectOption(option, question, questionIndex)"
          :class="{
            '!justify-center': !anyOptionHasIcon,
            'nc-selected': isOptionSelected(option),
            'nc-has-icon-bg-color': anyOptionHasBgColor,
          }"
        />
      </template>
    </div>
  </div>
</template>

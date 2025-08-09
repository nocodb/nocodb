<script lang="ts" setup>
interface Props {
  question: OnboardingQuestionType
  questionIndex: number
}

const props = withDefaults(defineProps<Props>(), {})

const { question, questionIndex } = toRefs(props)

const { formState, onSelectOption } = useOnboardingFlow()

const options = computed(() => {
  if (ncIsFunction(question.value.options)) {
    return question.value.options(formState.value) || []
  }

  return question.value.options || []
})

const anyOptionHasIcon = computed(() => {
  return options.value.some((option) => option.icons?.length)
})

const anyOptionHasBgColor = computed(() => {
  return options.value.some((option) => option.icons?.some((icon) => icon.iconColor))
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
    <div class="flex flex-col gap-3">
      <h3 class="my-0 text-heading3 text-nc-content-gray-emphasis">{{ question.question }}</h3>
      <p v-if="question.description" class="my-0 text-body text-nc-content-gray-subtle2">
        {{ question.description }}
      </p>
    </div>
    <div
      class="flex flex-wrap gap-4"
      :class="{
        'children:(w-[calc(50%-8px)] flex-none)': !question.config?.optionsInEachRow || question.config?.optionsInEachRow === 2,
        'flex-col items-center children:(w-[60%] flex-none)': question.config?.optionsInEachRow === 1,
      }"
    >
      <template v-for="(option, index) of options" :key="option.value">
        <AuthOnboardingQuestionOption
          :option="option"
          :index="index"
          :total-options="options.length"
          :icon-size="question.iconSize"
          :class="{
            '!justify-center': !anyOptionHasIcon,
            'nc-selected': isOptionSelected(option),
            'nc-has-icon-bg-color': anyOptionHasBgColor,
          }"
          @click="onSelectOption(option, question, questionIndex)"
        />
      </template>
    </div>
  </div>
</template>

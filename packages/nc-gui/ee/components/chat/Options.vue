<script setup lang="ts">
interface Question {
  question: string
  options: string[]
}

interface Props {
  questions: Question[]
}

const props = defineProps<Props>()

const emits = defineEmits<{
  select: [choice: string]
  skip: []
}>()

const { t } = useI18n()

const currentStep = ref(0)
const answers = ref<Record<number, string>>({})
const customInput = ref('')

const isSingleQuestion = computed(() => props.questions.length === 1)

const currentQuestion = computed(() => props.questions[currentStep.value])

const currentAnswer = computed(() => answers.value[currentStep.value])

const isLastStep = computed(() => currentStep.value === props.questions.length - 1)

const selectOption = (option: string) => {
  if (isSingleQuestion.value) {
    emits('select', option)
    return
  }
  answers.value = { ...answers.value, [currentStep.value]: option }
}
const submitAll = () => {
  const combined = props.questions.map((q, i) => `${q.question} ${answers.value[i]}`).join('\n')
  emits('select', combined)
}

const goNext = () => {
  if (!currentAnswer.value) return
  if (isLastStep.value) {
    submitAll()
    return
  }
  customInput.value = ''
  currentStep.value++
}

const goBack = () => {
  if (currentStep.value > 0) {
    customInput.value = ''
    currentStep.value--
  }
}

const handleCustomSubmit = () => {
  const trimmed = customInput.value.trim()
  if (!trimmed) return
  if (isSingleQuestion.value) {
    emits('select', trimmed)
    return
  }
  answers.value = { ...answers.value, [currentStep.value]: trimmed }
  customInput.value = ''
  // Auto-advance after custom input (same as clicking Next)
  nextTick(() => goNext())
}

watch(
  () => props.questions,
  () => {
    currentStep.value = 0
    answers.value = {}
    customInput.value = ''
  },
)
</script>

<template>
  <div class="nc-chat-options bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl overflow-hidden">
    <div v-if="!isSingleQuestion" class="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
      <div
        v-for="(_, si) in questions"
        :key="si"
        class="h-1 rounded-full transition-all duration-200"
        :class="[si <= currentStep ? 'bg-nc-fill-primary' : 'bg-nc-bg-gray-medium', si === currentStep ? 'flex-[2]' : 'flex-1']"
      />
    </div>
    <div class="flex items-center justify-between px-3 py-2.5">
      <span class="text-body text-nc-content-gray-emphasis leading-snug flex-1 mr-2">
        {{ currentQuestion?.question }}
      </span>
      <NcButton size="xxsmall" type="text" class="!text-nc-content-gray-muted flex-none" @click="emits('skip')">
        <GeneralIcon icon="close" class="w-3.5 h-3.5" />
      </NcButton>
    </div>

    <div class="border-t-1 border-nc-border-gray-light" />
    <div>
      <div
        v-for="(option, i) in currentQuestion?.options"
        :key="i"
        class="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors"
        :class="currentAnswer === option ? 'bg-nc-bg-brand-soft' : 'hover:bg-nc-bg-gray-light'"
        @click="selectOption(option)"
      >
        <span
          class="flex-none w-7 h-7 flex items-center justify-center rounded-lg text-captionSmBold border-1"
          :class="
            currentAnswer === option
              ? 'bg-nc-fill-primary text-white border-transparent'
              : 'bg-nc-bg-gray-extralight text-nc-content-gray-subtle border-nc-border-gray-light'
          "
        >
          {{ currentAnswer === option ? '&#10003;' : i + 1 }}
        </span>
        <span class="text-body text-nc-content-gray-emphasis">{{ option }}</span>
      </div>
    </div>

    <div class="border-t-1 border-nc-border-gray-light" />

    <div class="flex items-center gap-2 px-3 py-2.5">
      <GeneralIcon icon="ncEdit" class="flex-none w-4 h-4 text-nc-content-gray-muted" />
      <input
        v-model="customInput"
        class="flex-1 text-body text-nc-content-gray-emphasis bg-transparent outline-none placeholder:text-nc-content-gray-muted min-w-0"
        :placeholder="t('placeholder.somethingElse')"
        @keydown.stop
        @keydown.enter.prevent="handleCustomSubmit"
      />
      <NcButton v-if="customInput.trim()" size="xxsmall" type="primary" class="!px-3" @click="handleCustomSubmit">
        {{ isSingleQuestion ? t('general.send') : t('general.select') }}
      </NcButton>
      <NcButton
        v-else-if="isSingleQuestion"
        size="xxsmall"
        type="text"
        class="!text-nc-content-gray-subtle"
        @click="emits('skip')"
      >
        {{ t('general.skip') }}
      </NcButton>
    </div>
    <template v-if="!isSingleQuestion">
      <div class="border-t-1 border-nc-border-gray-medium" />
      <div class="flex items-center justify-between px-3 py-2">
        <div class="flex items-center gap-2">
          <NcButton v-if="currentStep > 0" size="small" type="secondary" @click="goBack">
            {{ t('general.back') }}
          </NcButton>
          <span class="text-captionSm text-nc-content-gray-muted"> {{ currentStep + 1 }}/{{ questions.length }} </span>
        </div>
        <div class="flex items-center gap-2">
          <NcButton size="small" type="secondary" @click="emits('skip')">
            {{ t('general.skip') }}
          </NcButton>
          <NcButton size="small" type="primary" :disabled="!currentAnswer" @click="goNext">
            {{ isLastStep ? t('general.submit') : t('labels.next') }}
          </NcButton>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
const { onInitOnboardingFlow, visibleQuestions } = useOnboardingFlow()

onMounted(() => {
  onInitOnboardingFlow()
})
</script>

<template>
  <AuthOnboardingLayout>
    <template #content>
      <template v-for="(question, index) of visibleQuestions" :key="question.id">
        <AuthOnboardingQuestion :question="question" :question-index="index" />
      </template>
    </template>
  </AuthOnboardingLayout>
</template>

<style lang="scss" scoped></style>

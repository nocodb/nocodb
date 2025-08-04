<script lang="ts" setup>
interface Props {}

const props = withDefaults(defineProps<Props>(), {})

const {} = toRefs(props)

const { stepper, onCompleteOnboardingFlow } = useOnboardingFlow()

const { index: stepIndex, steps, isLast } = stepper

const progress = computed(() => {
  return {
    percentage: (stepIndex.value / steps.value.length) * 100,
    text: `${stepIndex.value} / ${steps.value.length}`,
  }
})

watchEffect(() => {
  console.log('steps', stepper)
})
</script>

<template>
  <div class="w-full flex items-stretch h-full">
    <div class="w-full px-4 py-6 md:(w-1/2 px-8 py-12) h-full flex flex-col gap-[120px]">
      <header class="flex items-center justify-between">
        <GeneralIcon icon="nocodb1" class="w-12 h-12 flex-none" />

        <div class="w-[200px] text-bodyBold">
          <a-progress
            :percent="progress.percentage"
            size="small"
            status="normal"
            stroke-color="#3366FF"
            trail-color="#F0F3FF"
            :format="() => progress.text"
          />
        </div>
      </header>
      <slot name="content"></slot>

      <slot name="footer">
        <footer class="flex-1 flex flex-col justify-end">
          <div
            v-if="!isLast || true"
            class="flex items-center"
            :class="{
              'justify-center': stepIndex === 0,
              'justify-between': stepIndex > 0,
            }"
          >
            <NcButton v-if="stepIndex === 0" type="text" size="small" @click="onCompleteOnboardingFlow(true)">
              <div class="opacity-50">
                {{ $t('general.skip') }}
              </div>
            </NcButton>
            <template v-else>
              <NcButton type="text" size="small" @click="stepper.goTo(stepIndex - 1)">
                {{ $t('general.back') }}
              </NcButton>
              <NcButton type="text" size="small" @click="stepper.goTo(stepIndex + 1)">
                <div class="flex items-center gap-2">
                  {{ $t('general.next') }}
                  <div class="h-full bg-nc-bg-gray-medium">↵</div>
                </div>
              </NcButton>
            </template>
          </div>
        </footer>
      </slot>
    </div>
    <div class="hidden md:block w-1/2 border-l">
      <slot name="imagePreviewSection">
        <AuthOnboardingLayoutImagePreviewSection />
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

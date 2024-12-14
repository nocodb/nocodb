<script lang="ts" setup>
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import { breakpointsTailwind } from '@vueuse/core'
import tinycolor from 'tinycolor2'

enum TransitionDirection {
  Left = 'left',
  Right = 'right',
}

enum AnimationTarget {
  ArrowLeft = 'arrow-left',
  ArrowRight = 'arrow-right',
  OkButton = 'ok-button',
  SubmitButton = 'submit-button',
}

const { md } = useBreakpoints(breakpointsTailwind)

const {
  formState,
  formColumns,
  submitForm,
  submitted,
  secondsRemain,
  sharedFormView,
  sharedViewMeta,
  onReset,
  validateInfos,
  validate,
  clearValidate,
  isRequired,
  handleAddMissingRequiredFieldDefaultState,
  fieldMappings,
} = useSharedFormStoreOrThrow()

const { isMobileMode } = storeToRefs(useConfigStore())

const isTransitioning = ref(false)

const transitionName = ref<TransitionDirection>(TransitionDirection.Left)

const animationTarget = ref<AnimationTarget>(AnimationTarget.ArrowRight)

const isAnimating = ref(false)

const isStarted = ref(false)

const dialogShow = ref(false)

const el = ref<HTMLDivElement>()

const activeCell = ref<HTMLElement>()

provide(DropZoneRef, el)

provide(IsSurveyFormInj, ref(true))

const transitionDuration = computed(() => sharedViewMeta.value.transitionDuration || 100)

const steps = computed(() => {
  if (!formColumns.value) return []

  return formColumns.value.reduce<string[]>((acc, column) => {
    const title = column.label || column.title

    if (!title) return acc

    acc.push(title)

    return acc
  }, [])
})

const { index, goToPrevious, goToNext, isFirst, isLast, goTo } = useStepper(steps)

const field = computed(() => formColumns.value?.[index.value])

const fieldHasError = computed(() => {
  if (field.value?.title) {
    return validateInfos[fieldMappings.value[field.value.title]]?.validateStatus === 'error'
  }

  return false
})

function transition(direction: TransitionDirection) {
  isTransitioning.value = true
  transitionName.value = direction

  setTimeout(() => {
    transitionName.value =
      transitionName.value === TransitionDirection.Left ? TransitionDirection.Right : TransitionDirection.Left
  }, transitionDuration.value / 2)

  setTimeout(() => {
    isTransitioning.value = false

    setTimeout(focusInput, 100)
  }, transitionDuration.value)
}

function animate(target: AnimationTarget) {
  animationTarget.value = target

  isAnimating.value = true

  setTimeout(() => {
    isAnimating.value = false
  }, transitionDuration.value / 2)
}

const validateField = async (title: string) => {
  if (fieldMappings.value[title] === undefined) {
    console.warn('Missing mapping field for:', title)
    return false
  }

  try {
    await validate(fieldMappings.value[title])

    return true
  } catch (_e: any) {
    return false
  }
}

async function goNext(animationTarget?: AnimationTarget) {
  if (isLast.value || !isStarted.value || submitted.value || dialogShow.value || !field.value || !field.value.title) return

  if (field.value?.title && !(await validateField(field.value.title))) return

  animate(animationTarget || AnimationTarget.ArrowRight)

  setTimeout(
    () => {
      transition(TransitionDirection.Left)

      goToNext()
    },
    animationTarget === AnimationTarget.OkButton ? 300 : 0,
  )
}

async function goPrevious(animationTarget?: AnimationTarget) {
  if (isFirst.value || !isStarted.value || submitted.value || dialogShow.value) return

  animate(animationTarget || AnimationTarget.ArrowLeft)

  transition(TransitionDirection.Right)

  goToPrevious()
}

function focusInput() {
  if (document && typeof document !== 'undefined') {
    const inputEl =
      (document.querySelector('.nc-cell input') as HTMLInputElement) ||
      (document.querySelector('.nc-cell textarea') as HTMLTextAreaElement) ||
      (document.querySelector('.nc-cell [tabindex="0"]') as HTMLElement)

    if (inputEl) {
      activeCell.value = inputEl
      inputEl?.select?.()
      inputEl?.focus?.()
    }
  }
}

function resetForm() {
  clearValidate()
  submitted.value = false
  isStarted.value = false
  transition(TransitionDirection.Right)
  goTo(steps.value[0])
}

async function submit() {
  if (submitted.value) return
  dialogShow.value = false
  submitForm()
}

onReset(resetForm)

const onStart = () => {
  isStarted.value = true
  handleAddMissingRequiredFieldDefaultState()

  setTimeout(() => {
    focusInput()
  }, 100)
}

const handleFocus = () => {
  if (document?.activeElement !== activeCell.value) {
    focusInput()
  }
}

const showSubmitConfirmModal = async () => {
  if (field.value?.title && !(await validateField(field.value.title))) {
    return
  }

  dialogShow.value = true

  setTimeout(() => {
    // NcButton will only focus if document has already focused element
    document.querySelector('.nc-survery-form__confirmation_modal div[tabindex="0"]')?.focus()
    document.querySelector('.nc-survey-form-btn-submit.nc-button')?.focus()
  }, 50)
}

onKeyStroke(['ArrowLeft', 'ArrowDown'], () => {
  if (isMobileMode.value) return

  goPrevious(AnimationTarget.ArrowLeft)
})
onKeyStroke(['ArrowRight', 'ArrowUp'], () => {
  if (isMobileMode.value) return

  goNext(AnimationTarget.ArrowRight)
})
onKeyStroke(['Enter'], async (e) => {
  if (isMobileMode.value || submitted.value) return

  if (!isStarted.value && !submitted.value) {
    onStart()
  } else if (isStarted.value) {
    if (isLast.value) {
      if (dialogShow.value) {
        submit()
      } else {
        e.preventDefault()
        showSubmitConfirmModal()
      }
    } else {
      const activeElement = document.activeElement as HTMLElement

      if (activeElement?.classList && activeElement.classList.contains('nc-survey-form__btn-next')) return

      goNext(AnimationTarget.OkButton, true)
    }
  }
})

onKeyStroke('Escape', () => {
  if (document) {
    ;(document.activeElement as HTMLElement)?.blur?.()
  }
})

onMounted(() => {
  if (!md.value) {
    const { direction } = usePointerSwipe(el, {
      onSwipe: () => {
        if (isTransitioning.value) return

        if (direction.value === 'left') {
          goNext()
        } else if (direction.value === 'right') {
          goPrevious()
        }
      },
    })
  }
})

const { message: templatedMessage } = useTemplatedMessage(
  computed(() => sharedFormView?.value?.success_msg),
  computed(() => formState.value),
)
</script>

<template>
  <div class="h-full">
    <div class="survey md:p-0 w-full h-full flex flex-col max-w-[max(33%,688px)] mx-auto mb-4rem lg:mb-10rem">
      <div v-if="sharedFormView" class="my-auto z-2">
        <template v-if="!isStarted || submitted">
          <GeneralFormBanner
            v-if="sharedFormView && !parseProp(sharedFormView?.meta).hide_banner"
            :banner-image-url="sharedFormView.banner_image_url"
            class="flex-none mb-4"
          />
          <div class="rounded-3xl border-1 border-gray-200 p-6 lg:p-12 bg-white">
            <h1 class="text-2xl font-bold text-gray-900 mb-4" data-testid="nc-survey-form__heading">
              {{ sharedFormView.heading }}
            </h1>

            <div v-if="submitted" class="flex flex-col justify-center items-center text-center">
              <a-alert
                class="nc-survey-form__success-msg !p-4 !rounded-lg text-left w-full !bg-white !border-gray-200 !items-start"
                type="success"
                data-testid="nc-survey-form__success-msg"
                outlined
                show-icon
              >
                <template #message>
                  <LazyCellRichText
                    v-if="templatedMessage"
                    :value="templatedMessage"
                    class="!h-auto -ml-1"
                    is-form-field
                    read-only
                    sync-value-change
                  />
                  <span v-else>
                    {{ $t('msg.info.thankYou') }}
                  </span>
                </template>
                <template v-if="!templatedMessage" #description>
                  {{ $t('msg.info.submittedFormData') }}
                </template>

                <template #icon>
                  <div>
                    <GeneralIcon icon="circleCheck2" class="text-[#27D665]"></GeneralIcon>
                  </div>
                </template>
              </a-alert>

              <div
                v-if="
                  typeof sharedFormView?.redirect_url !== 'string' &&
                  (sharedFormView.show_blank_form || sharedFormView.submit_another_form)
                "
                class="mt-16 w-full flex justify-between items-center flex-wrap gap-3"
              >
                <p v-if="sharedFormView?.show_blank_form" class="text-sm text-gray-500 dark:text-slate-300 m-0">
                  {{ $t('labels.newFormLoaded') }} {{ secondsRemain }} {{ $t('general.seconds').toLowerCase() }}
                </p>

                <div class="flex-1 self-end flex justify-end">
                  <NcButton
                    v-if="sharedFormView?.submit_another_form"
                    type="secondary"
                    :size="isMobileMode ? 'medium' : 'small'"
                    data-testid="nc-survey-form__btn-submit-another-form"
                    @click="resetForm"
                  >
                    {{ $t('activity.submitAnotherForm') }}
                  </NcButton>
                </div>
              </div>
            </div>
            <template v-else-if="!isStarted">
              <div v-if="sharedFormView.subheading?.trim()">
                <LazyCellRichText
                  :value="sharedFormView.subheading"
                  class="font-medium text-base text-gray-500 dark:text-slate-300 !h-auto mb-4 -ml-1"
                  is-form-field
                  read-only
                  sync-value-change
                  data-testid="nc-survey-form__sub-heading"
                />
              </div>

              <div class="flex justify-end mt-12">
                <div class="flex items-center gap-3">
                  <div class="hidden md:flex text-sm items-center gap-1 text-gray-800">
                    <span> {{ $t('labels.pressEnter') }} ↵ </span>
                  </div>
                  <NcButton
                    :size="isMobileMode ? 'medium' : 'small'"
                    data-testid="nc-survey-form__fill-form-btn"
                    @click="onStart()"
                  >
                    Fill Form
                  </NcButton>
                </div>
              </div>
            </template>
          </div>
        </template>
        <div v-else class="px-6 lg:px-12">
          <h1 class="text-2xl font-bold text-gray-900 line-clamp-2 text-center mb-2rem md:mb-4rem">
            {{ sharedFormView.heading }}
          </h1>
        </div>
        <template v-if="isStarted && !submitted">
          <Transition :name="`slide-${transitionName}`" :duration="transitionDuration" mode="out-in">
            <a-form :model="formState">
              <div
                ref="el"
                :key="field?.title"
                class="flex flex-col gap-4 w-full m-auto rounded-xl border-1 border-gray-200 bg-white p-6 lg:p-12"
              >
                <div class="select-none text-gray-500 mb-4 md:mb-2" data-testid="nc-survey-form__footer">
                  {{ index + 1 }} / {{ formColumns?.length }}
                </div>

                <div v-if="field" class="flex flex-col gap-2">
                  <div class="nc-form-column-label text-sm font-semibold text-gray-800" data-testid="nc-form-column-label">
                    <span>
                      {{ field.label || field.title }}
                    </span>
                    <span v-if="isRequired(field)" class="text-red-500 text-base leading-[18px]">&nbsp;*</span>
                  </div>
                  <div
                    v-if="field?.description"
                    class="nc-form-column-description text-gray-500 text-sm"
                    data-testid="nc-survey-form__field-description"
                  >
                    <LazyCellRichText
                      :value="field?.description"
                      class="!h-auto -ml-1"
                      is-form-field
                      read-only
                      sync-value-change
                    />
                  </div>

                  <NcTooltip :disabled="!field?.read_only">
                    <template #title> {{ $t('activity.preFilledFields.lockedFieldTooltip') }} </template>
                    <a-form-item
                      v-if="field.title && fieldMappings[field.title]"
                      :name="fieldMappings[field.title]"
                      class="!my-0 nc-input-required-error"
                      v-bind="validateInfos[fieldMappings[field.title]]"
                    >
                      <SmartsheetDivDataCell class="relative nc-form-data-cell" @click.stop="handleFocus">
                        <LazySmartsheetVirtualCell
                          v-if="isVirtualCol(field)"
                          v-model="formState[field.title]"
                          class="mt-0 nc-input h-auto"
                          :class="{
                            readonly: field?.read_only,
                          }"
                          :row="{ row: {}, oldRow: {}, rowMeta: {} }"
                          :data-testid="`nc-survey-form__input-${field.title.replaceAll(' ', '')}`"
                          :column="field"
                          :read-only="field?.read_only"
                          @update:model-value="validateField(field.title)"
                        />

                        <LazySmartsheetCell
                          v-else
                          v-model="formState[field.title]"
                          class="nc-input h-auto"
                          :class="{ 'layout-list': parseProp(field?.meta)?.isList, 'readonly': field?.read_only }"
                          :data-testid="`nc-survey-form__input-${field.title.replaceAll(' ', '')}`"
                          :column="field"
                          :edit-enabled="!field?.read_only"
                          :read-only="field?.read_only"
                          @update:model-value="validateField(field.title)"
                        />
                      </SmartsheetDivDataCell>
                    </a-form-item>
                    <div class="flex flex-col gap-2 text-slate-500 dark:text-slate-300 text-xs my-2 px-1">
                      <div
                        v-if="field.uidt === UITypes.LongText"
                        class="hidden text-sm text-gray-500 md:flex flex-wrap items-center"
                      >
                        {{ $t('general.shift') }} <MdiAppleKeyboardShift class="mx-1 text-primary" /> + {{ $t('general.enter') }}
                        <MaterialSymbolsKeyboardReturn class="mx-1 text-primary" />
                        {{ $t('msg.info.makeLineBreak') }}
                      </div>
                    </div>
                  </NcTooltip>
                </div>

                <div class="ml-1 mt-4 flex w-full text-lg">
                  <div class="flex-1 flex justify-end">
                    <div v-if="isLast">
                      <NcButton
                        :size="isMobileMode ? 'medium' : 'small'"
                        :class="
                          animationTarget === AnimationTarget.SubmitButton && isAnimating
                            ? 'transform translate-y-[1px] translate-x-[1px] ring ring-accent ring-opacity-100'
                            : ''
                        "
                        :disabled="fieldHasError"
                        data-testid="nc-survey-form__btn-submit-confirm"
                        @click="showSubmitConfirmModal"
                      >
                        {{ $t('general.submit') }} form
                      </NcButton>
                    </div>

                    <div v-else class="flex items-center gap-3">
                      <div
                        class="hidden md:flex text-sm items-center gap-1"
                        :class="fieldHasError ? 'text-gray-200' : 'text-gray-800'"
                      >
                        <span> {{ $t('labels.pressEnter') }} ↵ </span>
                      </div>
                      <NcButton
                        :size="isMobileMode ? 'medium' : 'small'"
                        data-testid="nc-survey-form__btn-next"
                        class="nc-survey-form__btn-next"
                        :class="[
                          animationTarget === AnimationTarget.OkButton && isAnimating
                            ? 'transform translate-y-[2px] translate-x-[2px] after:(!ring !ring-accent !ring-opacity-100)'
                            : '',
                        ]"
                        :disabled="fieldHasError"
                        @click="goNext()"
                      >
                        {{ $t('labels.next') }}
                      </NcButton>
                    </div>
                  </div>
                </div>
              </div>
            </a-form>
          </Transition>
        </template>
      </div>
      <div class="lg:(absolute bottom-0 left-0 right-0 px-4 pb-4) lg:px-10 lg:pb-10 pointer-events-none">
        <div class="flex justify-end items-center gap-4 nc-survey-form-branding">
          <div class="flex justify-center">
            <GeneralFormBranding
              class="inline-flex mx-auto"
              :style="{
                color: tinycolor.isReadable(parseProp(sharedFormView?.meta)?.background_color || '#F9F9FA', '#D5D5D9', {
                  level: 'AA',
                  size: 'large',
                })
                  ? '#fff'
                  : tinycolor
                      .mostReadable(parseProp(sharedFormView?.meta)?.background_color || '#F9F9FA', ['#374151', '#D5D5D9'])
                      .toHex8String(),
              }"
            />
          </div>
          <div v-if="isStarted && !submitted" class="flex items-center gap-3">
            <NcButton
              type="secondary"
              :size="isMobileMode ? 'medium' : 'small'"
              data-testid="nc-survey-form__icon-prev"
              :disabled="isFirst"
              @click="goPrevious()"
            >
              <GeneralIcon icon="ncArrowLeft"
            /></NcButton>

            <NcButton
              :size="isMobileMode ? 'medium' : 'small'"
              type="secondary"
              data-testid="nc-survey-form__icon-next"
              :disabled="isLast || fieldHasError"
              @click="goNext()"
            >
              <GeneralIcon icon="ncArrowRight" />
            </NcButton>
          </div>
        </div>
      </div>
    </div>

    <NcModal v-model:visible="dialogShow" size="small" class="nc-survery-form__confirmation_modal">
      <div>
        <div class="text-lg font-bold">{{ $t('general.submit') }} {{ $t('objects.viewType.form') }}</div>
        <div class="mt-1 text-sm">{{ $t('title.surveyFormSubmitConfirmMsg') }}</div>
        <div class="flex justify-end mt-7 gap-x-2">
          <NcButton type="secondary" :size="isMobileMode ? 'medium' : 'small'" @click="dialogShow = false">{{
            $t('general.back')
          }}</NcButton>
          <NcButton
            type="primary"
            :size="isMobileMode ? 'medium' : 'small'"
            data-testid="nc-survey-form__btn-submit"
            class="nc-survey-form-btn-submit"
            @click="submit"
          >
            {{ $t('general.submit') }}
          </NcButton>
        </div>
      </div>
    </NcModal>
  </div>
</template>

<style lang="scss" scoped>
.nc-input-required-error {
  max-width: 100%;
  white-space: pre-line;
  :deep(.ant-form-item-explain-error) {
    &:first-child {
      @apply mt-2;
    }
  }

  &:focus-within {
    :deep(.ant-form-item-explain-error) {
      @apply text-gray-400;
    }
  }
}
:deep(.ant-form-item-has-error .ant-select:not(.ant-select-disabled) .ant-select-selector) {
  border: none !important;
}
:deep(.ant-form-item-has-success .ant-select:not(.ant-select-disabled) .ant-select-selector) {
  border: none !important;
}
</style>

<style lang="scss">
:global(html),
:global(body) {
  @apply overscroll-x-none;
}

.survey {
  .nc-form-column-label {
    .nc-icon {
      @apply mr-2;
    }
  }

  .nc-form-column-label__checkbox {
    @apply flex items-center justify-center gap-2 text-left;
  }

  .nc-form-data-cell.nc-data-cell {
    @apply !border-none rounded-none;

    &:focus-within {
      @apply !border-none;
    }
  }

  .nc-survey-form__success-msg {
    .ant-alert-icon {
      @apply flex items-start;
    }
  }
}

@media (min-width: 1024px) and (max-width: 1170px) {
  .nc-survey-form-branding {
    @apply flex-col;
  }
}
</style>

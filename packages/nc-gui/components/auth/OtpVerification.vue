<script setup lang="ts">
/**
 * OTP Verification Component
 * 
 * This component provides a clean OTP input field without spinner controls.
 * It uses type="tel" with inputmode="numeric" for better UX on mobile devices.
 */

const props = defineProps<{
  length?: number
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'complete': [value: string]
}>()

const otpLength = computed(() => props.length || 6)
const otpValue = ref('')

// Watch for modelValue changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== undefined && newValue !== otpValue.value) {
      otpValue.value = newValue
    }
  },
  { immediate: true }
)

// Handle input
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  let value = target.value.replace(/\D/g, '') // Remove non-digits
  
  // Limit to specified length
  if (value.length > otpLength.value) {
    value = value.slice(0, otpLength.value)
  }
  
  otpValue.value = value
  emit('update:modelValue', value)
  
  // Emit complete event when OTP is fully entered
  if (value.length === otpLength.value) {
    emit('complete', value)
  }
}

// Handle paste
const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedData = event.clipboardData?.getData('text') || ''
  const digits = pastedData.replace(/\D/g, '').slice(0, otpLength.value)
  
  otpValue.value = digits
  emit('update:modelValue', digits)
  
  if (digits.length === otpLength.value) {
    emit('complete', digits)
  }
}
</script>

<template>
  <div class="otp-verification">
    <input
      v-model="otpValue"
      type="tel"
      inputmode="numeric"
      pattern="[0-9]*"
      :maxlength="otpLength"
      class="otp-input"
      placeholder="0".repeat(otpLength)
      autocomplete="one-time-code"
      @input="handleInput"
      @paste="handlePaste"
    />
  </div>
</template>

<style scoped lang="scss">
.otp-verification {
  @apply w-full;
}

.otp-input {
  /* Remove spinner controls */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  -moz-appearance: textfield;
  
  /* Styling */
  @apply w-full px-4 py-3 text-center text-xl tracking-[0.5em];
  @apply border-1 border-solid border-primary border-opacity-50 rounded;
  @apply focus:(outline-none ring-2 ring-primary ring-opacity-50);
  @apply transition-all duration-200;
  
  /* Placeholder styling */
  &::placeholder {
    @apply text-gray-300 tracking-[0.5em];
  }
  
  /* Focus state */
  &:focus {
    @apply border-primary;
  }
  
  /* Error state (can be added via class) */
  &.error {
    @apply border-red-500 ring-red-500;
  }
}
</style>

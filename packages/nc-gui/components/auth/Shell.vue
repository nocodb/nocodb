<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  subtitle: undefined,
  loading: false,
})

const emits = defineEmits<{
  logoDblclick: []
}>()

const { productName, brandColor, isWhiteLabelled } = useBranding()

const { isDark } = useTheme()

const panelStyle = computed(() => (isWhiteLabelled.value && brandColor.value ? { background: brandColor.value } : undefined))
</script>

<template>
  <div class="nc-auth-shell nc-h-screen w-full flex overflow-hidden" :class="{ 'nc-auth-shell--dark': isDark }">
    <aside
      class="nc-auth-stage hidden lg:flex flex-col w-[48%] max-w-[720px] pt-12 text-white relative overflow-hidden"
      :style="panelStyle"
    >
      <div class="px-12 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-[10px] flex items-center justify-center shadow-sm"
          :class="isDark ? 'bg-[#16161a] ring-1 ring-white/15' : 'bg-white'"
        >
          <GeneralNocoIcon inline :size="26" :animate="loading" @dblclick="emits('logoDblclick')" />
        </div>
        <span class="text-subHeading1 text-white">{{ productName }}</span>
      </div>

      <template v-if="!isWhiteLabelled">
        <div class="px-12 mt-12 max-w-[560px]">
          <h2 class="text-heading2 !leading-[46px] !tracking-[-0.03em] text-white m-0">
            {{ $t('labels.auth.brandHeadline') }}
          </h2>
          <p class="text-bodyLg text-[#D6E0FF] mt-4 mb-0">{{ $t('labels.auth.brandSubtitle') }}</p>
        </div>

        <!-- the live product window bleeds off the bottom-right edge, like the marketing site's flush stage -->
        <AuthLivePreview class="flex-1 min-h-0 mt-10" />
      </template>
    </aside>

    <main class="nc-auth-form-side relative flex-1 min-w-0 overflow-y-auto">
      <div class="nc-auth-lang absolute top-6 right-6 z-10">
        <GeneralLanguage button />
      </div>

      <div class="min-h-full flex flex-col items-center justify-center px-4 py-12">
        <div class="w-full max-w-[380px] flex flex-col">
          <div class="flex flex-col items-center lg:items-start text-center lg:text-left mb-8">
            <GeneralNocoIcon inline :size="44" :animate="loading" class="mb-6 lg:!hidden" @dblclick="emits('logoDblclick')" />

            <h1 class="nc-auth-title text-heading3 m-0" data-testid="nc-auth-title">{{ title }}</h1>

            <p v-if="subtitle || $slots.subtitle" class="nc-auth-subtitle text-body mt-2 mb-0">
              <slot name="subtitle">{{ subtitle }}</slot>
            </p>
          </div>

          <slot />

          <div v-if="$slots.footer" class="nc-auth-subtitle mt-6 text-center lg:text-left text-body">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
// form-side tokens from the marketing site (landing-page app/globals.css), so the controls match its contact form
.nc-auth-shell {
  --auth-bg: oklch(0.985 0.001 270);
  --auth-surface: oklch(1 0 0);
  --auth-ink: oklch(0.17 0.006 270);
  --auth-ink-2: oklch(0.41 0.008 270);
  --auth-ink-3: oklch(0.58 0.008 270);
  --auth-blue: oklch(0.49 0.25 267);
  --auth-blue-ink: oklch(0.45 0.23 267);
  --auth-shadow-border: 0 0 0 1px oklch(0 0 0 / 0.06), 0 1px 2px -1px oklch(0 0 0 / 0.06), 0 2px 4px 0 oklch(0 0 0 / 0.04);
  --auth-shadow-border-hover: 0 0 0 1px oklch(0 0 0 / 0.08), 0 1px 2px -1px oklch(0 0 0 / 0.08), 0 2px 4px 0 oklch(0 0 0 / 0.06);
  --auth-inverse: oklch(0.17 0.006 270);
  --auth-inverse-hover: oklch(0.27 0.008 270);
  --auth-on-inverse: oklch(1 0 0);
  --auth-shadow-button: inset 0 1px 0 oklch(1 0 0 / 0.16), 0 0 0 1px var(--auth-inverse), 0 1px 2px oklch(0 0 0 / 0.3),
    0 2px 4px oklch(0 0 0 / 0.12);
  --auth-danger: oklch(0.5 0.19 22);
}

.nc-auth-shell--dark {
  --auth-bg: oklch(0.16 0.006 270);
  --auth-surface: oklch(0.205 0.007 270);
  --auth-ink: oklch(0.96 0.003 270);
  --auth-ink-2: oklch(0.76 0.008 270);
  --auth-ink-3: oklch(0.6 0.01 270);
  --auth-blue: oklch(0.52 0.24 267);
  --auth-blue-ink: oklch(0.78 0.13 267);
  --auth-shadow-border: 0 0 0 1px oklch(1 0 0 / 0.08);
  --auth-shadow-border-hover: 0 0 0 1px oklch(1 0 0 / 0.13);
  --auth-inverse: oklch(0.96 0.003 270);
  --auth-inverse-hover: oklch(0.86 0.005 270);
  --auth-on-inverse: oklch(0.17 0.006 270);
  --auth-shadow-button: inset 0 1px 0 oklch(1 0 0 / 0.5), 0 1px 2px oklch(0 0 0 / 0.4);
  --auth-danger: oklch(0.7 0.16 22);
}

.nc-auth-form-side {
  background: var(--auth-bg);
}

.nc-auth-title {
  color: var(--auth-ink);
}

.nc-auth-subtitle {
  color: var(--auth-ink-2);
}

// the marketing site's `.stage` dither, faded out at the top so the copy sits on clean blue
.nc-auth-stage {
  isolation: isolate;
  background: oklch(0.49 0.25 267);

  &::before,
  &::after {
    content: '';
    @apply absolute inset-0 pointer-events-none;
    z-index: -1;
  }

  &::before {
    background-image: radial-gradient(oklch(1 0 0 / 0.5) 1px, transparent 1.2px);
    background-size: 5px 5px;
    mask-image: linear-gradient(to bottom, transparent 30%, black 75%);
  }

  &::after {
    background-image: radial-gradient(oklch(0.3 0.2 267 / 0.55) 1px, transparent 1.4px);
    background-size: 7px 7px;
    background-position: 3px 2px;
    mask-image: radial-gradient(90% 60% at 0% 0%, black, transparent 70%);
  }
}

// deeper blue so the panel doesn't glare next to the dark form
.nc-auth-shell--dark .nc-auth-stage {
  background: oklch(0.36 0.17 267);
  box-shadow: inset -1px 0 0 oklch(1 0 0 / 0.08);

  &::before {
    opacity: 0.6;
  }
}

.nc-auth-shell {
  :deep(.ant-form-item) {
    @apply mb-5;
  }

  :deep(.ant-form-item-explain) {
    @apply mt-1.5 min-h-0;
  }

  :deep(.ant-form-item-explain-error),
  :deep(.ant-form-item-explain-connected .ant-form-item-explain-error) {
    font-size: 12px;
    line-height: 16px;
    color: var(--auth-danger);
  }

  // labels outside an a-form-item (e.g. the 2FA code) use the same color
  :deep(.nc-auth-field-label) {
    color: var(--auth-ink);
  }

  :deep(.ant-form-item-label) {
    @apply pb-1.5;

    // full width so a label row can carry a right-aligned link (forgot password, resend code)
    label {
      @apply text-caption w-full;
      color: var(--auth-ink);
    }

    // design drops the required asterisk; validation messages already say so
    label::before {
      @apply !hidden;
    }
  }

  // inputs: hairline shadow instead of a border, 2px blue ring on focus (landing contact form)
  :deep(.ant-input),
  :deep(.ant-input-affix-wrapper) {
    @apply rounded-lg h-10 px-3 text-body;
    border: none !important;
    background: var(--auth-surface);
    color: var(--auth-ink);
    box-shadow: var(--auth-shadow-border) !important;
    transition: box-shadow 150ms ease-out;

    &:hover {
      box-shadow: var(--auth-shadow-border-hover) !important;
    }

    &::placeholder,
    input::placeholder {
      color: var(--auth-ink-3);
    }
  }

  :deep(.ant-input:focus),
  :deep(.ant-input-affix-wrapper-focused) {
    box-shadow: 0 0 0 2px var(--auth-blue) !important;
  }

  :deep(.ant-input-affix-wrapper .ant-input) {
    @apply h-auto px-0 rounded-none;
    box-shadow: none !important;
    background: transparent;
  }

  // browser autofill paints its own fill on the inner input; keep the field's surface and ink
  :deep(input:-webkit-autofill) {
    -webkit-text-fill-color: var(--auth-ink);
    caret-color: var(--auth-ink);
    transition: background-color 9999s ease-out 0s;
  }

  :deep(.ant-input-password-icon) {
    color: var(--auth-ink-3);
  }

  :deep(.ant-form-item-has-error) {
    .ant-input,
    .ant-input-affix-wrapper {
      box-shadow: 0 0 0 1px var(--auth-danger) !important;
    }

    .ant-input-affix-wrapper .ant-input {
      box-shadow: none !important;
    }
  }

  // primary action: the marketing site's inverse button (near-black in light, near-white in dark)
  :deep(.nc-auth-primary.ant-btn) {
    @apply h-11 rounded-lg text-[15px];
    border: none !important;
    background: var(--auth-inverse) !important;
    color: var(--auth-on-inverse) !important;
    box-shadow: var(--auth-shadow-button) !important;
    transition: scale 150ms ease-out, background-color 150ms ease-out;

    &:hover {
      background: var(--auth-inverse-hover) !important;
    }

    &:active {
      scale: 0.96;
    }

    &[disabled] {
      opacity: 0.5;
    }
  }

  :deep(.nc-auth-link) {
    @apply !no-underline hover:underline cursor-pointer;
    color: var(--auth-blue-ink) !important;
  }

  // provider buttons carry the "Last used" badge on their right edge
  :deep(.nc-auth-provider) {
    @apply relative block !no-underline;
  }

  :deep(.nc-auth-provider-badge) {
    @apply absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none;
  }

  // language picker: a quiet landing-style pill instead of the floating brand circle
  :deep(.nc-auth-lang .ant-btn) {
    @apply rounded-lg;
    border: none !important;
    background: var(--auth-surface) !important;
    box-shadow: var(--auth-shadow-border) !important;

    &:hover {
      box-shadow: var(--auth-shadow-border-hover) !important;
    }

    .text-nc-content-gray {
      color: var(--auth-ink-2);
    }
  }
}
</style>

<style lang="scss">
// the auth screens carry their own language picker
body:has(.nc-auth-shell) .nc-lang-btn-wrapper {
  display: none;
}
</style>

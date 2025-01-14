<script setup lang="ts">
withDefaults(
  defineProps<{
    stroke?: string
  }>(),
  {
    stroke: '#4A5268',
  },
)
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
    <g clip-path="url(#clip0_1422_4212)">
      <path
        class="loader-line"
        d="M8 12V14.6667"
        :stroke="stroke"
        stroke-width="1.33333"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        class="loader-line"
        d="M10.8267 10.8267L12.7133 12.7133"
        :stroke="stroke"
        stroke-width="1.33333"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        class="loader-line"
        d="M12 8H14.6667"
        :stroke="stroke"
        stroke-width="1.33333"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        class="loader-line"
        d="M10.8267 5.17335L12.7133 3.28668"
        :stroke="stroke"
        stroke-width="1.33333"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        class="loader-line"
        d="M8 1.33331V3.99998"
        :stroke="stroke"
        stroke-width="1.33333"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        class="loader-line"
        d="M3.28662 3.28668L5.17329 5.17335"
        :stroke="stroke"
        stroke-width="1.33333"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        class="loader-line"
        d="M1.33325 8H3.99992"
        :stroke="stroke"
        stroke-width="1.33333"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        class="loader-line"
        d="M3.28662 12.7133L5.17329 10.8267"
        :stroke="stroke"
        stroke-width="1.33333"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>
    <defs>
      <clipPath id="clip0_1422_4212">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </svg>
</template>

<style>
@keyframes fadeInOut {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
}
.loader-line {
  animation: fadeInOut 1s ease-in-out infinite;
}
.loader-line:nth-child(8) {
  animation-delay: 0ms;
}
.loader-line:nth-child(7) {
  animation-delay: 125ms;
}
.loader-line:nth-child(6) {
  animation-delay: 250ms;
}
.loader-line:nth-child(5) {
  animation-delay: 375ms;
}
.loader-line:nth-child(4) {
  animation-delay: 500ms;
}
.loader-line:nth-child(3) {
  animation-delay: 625ms;
}
.loader-line:nth-child(2) {
  animation-delay: 750ms;
}
.loader-line:nth-child(1) {
  animation-delay: 875ms;
}
</style>

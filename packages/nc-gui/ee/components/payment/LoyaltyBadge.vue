<script lang="ts" setup>
import bgImage from '~/assets/img/loyalty-bg.png'
</script>

<template>
  <div
    class="loyalty-badge flex gap-5 rounded-lg p-4 border-1 border-nc-border-grey-medium bg-cover bg-no-repeat bg-center"
    :style="{
      'background-image': `url(${bgImage})`,
      'background-color': 'rgba(255, 255, 255, 0.8)',
      'background-blend-mode': 'overlay',
    }"
  >
    <div class="text-2xl">🎊</div>
    <div class="flex flex-col gap-2">
      <span class="font-bold text-base">You’ve Unlocked Loyalty Discounts! Save up to 55%!</span>
      <span class="text-sm text-nc-content-gray-muted"
        >Thanks for being with us since day one. Enjoy the team plan capped at
        <span class="line-through decoration-red-500 font-bold mr-1">$108</span><span class="font-bold">$48</span> and the
        Business plan capped at <span class="line-through decoration-red-500 font-bold mr-1">$216</span>
        <span class="font-bold">$96</span> for the next year!</span
      >
      <PaymentExpiresIn end-time="2025-04-30" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { LOYALTY_GRACE_PERIOD_END_DATE } from 'nocodb-sdk'
import bgImage from '~/assets/img/loyalty-bg.png'
</script>

<template>
  <div
    class="loyalty-badge flex gap-4 rounded-lg p-4 border-1 border-nc-border-gray-medium bg-cover bg-no-repeat bg-center"
    :style="{
      'background-image': `url(${bgImage})`,
      'background-color': 'rgba(255, 255, 255, 0.8)',
      'background-blend-mode': 'overlay',
    }"
  >
    <div class="text-2xl">🎊</div>
    <div class="flex flex-col gap-1.5">
      <span class="font-bold text-base">Loyalty Discount Unlocked! Save upto 55%!</span>
      <span class="text-sm text-nc-content-gray-muted">
        Thanks for being with us during technical preview. Get the Plus plan capped at
        <span class="font-bold mr-1">$48</span>(was <span class="line-through decoration-red-500 font-bold">$108</span>) and the
        Business plan capped at <span class="font-bold mr-1">$96</span>(was
        <span class="line-through decoration-red-500 font-bold">$216</span>) for the year.
      </span>
      <PaymentExpiresIn :end-time="LOYALTY_GRACE_PERIOD_END_DATE" />
    </div>
  </div>
</template>

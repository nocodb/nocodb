<script setup lang="ts"></script>

<template>
  <div class="block relative">
    <div class="relative pb-12">
      <div class="aside">
        <div class="aside-divider">
          <div class="aside-divider-dot"></div>
        </div>
        <div class="aside-inner">
          <div class="text-sm text-gray-700 leading-5">August 16th 2024</div>
        </div>
      </div>

      <div class="content">
        <div class="flex flex-col py-6 gap-8">
          <h1>Connect Kit</h1>
          <p>
            This update includes improvements to the CoinbaseWalletSDK connect popup and MockConnector . Fixed CoinbaseWalletSDK
            connect popup now works on first interaction. MockConnector now working as intended.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.content {
  @apply !pl-50;
}

.aside {
  @apply absolute left-0 top-2 bottom-2 w-44;

  .aside-inner {
    @apply sticky top-0;
  }

  .aside-divider {
    @apply absolute top-0 right-0 bottom-0 w-1.5;
    &:before {
      @apply absolute bg-[#E7E7E9] left-0 transform -translate-x-1/2;
      content: '';
      top: 6px;
      bottom: -18px;
      width: 2px;
      border-radius: 2px;
    }

    .aside-divider-dot {
      @apply sticky top-0
      transform: translateY(calc(-50% + 3px)) translateX(50%);
      &:before {
        @apply bg-brand-500 absolute w-1.5 h-1.5 left-0 rounded-full transform -translate-x-1/2;
        content: '';
      }
    }
  }
}
</style>

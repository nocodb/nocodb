<script lang="ts" setup>
const buttonClass = 'flex-grow !inline-flex !border-none !shadow-none !rounded-[0px] !text-left content-top !py-2 !px-4'
</script>

<template>
  <div
    class="bg-white w-[320px] h-[132px] flex flex-col rounded-[8px] overflow-hidden py-2 animate-animated animate-fadeIn"
    style="animation-duration: 0.3s"
  >
    <a-button :class="[buttonClass]" type="text">
      <div class="flex flex-col gap-1">
        <div class="flex gap-2 items-center">
          <GeneralIcon class="w-[16px] h-[16px]" icon="singleSelect" />
          <span>Using Single select field</span>
        </div>
        <div>
          <span class="text-nc-content-gray-muted ml-[24px]" style="font-size: 13px"
            >Colour records based on single select field</span
          >
        </div>
      </div>
    </a-button>
    <a-button :class="[buttonClass]" type="text">
      <div class="flex flex-col gap-1">
        <div class="flex gap-2 items-center">
          <GeneralIcon class="w-[16px] h-[16px]" icon="ncConditions" />
          <span>Using Conditions</span>
        </div>
        <div>
          <span class="text-nc-content-gray-muted ml-[24px]" style="font-size: 13px">Colour records based on conditions</span>
        </div>
      </div>
    </a-button>
  </div>
</template>

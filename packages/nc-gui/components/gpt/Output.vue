<script setup lang="ts">
// TODO:
</script>

<template>
  <div>
    <div class="flex items-center gap-1 p-[7px]">
      <a-button class="!rounded-md !border-none">
        New Outputs
        <span class="bg-gray-200 ml-1 px-2 rounded-md">
          <!-- TODO: -->
          1
        </span>
      </a-button>
      <a-button class="!rounded-md !bg-[#F8FAFD] !border-none"> History </a-button>
    </div>
  </div>
  <!-- TODO: -->
  <div v-for="i of [1, 2, 3]" :key="i" class="bg-[#EEF2FF] border-b-1 border-gray-200">
    <div class="p-[24px] pb-0">
      -NESCAFE Original is made with 100% coffee beans for a rich, full flavor <br />
      -The hinged lid with Click-to-close technology keeps your coffee fresh and easy to acccess <br />
      -Space efficient tin is perfect for small kitchens or on the go <br />
    </div>
    <div class="flex justify-end pr-3 pb-3">3 mins ago</div>
  </div>
</template>

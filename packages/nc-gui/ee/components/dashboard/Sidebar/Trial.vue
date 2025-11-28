<script lang="ts" setup>
const { appInfo } = useGlobal()

const numberOfDaysLeft = computed(() => {
  const today = new Date()
  const trialEndDate = new Date(appInfo.value.licenseExpiryTime * 1000)

  const timeDiff = trialEndDate.getTime() - today.getTime()
  return Math.ceil(timeDiff / (1000 * 3600 * 24))
})

// calculate the percentage of the trial period
const trialPercentage = computed(() => {
  const today = new Date()
  const trialStartDate = new Date(appInfo.value.licenseIssuedTime * 1000)
  const trialEndDate = new Date(appInfo.value.licenseExpiryTime * 1000)

  const timeDiff = trialEndDate - today.getTime()
  const timeDiffTotal = trialEndDate.getTime() - trialStartDate.getTime()
  return Math.max(0, Math.min(100, Math.ceil((timeDiff / timeDiffTotal) * 100)))
})

// color of the progress bar based on the percentage
const precentageColor = computed(() => {
  if (trialPercentage.value > 50) {
    return '#3366FF'
  } else if (trialPercentage.value > 25) {
    return '#FA8231'
  } else {
    return '#FF4A3F'
  }
})
</script>

<template>
  <a-card class="nc-trial-card">
    <div class="flex flex-col gap-3">
      <div class="font-weight-semibold text-base flex gap-2">
        <img width="48" alt="NocoDB" src="~/assets/img/icons/256x256.png" class="flex-none" />
        Enterprise Trial License
      </div>
      <a-progress :percent="trialPercentage" :stroke-color="precentageColor" :show-info="false" />

      <div class="text-nc-content-gray">
        <span v-if="numberOfDaysLeft >= 0">Expires in: {{ numberOfDaysLeft }} day{{ numberOfDaysLeft > 1 ? 's' : '' }}</span
        ><span v-else>License expired</span><br />
        Licensed to: {{ appInfo.licensedTo }}
      </div>
      <a no-prefetch no-rel href="https://calendly.com/nocodb-meeting" target="_blank">
        <nc-button size="small" class="text-center w-full text-white">
          <div class="flex gap-2 items-center justify-center">
            <GeneralIcon icon="phoneCall" />
            Talk to sales
          </div>
        </nc-button>
      </a>
    </div>
  </a-card>
</template>

<style scoped>
.nc-trial-card {
  @apply !rounded-xl border-nc-orange-200 !bg-nc-orange-100 !p-1 text-nc-content-gray;
}
</style>

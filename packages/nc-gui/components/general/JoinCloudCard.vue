<template>
  <a-card>
    <template #cover>
      <img class="max-h-[180px] !rounded-t-lg" alt="cover" src="~/assets/img/noco-banner.png" />
    </template>

    <a-card-meta>
      <template #title>
        <span v-if="!nav" class="text-xl pb-4"> Join NocoDB Cloud! </span>
      </template>
    </a-card-meta>

    <div v-if="!nav" class="py-5 text-sm">
      Register for an early preview of our FREE cloud offering. We aim to equip every business with our cloud solution which is
      fair priced rather than <em>per</em> user <em>per</em> month.
    </div>

    <div class="flex justify-center">
      <a-button
        v-e="['c:navbar:join-cloud', { home: true }]"
        class="flex items-center space-x-1 cursor-pointer pl-3 py-1.5 !text-current !no-underline !hover:(text-primary bg-primary bg-opacity-5) flex-shrink"
        href="https://docs.google.com/forms/d/e/1FAIpQLSfKLe8Rcrq0uo2_jM5W1kbVBbzDiQ3IvlP8Iov61FTekVAvzA/viewform?usp=pp_url"
        target="_blank"
      >
        <span class="mr-1">🚀</span>

        Join Now
      </a-button>
    </div>
  </a-card>
</template>

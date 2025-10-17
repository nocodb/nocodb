<template>
  <div class="col-span-3 flex flex-col items-center justify-center py-12">
    <div class="text-nc-content-gray-subtle2 text-lg">
      <slot name="title"> {{ $t('objects.templates.noTemplatesFound') }} </slot>
    </div>
    <div class="text-nc-content-gray-subtle2">
      <slot name="subtitle"> {{ $t('objects.templates.tryCheckingBackLaterForNewTemplates') }}</slot>
    </div>
  </div>
</template>

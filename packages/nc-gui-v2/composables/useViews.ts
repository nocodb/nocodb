import { useNuxtApp } from "#app";
import { TableType } from "nocodb-sdk";
import { Ref } from "vue";

export default function(meta: Ref<TableType>) {
  const views = ref();
  const { $api } = useNuxtApp();

  const loadViews = async () => {
    if (meta.value?.id)
      views.value = (await $api.dbView.list(meta.value?.id)).list;
  };

  return  { views, loadViews };
}

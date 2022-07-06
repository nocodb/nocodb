import { Api } from "nocodb-sdk";
import type { ComputedRef, Ref } from "vue";
import type { PaginatedType, TableType } from "nocodb-sdk";
import { useNuxtApp } from "#app";
import useProject from "~/composables/useProject";

const formatData = (list: Array<Record<string, any>>) => list.map(row => ({
  row: { ...row },
  oldRow: { ...row },
  rowMeta: {}
}));

export default  (meta: Ref<TableType> | ComputedRef<TableType> | undefined) => {
  const data = ref<Array<Record<string, any>>>();
  const formattedData = ref<Array<{ row: Record<string, any>; oldRow: Record<string, any> }>>();
  const paginationData = ref<PaginatedType>();

  const { project } = useProject();
  const { $api } = useNuxtApp();

  const loadData = async (params: Parameters<Api<any>["dbTableRow"]["list"]>[3] = {}) => {
    if(!project?.value?.id || !meta?.value?.id) return
    const response = await $api.dbTableRow.list(
      "noco",
      project.value.id,
      meta.value.id,
      params
    );
    data.value = response.list;
    formattedData.value = formatData(response.list);
  };

  return { data, loadData, paginationData, formattedData };
};

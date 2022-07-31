import {ColumnType, LinkToAnotherRecordType, TableType} from "nocodb-sdk";
import {Ref} from "vue";

export default (column: Ref<ColumnType>) =>{

  const {$api} = useNuxtApp()
  const {metas,getMeta} = useMetas()

  const colOptions = computed<LinkToAnotherRecordType>(() => column.value.colOptions as LinkToAnotherRecordType)
  const relatedTableMeta = computed<TableType>(() => colOptions?.value && metas.value?.[colOptions.value?.fk_related_model_id as string])

  const removeChild = () => {
    // todo: audit
    // await this.$api.dbTableRow.nestedRemove(
    //   'noco',
    //   this.projectName,
    //   this.meta.title,
    //   id,
    //   'bt',
    //   this.column.title,
    //   parent[this.parentPrimaryKey]
    // );
  }

  const addChild = () => {
    // await this.$api.dbTableRow.nestedAdd('noco', this.projectName, this.meta.title, id, 'bt', this.column.title, pid);
  }

 const loadRelatedTableMeta= async ()=>{
   return getMeta(colOptions.value?.fk_related_model_id as string)
 }


  // this.data = await this.$api.dbTableRow.nestedChildrenExcludedList(
  //   'noco',
  //   this.projectName,
  //   this.parentMeta.title,
  //   this.rowId,
  //   this.column.colOptions.type,
  //   this.column.title,
  //   {
  //     limit: this.size,
  //     offset: this.size * (this.page - 1),
  //     where: this.query && `(${this.primaryCol},like,${this.query})`,
  //   }
  // );


  //   this.data = await this.$api.dbTableRow.nestedList(
  //           'noco',
  //           this.projectName,
  //           this.parentMeta.title,
  //           this.rowId,
  //           this.column.colOptions.type,
  //           this.column.title,
  //           {
  //             limit: this.size,
  //             offset: this.size * (this.page - 1),
  //           }
  //         );

  return  {addChild, removeChild, loadRelatedTableMeta, relatedTableMeta}
}

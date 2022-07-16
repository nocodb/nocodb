import {useNuxtApp} from "#app";
import {Api, TableType} from "nocodb-sdk";
import {useUser} from "~/composables/user";

export const useProject = () => {
  const {$api} = useNuxtApp()
  const {user} = useUser()

  const project = useState<{ id?: string, title?: string }>('project', null)
  const tables = useState<Array<TableType>>('tables', null)

  const loadTables = async () => {
    const tablesResponse = await $api.dbTable.list(project?.value?.id, {}, {
      headers: {
        'xc-auth': user.token
      }
    })

    console.log(tablesResponse)
    tables.value = tablesResponse.list
  }

  const loadProject = async (projectId:string) => {
    const projectResponse = await $api.project.read(projectId, {
      headers: {
        'xc-auth': user.token
      }
    })

    console.log(projectResponse)
    project.value = projectResponse
  }


  return {project, tables, loadProject, loadTables}
}

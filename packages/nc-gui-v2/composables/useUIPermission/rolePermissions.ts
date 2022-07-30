const permissions: Record<string, Record<string, boolean> | '*'> = {
  creator: '*',
  owner: '*',
  guest: {},
  editor: {
    smartSheet: true,
    xcDatatableEditable: true,
    column: true,
    tableAttachment: true,
    tableRowUpdate: true,
    rowComments: true,
    gridViewOptions: true,
    sortSync: true,
    fieldsSync: true,
    gridColUpdate: true,
    filterSync: true,
    csvImport: true,
    apiDocs: true,
    projectSettings: true,
  },
  commenter: {
    smartSheet: true,
    column: true,
    rowComments: true,
    projectSettings: true,
  },
  viewer: {
    smartSheet: true,
    column: true,
    projectSettings: true,
  },
  user: {
    projectCreate: true,
    projectActions: true,
    projectSettings: true,
  },
}

export default permissions

export const csvExportResponseHeader = {
  'nc-export-offset': {
    schema: {
      type: 'integer',
    },
    description:
      'Offset of next set of data which will be helpful if there is large amount of data. It will returns `-1` if all set of data exported.',
    example: '1000',
  },
};

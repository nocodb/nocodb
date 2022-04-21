export default (ctx: {
  tableName: string;
  orgs: string;
  projectName: string;
  columns: Array<{ type: string; title: string; description?: string }>;
}) => ({
  User: {
    title: 'User',
    type: 'object',
    description: '',
    examples: [
      {
        id: 142,
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice.smith@gmail.com',
        dateOfBirth: '1997-10-31',
        emailVerified: true,
        signUpDate: '2019-08-24'
      }
    ],
    'x-internal': false,
    properties: {
      ...(ctx.columns?.reduce(
        (colsObj, column) => ({
          ...colsObj,
          [column.title]: {
            type: column.type,
            description: column.description
          }
        }),
        {}
      ) || {})
    },
    required: ['id', 'firstname', 'lastname', 'email', 'email_verified']
  }
});

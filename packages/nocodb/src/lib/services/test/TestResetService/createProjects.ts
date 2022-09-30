import axios from 'axios';

const extPgProject = {
  title: 'pgExtREST',
  bases: [
    {
      type: 'pg',
      config: {
        client: 'pg',
        connection: {
          host: 'localhost',
          port: '5432',
          user: 'postgres',
          password: 'password',
          database: 'postgres',
        },
        searchPath: ['public'],
      },
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    },
  ],
  external: true,
};

const extMysqlProject = {
  title: 'externalREST',
  bases: [
    {
      type: 'mysql2',
      config: {
        client: 'mysql2',
        connection: {
          host: 'localhost',
          port: '3306',
          user: 'root',
          password: 'password',
          database: 'test_sakila',
        },
      },
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    },
  ],
  external: true,
};

const createProjects = async (token) => {
  return await Promise.all(
    [extPgProject, extMysqlProject].map(async (projectAttr) => {
      const response = await axios.post(
        'http://localhost:8080/api/v1/db/meta/projects/',
        projectAttr,
        {
          headers: {
            'xc-auth': token,
          },
        }
      );
      return response.data;
    })
  );
};

export default createProjects;

/* eslint-disable  */
/**
 *
 *
 * @export
 * @param {*} data - json object from config.xc.json
 * @returns {*} projects - vuetify treeview object
 */
export default function (data) {
  // data is projects array from sqlite with xmigarator.json file data as project.data
  const projects = [];
  for (let i = 0; i < data.length; i++) {
    const el = data[i];
    const uniqKey = `${i}`;
    const json = {
      type: "project",
      name: el.projectJson.title + " (Project)",
      key: uniqKey,
      active: true,
      children: envParser(el.projectJson.envs, uniqKey, el.projectJson),
      _nodes: {key: uniqKey, type: "project"}
    };
    projects.push(json);
  }

  // console.log(projects);

  return projects;
}

function envParser(data, projectKey, projectJson) {
  const envDirUniqKey = projectKey + ".projectJson.envs";
  const envs = [
    {
      type: "envDir",
      name: "environments",
      key: envDirUniqKey,
      children: [],
      _nodes: {key: envDirUniqKey, type: "envDir", projectKey: projectKey}
    }
  ];
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const env = data[key];
      const envKey = `${projectKey}.projectJson.envs.${key}.db`;
      const json = {
        type: "env",
        name: `${key} (${projectJson.workingEnv === key ? 'Active Env' : 'Env'})`,
        key: envKey,
        children: dbparser(env.db, envKey, key),
        _nodes: {key: envKey, type: "env", env: key, envDirKey: envDirUniqKey},
        active: key === projectJson.workingEnv
      };
      envs[0].children.push(json);
    }
  }

  return envs[0].children;
}

function dbparser(data, envKey, env) {
  const dbs = [];
  for (let i = 0; i < data.length; i++) {
    const db = data[i];
    const dbKey = `${envKey}.${i}`;

    let json = {};
    json = {
      type: "db",
      name: `${db.connection.database} (${db.meta.dbAlias})`,
      key: dbKey,
      dbConnection: db,
      children: [],
      _nodes: {
        key: dbKey,
        type: "db",
        env,
        dbAlias: db.meta.dbAlias,
        envKey: envKey,
        dbConnection: db
      }
    };

    json.children.push(tableParser(db.tables, dbKey, env, db.meta.dbAlias, db));
    // enable extra
    // json.children.push(viewsParser(db.views, dbKey, env, db.meta.dbAlias, db));

    // if (db.client !== 'sqlite3')
    //   json.children.push(functionsParser(db.functions, dbKey, env, db.meta.dbAlias, db));
    //
    // if (db.client === 'pg' || db.client === 'oracledb') {
    //
    //   json.children.push(sequencesParser(db.sequences, dbKey, env, db.meta.dbAlias, db));
    // } else if (db.client === 'mssql') {
    //
    //   json.children.push(procedureParser(db.procedures, dbKey, env, db.meta.dbAlias, db));
    //   json.children.push(sequencesParser(db.sequences, dbKey, env, db.meta.dbAlias, db));
    // } else if (db.client === 'sqlite3') {
    //
    // } else {
    //   json.children.push(procedureParser(db.procedures, dbKey, env, db.meta.dbAlias, db));
    // }

    // json.children.push(migrationsParser([], dbKey, env, db.meta.dbAlias, db));
    json.children.push(sqlClientParser([], dbKey, env, db.meta.dbAlias, db));
    dbs.push(json);
  }

  return dbs;
}

function migrationsParser(data = [], dbKey, env, dbAlias, dbConnection) {
  const tableDirKey = dbKey + ".migrations";
  const tables = {
    type: "migrationsDir",
    name: data.length ? `Audit (${data.length})` : `Audit`,
    key: tableDirKey,
    children: [],
    tooltip: data[0] ? "" : "Click for Migrations",
    _nodes: {
      key: tableDirKey,
      type: "migrationsDir",
      env,
      dbAlias,
      dbKey: dbKey,
      dbConnection
    }
  };
  for (let i = 0; i < data.length; i++) {
    const table = data[i];
    const tableKey = `${tableDirKey}.${i}`;
    const json = {
      type: "table",
      name: table.title,
      key: tableDirKey + "." + i,
      children: [],
      _nodes: {
        key: tableKey,
        type: "table",
        env,
        dbAlias,
        tableDirKey: tableDirKey,
        table_name: table.table_name,
        title: table.title,
        dbConnection
      }
    };
    tables.children.push(json);
  }

  return tables;
}

function apisParser(data = [], dbKey, env, dbAlias, dbConnection) {
  const tableDirKey = dbKey + ".apis";
  const tables = {
    type: "apisDir",
    name: data.length ? `API Server (${data.length})` : `API Server`,
    key: tableDirKey,
    children: [],
    tooltip: data[0] ? "" : "API server",
    _nodes: {
      key: tableDirKey,
      type: "apisDir",
      env,
      dbAlias,
      dbKey: dbKey,
      dbConnection
    }
  };
  for (let i = 0; i < data.length; i++) {
    const table = data[i];
    const tableKey = `${tableDirKey}.${i}`;
    const json = {
      type: "table",
      name: table.table_name,
      key: tableDirKey + "." + i,
      children: [],
      _nodes: {
        key: tableKey,
        type: "table",
        env,
        dbAlias,
        tableDirKey: tableDirKey,
        table_name: table.table_name,
        title: table.title,
        dbConnection
      }
    };
    tables.children.push(json);
  }

  return tables;
}

function sqlClientParser(data = [], dbKey, env, dbAlias, dbConnection) {
  const tableDirKey = dbKey + ".sqlClient";
  const tables = {
    type: "sqlClientDir",
    name: data.length ? `SQL Client(${data.length})` : `SQL Client`,
    key: tableDirKey,
    children: [],
    tooltip: data[0] ? "" : "SQL Client",
    _nodes: {
      key: tableDirKey,
      type: "sqlClientDir",
      env,
      dbAlias,
      dbKey: dbKey,
      dbConnection
    }
  };
  for (let i = 0; i < data.length; i++) {
    const table = data[i];
    const tableKey = `${tableDirKey}.${i}`;
    const json = {
      type: "table",
      name: table.title,
      key: tableDirKey + "." + i,
      children: [],
      _nodes: {
        key: tableKey,
        type: "table",
        env,
        dbAlias,
        tableDirKey: tableDirKey,
        table_name: table.table_name,
        title: table.title,
        dbConnection
      }
    };
    tables.children.push(json);
  }

  return tables;
}

function apiClientParser(data = [], dbKey, env, dbAlias, dbConnection) {
  const tableDirKey = dbKey + ".apiClient";
  const tables = {
    type: "apiClientDir",
    name: data.length ? `Api Client(${data.length})` : `API Client`,
    key: tableDirKey,
    children: [],
    tooltip: data[0] ? "" : "Rest API Client",
    _nodes: {
      key: tableDirKey,
      type: "apiClientDir",
      env,
      dbAlias,
      dbKey: dbKey,
      dbConnection
    }
  };
  for (let i = 0; i < data.length; i++) {
    const table = data[i];
    const tableKey = `${tableDirKey}.${i}`;
    const json = {
      type: "table",
      name: table.title,
      key: tableDirKey + "." + i,
      children: [],
      _nodes: {
        key: tableKey,
        type: "table",
        env,
        dbAlias,
        tableDirKey: tableDirKey,
        title: table.title,
        dbConnection
      }
    };
    tables.children.push(json);
  }

  return tables;
}

function seedParser(data = [], dbKey, env, dbAlias, dbConnection) {
  const tableDirKey = dbKey + ".seedParser";
  const seeds = {
    type: "apiClientDir",
    name: data.length ? `Seed DB(${data.length})` : `Seed DB`,
    key: tableDirKey,
    children: [],
    tooltip: data[0] ? "" : "Seed Database",
    _nodes: {
      key: tableDirKey,
      type: "seedParserDir",
      env,
      dbAlias,
      dbKey: dbKey,
      dbConnection
    }
  };
  // for (let i = 0; i < data.length; i++) {
  //   const table = data[i];
  //   const tableKey = `${tableDirKey}.${i}`;
  //   const json = {
  //     type: "table",
  //     name: table.table_name,
  //     key: tableDirKey + "." + i,
  //     children: [],
  //     _nodes: {
  //       key: tableKey,
  //       type: "table",
  //       env,
  //       dbAlias,
  //       tableDirKey: tableDirKey,
  //       table_name: table.table_name
  //     }
  //   };
  //   tables.children.push(json);
  // }

  return seeds;
}


function tableParser(data = [], dbKey, env, dbAlias, dbConnection) {
  const tableDirKey = dbKey + ".tables";
  const tables = {
    type: "tableDir",
    name: data.length ? `Tables (${data.length})` : `Tables`,
    key: tableDirKey,
    children: [],
    tooltip: data[0] ? "" : "Click to Load All Tables",
    _nodes: {
      key: tableDirKey,
      type: "tableDir",
      env,
      dbAlias,
      dbKey: dbKey,
      dbConnection
    }
  };
  for (let i = 0; i < data.length; i++) {
    const table = data[i];
    const tableKey = `${tableDirKey}.${i}`;
    let json;
    json= {
      type: table.type || 'table',
      name: table.title,
      table_name: table.table_name,
      id: table.id,
      title: table.title || table.table_name,
      order: table.order,
      key: tableDirKey + "." + i,
      children: [],
      _nodes: {
        key: tableKey,
        type: table.type,
        env,
        dbAlias,
        tableDirKey: tableDirKey,
        table_name: table.table_name,
        title: table.title,
        dbConnection
      }
    };
    tables.children.push(json);
  }



  return tables;
}

function viewsParser(data = [], dbKey, env, dbAlias, dbConnection) {
  const viewDirKey = dbKey + ".views";
  const views = {
    type: "viewDir",
    name: data.length ? `Views (${data.length})` : `Views`,
    key: viewDirKey,
    children: [],
    tooltip: data[0] ? "" : "Click to Load All Views",
    _nodes: {
      key: viewDirKey,
      type: "viewDir",
      dbAlias,
      env,
      dbKey: dbKey,
      dbConnection
    }
  };
  for (let i = 0; i < data.length; i++) {
    const view = data[i];
    const viewKey = `${viewDirKey}.${i}`;
    const json = {
      type: "view",
      table_name: view.table_name || view.view_name,
      title: view.title,
      id: view.id,
      name: view.title || view.view_name,
      key: viewDirKey + "." + i,
      children: [],
      _nodes: {
        type: "view",
        key: viewKey,
        dbAlias,
        env,
        view_name: view.view_name,
        title: view.title,
        viewDirKey: viewDirKey,
        dbConnection
      },
      creator_tooltip: `SQL View name : '${view.view_name}'`
    };
    views.children.push(json);
  }
  return views;
}

function functionsParser(data = [], dbKey, env, dbAlias, dbConnection) {
  const functionDirKey = dbKey + ".functions";
  const functions = {
    type: "functionDir",
    name: data.length ? `Functions (${data.length})` : `Functions`,
    key: functionDirKey,
    children: [],
    tooltip: data[0] ? "" : "Click to Load All Functions",
    _nodes: {
      type: "functionDir",
      key: functionDirKey,
      dbAlias,
      env,
      dbKey: dbKey,
      dbConnection
    }
  };
  for (let i = 0; i < data.length; i++) {
    const _function = data[i];
    const functionKey = `${functionDirKey}.${i}`;
    const json = {
      type: "function",
      name: _function.function_name,
      key: functionDirKey + "." + i,
      children: [],
      _nodes: {
        key: functionKey,
        type: "function",
        dbAlias,
        env,
        function_name: _function.function_name,
        functionDirKey: functionDirKey,
        dbConnection
      }
    };
    functions.children.push(json);
  }
  return functions;
}

function procedureParser(data = [], dbKey, env, dbAlias, dbConnection) {
  const procedureDirKey = dbKey + ".procedures";
  const procedures = {
    type: "procedureDir",
    name: data.length ? `Procedures (${data.length})` : `Procedures`,
    key: procedureDirKey,
    children: [],
    tooltip: data[0] ? "" : "Click to Load All Procedures",
    _nodes: {
      key: procedureDirKey,
      type: "procedureDir",
      dbAlias,
      env,
      dbKey: dbKey,
      dbConnection
    }
  };
  for (let i = 0; i < data.length; i++) {
    const procedure = data[i];
    const procedureKey = `${procedureDirKey}.${i}`;
    const json = {
      type: "procedure",
      name: procedure.procedure_name,
      key: procedureDirKey + "." + i,
      children: [],
      _nodes: {
        key: procedureKey,
        type: "procedure",
        dbAlias,
        env,
        procedure_name: procedure.procedure_name,
        procedureDirKey: procedureDirKey,
        dbConnection
      }
    };
    procedures.children.push(json);
  }
  return procedures;
}

function sequencesParser(data = [], dbKey, env, dbAlias, dbConnection) {
  const sequenceDirKey = dbKey + ".sequences";
  const sequences = {
    type: "sequenceDir",
    name: data.length ? `Sequences (${data.length})` : `Sequences`,
    key: sequenceDirKey,
    children: [],
    tooltip: data[0] ? "" : "Click to Load All Sequences",
    _nodes: {
      key: sequenceDirKey,
      type: "sequenceDir",
      dbAlias,
      env,
      dbKey: dbKey,
      dbConnection
    }
  };
  for (let i = 0; i < data.length; i++) {
    const sequence = data[i];
    const sequenceKey = `${sequenceDirKey}.${i}`;
    const json = {
      type: "sequence",
      name: sequence.sequence_name,
      key: sequenceDirKey + "." + i,
      children: [],
      _nodes: {
        key: sequenceKey,
        type: "sequence",
        dbAlias,
        env,
        sequence_name: sequence.sequence_name,
        sequenceDirKey: sequenceDirKey,
        dbConnection
      }
    };
    sequences.children.push(json);
  }
  return sequences;
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

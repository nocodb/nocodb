import {XKnex} from "../../index";

const pg = {
  LEN: 'length'
}

const mssql = {
  LEN: 'LEN'
}

const mysql2 = {
  LEN: 'CHAR_LENGTH'
}


const sqlite3 = {
  LEN: 'LENGTH'
}


const getFunctionName = (name, knex: XKnex) => {

  switch (knex.clientType()) {

    case 'mysql':
    case 'mysql2':
      return mysql2[name] || name;
      break;
    case 'pg':
    case 'postgre':
      return pg[name] || name;
      break;
    case 'mssql':
      return mssql[name] || name;
      break;
    case 'sqlite':
    case 'sqlite3':
      return sqlite3[name] || name;
      break;
  }
}


export default getFunctionName;
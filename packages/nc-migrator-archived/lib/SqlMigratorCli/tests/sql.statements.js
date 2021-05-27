module.exports = {
  mysql: {
    user: {
      up: `CREATE TABLE \`user\` (\n    \`id\` INT NOT NULL AUTO_INCREMENT,\n    \`title\` VARCHAR(45) NULL,\n    PRIMARY KEY (\`id\`)\n);`,
      down: "drop table user;"
    },

    blog: {
      up:
        "CREATE TABLE `blog` (\n    `id` INT NOT NULL AUTO_INCREMENT,\n    `title` VARCHAR(45) NULL,\n    PRIMARY KEY (`id`)\n);",
      down: "drop table blog;"
    }
  },

  pg: {
    user: {
      up: `CREATE TABLE "user" (
  user_id serial PRIMARY KEY,
  username VARCHAR (50) UNIQUE NOT NULL,
  password VARCHAR (50) NOT NULL,
  email VARCHAR (355) UNIQUE NOT NULL,
  created_on TIMESTAMP NOT NULL,
  last_login TIMESTAMP
 );`,
      down: `DROP TABLE "user";`
    },

    blog: {
      up: `CREATE TABLE "blog" (
  user_id serial PRIMARY KEY,
  username VARCHAR (50) UNIQUE NOT NULL,
  password VARCHAR (50) NOT NULL,
  email VARCHAR (355) UNIQUE NOT NULL,
  created_on TIMESTAMP NOT NULL,
  last_login TIMESTAMP
 );`,
      down: `DROP TABLE "blog";`
    }
  },

  mssql: {
    user: {
      up:
        'CREATE TABLE "user" (\n  user_id INT PRIMARY KEY,\n  last_name VARCHAR(50) NOT NULL,\n  first_name VARCHAR(50),\n );',
      down: 'DROP TABLE "user";'
    },

    blog: {
      up:
        'CREATE TABLE "blog" (\n  blog_id INT PRIMARY KEY,\n  blog_content VARCHAR(50) NOT NULL,\n );',
      down: 'drop table "blog";'
    }
  },
  // INFO: semicolon is require at the end
  oracledb: {
    user: {
      up:
        'CREATE TABLE "user"\n( user_id number(10) NOT NULL,\n  user_name varchar2(50) NOT NULL\n);',
      down: 'DROP TABLE "user";'
    },

    blog: {
      up:
        'CREATE TABLE "blog"\n( blog_id number(10) NOT NULL,\n  blog_name varchar2(50) NOT NULL\n);',
      down: 'DROP TABLE "blog";'
    }
  },

  sqlite3: {
    user: {
      up:
        "CREATE TABLE user (\n id INTEGER PRIMARY KEY,\n first_name TEXT NOT NULL\n)",
      down: "drop table user"
    },

    blog: {
      up: "CREATE TABLE blog (\n id INTEGER PRIMARY KEY\n)",
      down: "drop table blog"
    }
  }
};
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

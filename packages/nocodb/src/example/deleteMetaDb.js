const date = new Date()
const metaDb = `meta_v2_${date.getFullYear()}_${(date.getMonth() + 1)
  .toString()
  .padStart(2, '0')}_${date
  .getDate()
  .toString()
  .padStart(2, '0')}`
require('knex')({
  client: 'mysql2',
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: metaDb
  }
})
  .raw(`DROP DATABASE ??`, metaDb)
  .then(res => console.log(res))
  .catch(e => console.log(e))
  .finally(()=> process.exit(0))

module.exports = {
  tn: 'city',
  columns: [{
     column_name:'city_id',
      type: 'integer',
      dt: 'smallint',
      rqd: true,
      un: true,
      pk: true,
      ai: true,
      validate: {
        func: [],
        args: [],
        msg: []
      },
    },
    {
     column_name:'city',
      type: 'string',
      dt: 'varchar',
      rqd: true,
      validate: {
        func: [],
        args: [],
        msg: []
      },
    },
    {
     column_name:'country_id',
      type: 'integer',
      dt: 'smallint',
      rqd: true,
      un: true,
      validate: {
        func: [],
        args: [],
        msg: []
      },
    },
    {
     column_name:'last_update',
      type: 'timestamp',
      dt: 'timestamp',
      rqd: true,
      default: "CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP",
      validate: {
        func: [],
        args: [],
        msg: []
      },
    },
  ],
  pks: [],
  hasMany: [{
    "cstn": "fk_address_city",
    "tn": "address",
    "cn": "city_id",
    "puc": 1,
    "rtn": "city",
    "rcn": "city_id",
    "mo": "NONE",
    "UR": "CASCADE",
    "dr": "RESTRICT",
    "ts": "sakila"
  }],
  belongsTo: [{
    "cstn": "fk_city_country",
    "tn": "city",
    "cn": "country_id",
    "puc": 1,
    "rtn": "country",
    "rcn": "country_id",
    "mo": "NONE",
    "UR": "CASCADE",
    "dr": "RESTRICT",
    "ts": "sakila"
  }]
}

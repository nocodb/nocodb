module.exports = {
  tn: 'country',
  columns: [{
      cn: 'country_id',
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
      cn: 'country',
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
      cn: 'last_update',
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
  }],
  belongsTo: []
}
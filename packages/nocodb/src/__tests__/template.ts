export default {
  name: 'Project name',
  tables: [
    {
      tn: 'blog',
      columns: [
        {
          cn: 'title',
          uidt: 'SingleLineText'
        },
        {
          cn: 'body',
          uidt: 'LongText'
        }
      ],
      hasMany: [
        {
          tn: 'comment'
        }
      ],
      manyToMany: [
        {
          rtn: 'tag'
        }
      ]
    },
    {
      tn: 'comment',
      columns: [
        {
          cn: 'body',
          uidt: 'LongText'
        }
      ]
    },
    {
      tn: 'tag',
      columns: [
        {
          cn: 'title',
          uidt: 'SingleLineText'
        }
      ]
    }
  ]
};

export const blog = {
  tn: 'blog',
  _tn: 'blog',
  columns: [
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'id',
      _cn: 'Id',
      type: 'integer',
      dt: 'int',
      uidt: 'ID',
      uip: '',
      uicn: '',
      dtx: 'integer',
      ct: 'int(11)',
      nrqd: false,
      rqd: true,
      ck: false,
      pk: true,
      un: true,
      ai: true,
      cdf: null,
      clen: null,
      np: 11,
      ns: 0,
      dtxp: '11',
      dtxs: '',
      tn: 'blog'
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'title',
      _cn: 'Title',
      type: 'string',
      dt: 'varchar',
      uidt: 'SingleLineText',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'varchar(45)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: null,
      clen: 45,
      np: null,
      ns: null,
      dtxp: '45',
      dtxs: '',
      pv: true,
      alias: 'Title'
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'created_at',
      _cn: 'CreatedAt',
      type: 'timestamp',
      dt: 'timestamp',
      uidt: 'CreateTime',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'varchar(45)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: 'CURRENT_TIMESTAMP',
      clen: 45,
      np: null,
      ns: null,
      dtxp: '',
      dtxs: '',
      default: 'CURRENT_TIMESTAMP',
      columnDefault: 'CURRENT_TIMESTAMP'
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'updated_at',
      _cn: 'UpdatedAt',
      type: 'timestamp',
      dt: 'timestamp',
      uidt: 'LastModifiedTime',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'varchar(45)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP',
      clen: 45,
      np: null,
      ns: null,
      dtxp: '',
      dtxs: '',
      default: 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP',
      columnDefault: 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP'
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'body',
      _cn: 'body',
      type: 'text',
      dt: 'text',
      uidt: 'LongText',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'integer(11)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: null,
      clen: 45,
      np: null,
      ns: null,
      dtxp: '',
      dtxs: ' ',
      cno: 'title5',
      tn: 'blog',
      alias: 'body'
    }
  ],
  pks: [],
  hasMany: [
    {
      id: 3,
      project_id: 'worrying_sloth_jum4',
      db_alias: 'db',
      tn: '_nc_m2m_tag_blog',
      rtn: 'blog',
      _tn: 'm2mtag_blog',
      _rtn: 'blog',
      cn: 'blog_c_id',
      rcn: 'id',
      _cn: null,
      _rcn: null,
      referenced_db_alias: null,
      type: 'real',
      db_type: 'mysql2',
      ur: 'NO ACTION',
      dr: 'NO ACTION',
      created_at: '2021-10-29 07:28:12',
      updated_at: '2021-10-29 07:28:12',
      fkn: 'tag_blo_Dneo90_c_fk',
      enabled: true
    },
    {
      id: 1,
      project_id: 'worrying_sloth_jum4',
      db_alias: 'db',
      tn: 'comment',
      rtn: 'blog',
      _tn: 'comment',
      _rtn: 'blog',
      cn: 'title5',
      rcn: 'id',
      _cn: null,
      _rcn: null,
      referenced_db_alias: null,
      type: 'real',
      db_type: 'mysql2',
      ur: 'NO ACTION',
      dr: 'NO ACTION',
      created_at: '2021-10-29 07:27:54',
      updated_at: '2021-10-29 07:27:54',
      fkn: null,
      enabled: true
    }
  ],
  belongsTo: [],
  type: 'table',
  v: [
    {
      hm: {
        id: 1,
        project_id: 'worrying_sloth_jum4',
        db_alias: 'db',
        tn: 'comment',
        rtn: 'blog',
        _tn: 'comment',
        _rtn: 'blog',
        cn: 'title5',
        rcn: 'id',
        _cn: null,
        _rcn: null,
        referenced_db_alias: null,
        type: 'real',
        db_type: 'mysql2',
        ur: 'NO ACTION',
        dr: 'NO ACTION',
        created_at: '2021-10-29 07:27:54',
        updated_at: '2021-10-29 07:27:54',
        fkn: null,
        enabled: true
      },
      _cn: 'blog => comment'
    },
    {
      mm: {
        tn: 'blog',
        cn: 'id',
        vtn: '_nc_m2m_tag_blog',
        vcn: 'blog_c_id',
        vrcn: 'tag_p_id',
        rtn: 'tag',
        rcn: 'id',
        _tn: 'blog',
        _cn: null,
        _rtn: 'tag',
        _rcn: null
      },
      _cn: 'blog <=> tag'
    }
  ],
  manyToMany: [
    {
      tn: 'blog',
      cn: 'id',
      vtn: '_nc_m2m_tag_blog',
      vcn: 'blog_c_id',
      vrcn: 'tag_p_id',
      rtn: 'tag',
      rcn: 'id',
      _tn: 'blog',
      _cn: null,
      _rtn: 'tag',
      _rcn: null
    }
  ]
};

export const comment = {
  tn: 'comment',
  _tn: 'comment',
  columns: [
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'id',
      _cn: 'Id',
      type: 'integer',
      dt: 'int',
      uidt: 'ID',
      uip: '',
      uicn: '',
      dtx: 'integer',
      ct: 'int(11)',
      nrqd: false,
      rqd: true,
      ck: false,
      pk: true,
      un: true,
      ai: true,
      cdf: null,
      clen: null,
      np: 11,
      ns: 0,
      dtxp: '11',
      dtxs: '',
      tn: 'comment'
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'created_at',
      _cn: 'CreatedAt',
      type: 'timestamp',
      dt: 'timestamp',
      uidt: 'CreateTime',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'varchar(45)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: 'CURRENT_TIMESTAMP',
      clen: 45,
      np: null,
      ns: null,
      dtxp: '',
      dtxs: '',
      default: 'CURRENT_TIMESTAMP',
      columnDefault: 'CURRENT_TIMESTAMP',
      pv: true
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'updated_at',
      _cn: 'UpdatedAt',
      type: 'timestamp',
      dt: 'timestamp',
      uidt: 'LastModifiedTime',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'varchar(45)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP',
      clen: 45,
      np: null,
      ns: null,
      dtxp: '',
      dtxs: '',
      default: 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP',
      columnDefault: 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP'
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'body',
      _cn: 'body',
      type: 'text',
      dt: 'text',
      uidt: 'LongText',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'integer(11)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: null,
      clen: 45,
      np: null,
      ns: null,
      dtxp: '',
      dtxs: ' ',
      cno: 'title4',
      tn: 'comment',
      alias: 'body'
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'title5',
      _cn: 'title5',
      type: 'integer',
      dt: 'int',
      uidt: 'ForeignKey',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'integer(11)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: true,
      ai: false,
      cdf: null,
      clen: 45,
      np: null,
      ns: null,
      dtxp: '11',
      dtxs: '',
      cno: 'title5',
      tn: 'comment'
    }
  ],
  pks: [],
  hasMany: [],
  belongsTo: [
    {
      id: 1,
      project_id: 'worrying_sloth_jum4',
      db_alias: 'db',
      tn: 'comment',
      rtn: 'blog',
      _tn: 'comment',
      _rtn: 'blog',
      cn: 'title5',
      rcn: 'id',
      _cn: null,
      _rcn: null,
      referenced_db_alias: null,
      type: 'real',
      db_type: 'mysql2',
      ur: 'NO ACTION',
      dr: 'NO ACTION',
      created_at: '2021-10-29 07:27:54',
      updated_at: '2021-10-29 07:27:54',
      fkn: null,
      enabled: true
    }
  ],
  type: 'table',
  v: [
    {
      bt: {
        id: 1,
        project_id: 'worrying_sloth_jum4',
        db_alias: 'db',
        tn: 'comment',
        rtn: 'blog',
        _tn: 'comment',
        _rtn: 'blog',
        cn: 'title5',
        rcn: 'id',
        _cn: null,
        _rcn: null,
        referenced_db_alias: null,
        type: 'real',
        db_type: 'mysql2',
        ur: 'NO ACTION',
        dr: 'NO ACTION',
        created_at: '2021-10-29 07:27:54',
        updated_at: '2021-10-29 07:27:54',
        fkn: null,
        enabled: true
      },
      _cn: 'blog <= comment'
    }
  ]
};

export const tag = {
  tn: 'tag',
  _tn: 'tag',
  columns: [
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'id',
      _cn: 'Id',
      type: 'integer',
      dt: 'int',
      uidt: 'ID',
      uip: '',
      uicn: '',
      dtx: 'integer',
      ct: 'int(11)',
      nrqd: false,
      rqd: true,
      ck: false,
      pk: true,
      un: true,
      ai: true,
      cdf: null,
      clen: null,
      np: 11,
      ns: 0,
      dtxp: '11',
      dtxs: ''
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'title',
      _cn: 'Title',
      type: 'string',
      dt: 'varchar',
      uidt: 'SingleLineText',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'varchar(45)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: null,
      clen: 45,
      np: null,
      ns: null,
      dtxp: '45',
      dtxs: '',
      pv: true,
      alias: 'Title'
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'created_at',
      _cn: 'CreatedAt',
      type: 'timestamp',
      dt: 'timestamp',
      uidt: 'CreateTime',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'varchar(45)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: 'CURRENT_TIMESTAMP',
      clen: 45,
      np: null,
      ns: null,
      dtxp: '',
      dtxs: '',
      default: 'CURRENT_TIMESTAMP',
      columnDefault: 'CURRENT_TIMESTAMP'
    },
    {
      validate: {
        func: [],
        args: [],
        msg: []
      },
      cn: 'updated_at',
      _cn: 'UpdatedAt',
      type: 'timestamp',
      dt: 'timestamp',
      uidt: 'LastModifiedTime',
      uip: '',
      uicn: '',
      dtx: 'specificType',
      ct: 'varchar(45)',
      nrqd: true,
      rqd: false,
      ck: false,
      pk: false,
      un: false,
      ai: false,
      cdf: 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP',
      clen: 45,
      np: null,
      ns: null,
      dtxp: '',
      dtxs: '',
      default: 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP',
      columnDefault: 'CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP'
    }
  ],
  pks: [],
  hasMany: [
    {
      id: 2,
      project_id: 'worrying_sloth_jum4',
      db_alias: 'db',
      tn: '_nc_m2m_tag_blog',
      rtn: 'tag',
      _tn: 'm2mtag_blog',
      _rtn: 'tag',
      cn: 'tag_p_id',
      rcn: 'id',
      _cn: null,
      _rcn: null,
      referenced_db_alias: null,
      type: 'real',
      db_type: 'mysql2',
      ur: 'NO ACTION',
      dr: 'NO ACTION',
      created_at: '2021-10-29 07:28:11',
      updated_at: '2021-10-29 07:28:11',
      fkn: 'tag_blo_rKb7Gq_p_fk',
      enabled: true
    }
  ],
  belongsTo: [],
  type: 'table',
  v: [
    {
      mm: {
        tn: 'tag',
        cn: 'id',
        vtn: '_nc_m2m_tag_blog',
        vcn: 'tag_p_id',
        vrcn: 'blog_c_id',
        rtn: 'blog',
        rcn: 'id',
        _tn: 'tag',
        _cn: null,
        _rtn: 'blog',
        _rcn: null
      },
      _cn: 'tag <=> blog'
    }
  ],
  manyToMany: [
    {
      tn: 'tag',
      cn: 'id',
      vtn: '_nc_m2m_tag_blog',
      vcn: 'tag_p_id',
      vrcn: 'blog_c_id',
      rtn: 'blog',
      rcn: 'id',
      _tn: 'tag',
      _cn: null,
      _rtn: 'blog',
      _rcn: null
    }
  ]
};

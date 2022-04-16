const validations = {
  AVG: {
    validation: {
      args: { min: 1 }
    }
  },
  ADD: {
    validation: {
      args: { min: 1 }
    }
  },
  DATEADD: { validation: { args: { rqd: 3 } } },
  AND: {
    validation: {
      args: { min: 1 }
    }
  },
  OR: {
    validation: {
      args: { min: 1 }
    }
  },
  CONCAT: {
    validation: { args: { min: 1 } }
  },
  TRIM: {
    validation: { args: { min: 1 } }
  },
  UPPER: {
    validation: { args: { rqd: 1 } }
  },
  LOWER: { validation: { args: { rqd: 1 } } },
  LEN: { validation: { args: { rqd: 1 } } },
  MIN: { validation: { args: { min: 1 } } },
  MAX: { validation: { args: { min: 1 } } },
  CEILING: { validation: { args: { rqd: 1 } } },
  FLOOR: { validation: { args: { rqd: 1 } } },
  ROUND: { validation: { args: { rqd: 1 } } },
  MOD: { validation: { args: { rqd: 2 } } },
  REPEAT: { validation: { args: { rqd: 2 } } },
  LOG: { validation: {} },
  EXP: { validation: {} },
  POWER: { validation: { args: { rqd: 2 } } },
  SQRT: { validation: { args: { rqd: 1 } } },
  ABS: { validation: { args: { rqd: 1 } } },
  NOW: { validation: { args: { rqd: 0 } } },
  REPLACE: { validation: { args: { rqd: 3 } } },
  SEARCH: { validation: { args: { rqd: 2 } } },
  INT: { validation: { args: { rqd: 1 } } },
  RIGHT: { validation: { args: { rqd: 2 } } },
  LEFT: {
    validation: { args: { rqd: 1 } }
  },
  SUBSTR: { validation: { args: { min: 2, max: 3 } } },
  MID: { validation: { args: { rqd: 1 } } },
  IF: { validation: { args: { min: 2, max: 3 } } },
  SWITCH: { validation: { args: { min: 3 } } },
  URL: { validation: { args: { rqd: 1 } } }
}

export default Object.keys(validations)
export { validations }

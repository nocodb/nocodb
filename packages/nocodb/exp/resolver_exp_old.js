const delay = t => new Promise(res => setTimeout(() => res(), t))
const Dataloader = require('dataloader')
const time = 1000;
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    user: 'root',
    password: 'password',
    database: 'sakila'
  }
});




class Country {
  constructor(data) {
    Object.assign(this, data)
  }

  async cityList() {
    return (await knex('city').select('*').where({
      country_id: this.country_id
    }).limit(1)).map(c => new City(c))
  }

  async cityCount() {
    return (await knex('city').count('city_id as count').where({
      country_id: this.country_id
    }).first()).count
  }

}


class Address {
  constructor(data) {
    Object.assign(this, data)
  }

  async City() {
    return new City(await knex('city').select('*').where({
      city_id: this.city_id
    }).first())
  }


}

class City {
  constructor(data) {
    Object.assign(this, data)
  }

  async Country() {
    return new Country((await knex('country').select('*').where({
      country_id: this.country_id
    }).first()))
  }

    async addressList() {
      return (await knex('address').select('*').where({
        city_id: this.city_id
      })).map(c => new Address(c))
    }

  async addressCount() {
    return (await knex('address').count('city_id as count').where({
      city_id: this.city_id
    }).first()).count
  }


}


// const nestResolver = {
//   country: `INDIA`,
//   async cityCount() {
//     await delay(time)
//     return `12-${time}`
//   },
//   async cityList() {
//     await delay(time)
//     return {
//       city: `city 1-${time}`,
//       async addressCount() {
//         await delay(time)
//         return `2-${time}`
//       },
//     }
//   }
// };


const rootAst = {
  Country: {
    name: 'Country',
    type: 'Object',
    fields: {
      country_id: {
        name: 'country_id',
        type: 'number'
      }, country: {
        name: 'country',
        type: 'string'
      },

      cityList: {
        name: 'cityList',
        type: 'array',
        elementType: 'City',
        // nested: {
        //   level: 1, path: ['country_id']
        // }
      },
      cityCount: {
        name: 'cityCount',
        type: 'number',
        // nested: {
        //   level: 1, path: ['country_id']
        // }
      },


      addressCount: {
        name: 'addressCount',
        type: 'number',
        nested: {level: 2, path: ['cityList', 'addressCount']}
      },
      c: {
        name: 'addressCount',
        type: 'number',
        nested: {level: 2, path: ['cityList', 'addressList','address']}
      },
      d: {
        name: 'addressCount',
        type: 'number',
        nested: {level: 2, path: ['cityList', 'addressList','City', 'Country']}
      }
    }
  }, City: {
    name: 'City',
    type: 'Object',
    fields: {
      city_id: {
        name: 'city_id',
        type: 'number'
      }, country_id: {
        name: 'country_id',
        type: 'number'
      }, city: {
        name: 'city',
        type: 'string'
      }, addressList: {
        name: 'addressList',
        type: 'array',
        elementType: 'Address'
      }, countryRead: {
        name: 'countryRead',
        type: 'Country'
      }, addressCount: {
        name: 'addressCount',
        type: 'number'
      },
      Country: {
        name: 'Country',
        type: 'Country',
        // nested: {
        //   level: 1, path: ['country_id']
        // }
      },
    }
  }, Address: {
    name: 'Address',
    type: 'Object',
    fields: {
      address: {
        name: 'address',
        type: 'string'
      },
      City: {
        name: 'City',
        type: 'City',
        // nested: {
        //   level: 1,
        //   path: ['city_id']
        // }
      },
      Country: {
        name: 'Country',
        type: 'Country',
        nested: {
          level: 1,
          path: ['City', 'Country','country']
        }
      }
    }
  },
  CountryList: {
    type: 'array',
    elementType: 'Country'
  },
  AddressList: {
    type: 'array',
    elementType: 'Address'
  },
}


const nestResolver = {
  async Country() {
    return new Country(await knex('country').first())
  },

  async CountryList() {
    return (await knex('country').limit(2)).map(c => new Country(c))
  },

  async AddressList() {
    return (await knex('address').limit(10)).map(c => new Address(c))
  }
}


/*

const reqExecutor = async (reqObj, resObj, _ast) => {

  const res = {}
  // const dependedFields = Object.keys(reqObj).map(k => (ast.fields && ast.fields[k] && ast.fields[k].nested && ast.fields[k].nested.path))
  /!*  const dependFields = new Set();
    for(const k of Object.keys(reqObj)){
      if(ast.fields && ast.fields[k] && ast.fields[k].nested && ast.fields[k].nested.path){
        dependFields.add(ast.fields[k].nested.path)

      }
    }*!/

  function extractDependsOn(key, i = 0, prev, __ast) {
    const ast = __ast || _ast
    if (!prev || typeof prev !== 'object' || i >= _ast.fields[key].nested.path.length) {
      if (typeof resObj[key] === 'function') {
        return resObj[key](prev)//.call(res);
        // console.log(prefix + res[key])
      } else if (typeof resObj[key] === 'object') {
        return Promise.resolve(resObj[key])
        // console.log(prefix + res[key])
      } else {
        return Promise.resolve(resObj[key])
        // console.log(prefix + res[key])
      }
    }
    if (typeof prev[key] === 'function') {
      return resObj[key](res)//.call(res);
      // console.log(prefix + res[key])
    }


    if (!prev[_ast.fields[key].nested.path[i]])
      extractField(_ast.fields[key].nested.path[i], _ast)
    prev[key] = prev[_ast.fields[key].nested.path[i]].then(next => {
      // return extractDependsOn(key, ++i, next)


      if (Array.isArray(next)) {
        return Promise.all(next.map(r => extractDependsOn(key, ++i, r, rootAst[_ast[ast.fields[key].nested.path[i]].elementType])))
      } else {
        return extractDependsOn(reqObj[key], ++i, next, _ast[ast.fields[key].nested.path[i]])
      }

    })
    return prev[key]
  }


  function extractField(key, __ast) {
    const ast = __ast || _ast

    if (!(ast.fields && ast.fields[key] && ast.fields[key].nested)) {
      if (typeof resObj[key] === 'function') {
        res[key] = resObj[key]()//.call(res);
        // console.log(prefix + res[key])
      } else if (typeof resObj[key] === 'object') {
        res[key] = Promise.resolve(resObj[key])
        // console.log(prefix + res[key])
      } else {
        res[key] = Promise.resolve(resObj[key])
        // console.log(prefix + res[key])
      }
    } else {
      extractDependsOn(key, 0, res)
    }


  }


  for (const key of Object.keys(reqObj)) {
    if (key in resObj) {
      extractField(key);
    }


    if (reqObj[key] && typeof reqObj[key] === 'object') {
      res[key] = res[key].then(res1 => {
        if (Array.isArray(res1)) {
          return Promise.all(res1.map(r => reqExecutor(reqObj[key], r, rootAst[_ast[key].elementType])))
        } else {
          return reqExecutor(reqObj[key], res1, _ast[key])
        }
      })
    }


  }

  await Promise.all(Object.values(res))

  const out = {};
  for (const [k, v] of Object.entries(res)) {
    out[k] = await v
  }


  return out
}
*/

/*
const reqExecutor = async (reqObj, resObj, ast) => {

  const res = {}


  await Promise.all(Object.keys(reqObj).map(async (key) => {
    if (key in resObj && !(ast.fields && ast.fields[key] && ast.fields[key].path)) {

      if (typeof resObj[key] === 'function') {
        res[key] = await resObj[key]()//.call(res);
        // console.log(prefix + res[key])
      } else if (typeof resObj[key] === 'object') {
        res[key] = resObj[key]
        // console.log(prefix + res[key])
      } else {
        res[key] = resObj[key]
        // console.log(prefix + res[key])
      }
      await delay(100)
    }
    if (reqObj[key] && typeof reqObj[key] === 'object') {
      if (Array.isArray(res[key])) {
        res[key] = await Promise.all(res[key].map(r => reqExecutor(reqObj[key], r, rootAst[ast[key].elementType])))
      } else {
        res[key] = await reqExecutor(reqObj[key], res[key], ast[key])
      }
    }

  }))

  return res
}

*/


const execute = async (requestObj, resolverObj, ast) => {

  const res = {}
  // const dependedFields = Object.keys(reqObj).map(k => (ast.fields && ast.fields[k] && ast.fields[k].nested && ast.fields[k].nested.path))
  /*  const dependFields = new Set();
    for(const k of Object.keys(reqObj)){
      if(ast.fields && ast.fields[k] && ast.fields[k].nested && ast.fields[k].nested.path){
        dependFields.add(ast.fields[k].nested.path)

      }
    }*/


  // extract nested(lookup) recursively
  const extractNested = (path, o = {}, resolver) => {
    if (path.length) {
      const key = path[0]
      if (!o[key]) {


        if (typeof resolver[key] === 'function') {
          o[path[0]] = resolver[key]()//.call(res);
          // console.log(prefix + o[path[0]])
        } else if (typeof resolver[key] === 'object') {
          o[path[0]] = Promise.resolve(resolver[key])
          // console.log(prefix + o[path[0]])
        } else {
          o[path[0]] = Promise.resolve(resolver[key])
          // console.log(prefix + o[path[0]])
        }


      } else if (typeof o[key] === 'function') {
        o[key] = o[key]()
      }


      return (o[path[0]] instanceof Promise ? o[path[0]] : Promise.resolve(o[path[0]])).then(res1 => {

        if (Array.isArray(res1)) {
          return Promise.all(res1.map(r => extractNested(path.slice(1), r)))
        } else {
          return extractNested(path.slice(1), res1)
        }

      })
    } else {
      return Promise.resolve(o)
    }
  };


  // function for extracting field
  function extractField(key) {
    if (!(ast && ast && ast[key] && ast[key].nested)) {
      if (resolverObj) {
        // resolve if it's resolver function
        if (typeof resolverObj[key] === 'function') {
          res[key] = resolverObj[key]()//.call(res);
          // console.log(prefix + res[key])
        } else if (typeof resolverObj[key] === 'object') {
          res[key] = Promise.resolve(resolverObj[key])
          // console.log(prefix + res[key])
        } else {
          res[key] = Promise.resolve(resolverObj[key])
          // console.log(prefix + res[key])
        }
      }
    } else {
      /*      if (!res[ast[key].nested])
              extractField(ast[key].nested.path)


            res[key] = res[ast.fields[key].nested.path].then(res => {
              if (typeof resolverObj[key] === 'function') {
                return resolverObj[key](res)//.call(res);
                // console.log(prefix + res[key])
              } else if (typeof resolverObj[key] === 'object') {
                return Promise.resolve(resolverObj[key])
                // console.log(prefix + res[key])
              } else {
                return Promise.resolve(resolverObj[key])
                // console.log(prefix + res[key])
              }
            })*/
      // if nested extract the nested value
      res[key] = extractNested(ast[key].nested.path, res, resolverObj)


    }


  }


  for (const key of Object.keys(requestObj)) {
    // if (key in resolverObj) {
    extractField(key);
    // }


    if (requestObj[key] && typeof requestObj[key] === 'object') {
      res[key] = res[key].then(res1 => {
        if (Array.isArray(res1)) {
          return Promise.all(res1.map(r => execute(requestObj[key], r, rootAst[ast[key].elementType] && rootAst[ast[key].elementType].fields)))
        } else {
          return execute(requestObj[key], res1, ast[key].fields)
        }
      })
    }


  }

  await Promise.all(Object.values(res))

  const out = {};
  for (const [k, v] of Object.entries(res)) {
    if(k in requestObj)
    out[k] = await v
  }


  return out
}


const req = {
  AddressList: {
    // City: {
    //   Country: 1
    // },
    Country: 1
  },
  CountryList: {
    // cityList: {
    //   addressCount: 1,
    //   addressList: {
    //     address: 1
    //   }
    // },
    // c:1,
    // d:1,
    addressCount:1
  }
};


const extractNested = (path, o = {}) => {
  if (path.length) {
    if (!o[path[0]]) {
      o[path[0]] = Promise.resolve({})
    }
    return o[path[0]].then(r => extractNested(path.slice(1), r))
  } else {
    return Promise.resolve(o)
  }
};

(async () => {

  console.time('start')
  console.log(JSON.stringify(await execute(req, nestResolver, rootAst), 0, 2));
  console.timeEnd('start')


  /*  console.log(JSON.stringify(await extractNested(['a', 'b'], {
      a: Promise.resolve({
        b: Promise.resolve({
          t: 1
        })
      })
    }), 0, 2))*/


  /*  const o = {};*/

  /*  console.log(JSON.stringify(await extractNested(['a', 'b'], o), 0, 2))
    console.log(o)
    console.log(JSON.stringify(await extractNested(['a', 'c'], o), 0, 2))
    console.log(JSON.stringify(await extractNested(['a', 'b', 'c'], o), 0, 2))
    console.log(JSON.stringify(await extractNested(['a', 'b'], o), 0, 2))*/

})().catch(e => console.log(e)).finally(() => process.exit(0))







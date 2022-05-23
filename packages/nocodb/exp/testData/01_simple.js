module.exports = [{
  name: 'Simple',
  in: {
    CountryList: {
      country: 1
    }
  },
  out: {
    "CountryList": [
      {
        "country": "Afghanistan"
      },
      {
        "country": "Algeria"
      }
    ]
  }
},{
  name: 'Nested',
  in: {
    CountryList: {
      country_id:1,
      country:1,
      cityList: {
        city:1,
        addressList:{
          address:1
        }
      }
    }
  },
  out: {
    "CountryList": [
      {
        "country_id": 1,
        "country": "Afghanistan",
        "cityList": [
          {
            "city": "Kabul",
            "addressList": [
              {
                "address": "1168 Najafabad Parkway"
              }
            ]
          }
        ]
      },
      {
        "country_id": 2,
        "country": "Algeria",
        "cityList": [
          {
            "city": "Batna",
            "addressList": [
              {
                "address": "1924 Shimonoseki Drive"
              }
            ]
          },
          {
            "city": "Bchar",
            "addressList": [
              {
                "address": "1031 Daugavpils Parkway"
              }
            ]
          },
          {
            "city": "Skikda",
            "addressList": [
              {
                "address": "757 Rustenburg Avenue"
              }
            ]
          }
        ]
      }
    ]
  }

}, {
  name: 'Nested',
  in: {
    CountryList: {
      country: 1,
      cityList: {
        city: 1
      }
    }
  },
  out: {
    "CountryList": [
      {
        "country": "Afghanistan",
        "cityList": [
          {
            "city": "Kabul"
          }
        ]
      },
      {
        "country": "Algeria",
        "cityList": [
          {
            "city": "Batna"
          },
          {
            "city": "Bchar"
          },
          {
            "city": "Skikda"
          }
        ]
      }
    ]
  }
}, {
  name: 'Lookup',
  in: {
    CountryList: {
      addressCount: 1
    },
  },
  out: {
    "CountryList": [
      {
        "addressCount": [
          1
        ]
      },
      {
        "addressCount": [
          1,
          1,
          1
        ]
      }
    ]
  }

}, {
  name: 'Nested and Lookup',
  in: {
    CountryList: {
      cityList: {
        city: 1
      },
      addressCount: 1
    },
  },
  out: {
    "CountryList": [
      {
        "cityList": [
          {
            "city": "Kabul"
          }
        ],
        "addressCount": [
          1
        ]
      },
      {
        "cityList": [
          {
            "city": "Batna"
          },
          {
            "city": "Bchar"
          },
          {
            "city": "Skikda"
          }
        ],
        "addressCount": [
          1,
          1,
          1
        ]
      }
    ]
  }
}, {
  name: 'Deeply nested Lookup',
  in: {
    CountryList: {
      addressList: 1
    },
  },
  out: {
    "CountryList": [
      {
        "addressList": [
          "1168 Najafabad Parkway"
        ]
      },
      {
        "addressList": [
          "1924 Shimonoseki Drive",
          "1031 Daugavpils Parkway",
          "757 Rustenburg Avenue"
        ]
      }
    ]
  }
},
  {
    name: 'Belongs relation',
    in: {
      AddressList: {
        address: 1,
        City: {
          city: 1
        }
      },
    },
    out: {
      "AddressList": [
        {
          "address": "47 MySakila Drive",
          "City": {
            "city": "Lethbridge"
          }
        },
        {
          "address": "28 MySQL Boulevard",
          "City": {
            "city": "Woodridge"
          }
        },
        {
          "address": "23 Workhaven Lane",
          "City": {
            "city": "Lethbridge"
          }
        },
        {
          "address": "1411 Lillydale Drive",
          "City": {
            "city": "Woodridge"
          }
        },
        {
          "address": "1913 Hanoi Way",
          "City": {
            "city": "Sasebo"
          }
        },
        {
          "address": "1121 Loja Avenue",
          "City": {
            "city": "San Bernardino"
          }
        },
        {
          "address": "692 Joliet Street",
          "City": {
            "city": "Athenai"
          }
        },
        {
          "address": "1566 Inegl Manor",
          "City": {
            "city": "Myingyan"
          }
        },
        {
          "address": "53 Idfu Parkway",
          "City": {
            "city": "Nantou"
          }
        },
        {
          "address": "1795 Santiago de Compostela Way",
          "City": {
            "city": "Laredo"
          }
        }
      ]
    }
  }, {
    name: 'Belongs relation with deep lookup',
    in: {
      AddressList: {
        address: 1,
        CountryName:1
      },
    },
    out: {
      "AddressList": [
        {
          "address": "47 MySakila Drive",
          "CountryName": "Canada"
        },
        {
          "address": "28 MySQL Boulevard",
          "CountryName": "Australia"
        },
        {
          "address": "23 Workhaven Lane",
          "CountryName": "Canada"
        },
        {
          "address": "1411 Lillydale Drive",
          "CountryName": "Australia"
        },
        {
          "address": "1913 Hanoi Way",
          "CountryName": "Japan"
        },
        {
          "address": "1121 Loja Avenue",
          "CountryName": "United States"
        },
        {
          "address": "692 Joliet Street",
          "CountryName": "Greece"
        },
        {
          "address": "1566 Inegl Manor",
          "CountryName": "Myanmar"
        },
        {
          "address": "53 Idfu Parkway",
          "CountryName": "Taiwan"
        },
        {
          "address": "1795 Santiago de Compostela Way",
          "CountryName": "United States"
        }
      ]
    }
  }
]
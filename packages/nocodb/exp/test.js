const a = {
  country:'abc',
  countryId:2
}



a.__proto__ = {
  list(){
    return this.countryId + 1
  }
}



console.log(a)
console.log(a.list())
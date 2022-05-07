let aTblNcMappingTbl = {}
exports.mapTbl = aTblNcMappingTbl

// static mapping records between aTblId && ncId
exports.addToMappingTbl = function addToMappingTbl(aTblId, ncId, ncName, parent) {
  aTblNcMappingTbl[aTblId] = {
    ncId: ncId,
    ncParent: parent,
    // name added to assist in quick debug
    ncName: ncName
  }
}

// get NcID from airtable ID
exports.getNcIdFromAtId = function getNcIdFromAtId(aId) {
  return aTblNcMappingTbl[aId]?.ncId
}

// get nc Parent from airtable ID
exports.getNcParentFromAtId = function getNcParentFromAtId(aId) {
  return aTblNcMappingTbl[aId]?.ncParent
}

// get nc-title from airtable ID
exports.getNcNameFromAtId = function getNcNameFromAtId(aId) {
  return aTblNcMappingTbl[aId]?.ncName
}
///////////////////////////////////////////////////////////////////////////////
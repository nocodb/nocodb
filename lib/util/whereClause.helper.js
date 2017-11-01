'use strict';

function replaceWhereParamsToQMarks(openParentheses, str) {

  let converted = ''

  if (openParentheses) {
    for (var i = 0; i < str.length; ++i) {
      if (str[i] === '(') {
        converted += '('
      } else {
        converted += '??'
        break;
      }
    }
  } else {
    converted = '?'
    for (var i = str.length - 1; i >= 0; --i) {
      if (str[i] === ')') {
        converted += ')'
      } else {
        break;
      }
    }
  }
  return converted;
}

function getComparisonOperator(operator) {

  switch (operator) {

    case 'eq':
      return '='
      break;

    case 'ne':
      return '!='
      break;

    case 'lt':
      return '<'
      break;

    case 'lte':
      return '<='
      break;

    case 'gt':
      return '>'
      break;

    case 'gte':
      return '>='
      break;

    case 'like':
      return ' like '
      break;

    case 'nlike':
      return ' not like '
      break;

    // case 'in':
    //   return ' in '
    //   break;

    default:
      return null
      break;

  }

}


function getLogicalOperator(operator) {

  switch (operator) {

    case '+or':
      return 'or'
      break;

    case '+and':
      return 'and'
      break;

    case '+not':
      return 'not'
      break;

    case '+xor':
      return 'xor'
      break;

    default:
      return null
      break;
  }

}


exports.getWhereClause = function (whereInQueryParams, whereQuery, whereParams) {

  let grammarErr = 0;
  let numOfConditions = whereInQueryParams.split(/\+or|\+and|\+not|\+xor/);
  let logicalOperatorsInClause = whereInQueryParams.match(/(\+or|\+and|\+not|\+xor)/g)

  if (numOfConditions && logicalOperatorsInClause && numOfConditions.length !== logicalOperatorsInClause.length + 1) {
    console.log('conditions and logical operators mismatch', numOfConditions.length, logicalOperatorsInClause.length);
    return
  }

  for (var i = 0; i < numOfConditions.length; ++i) {

    let variable = ''
    let comparisonOperator = ''
    let logicalOperator = ''
    let variableValue = ''
    let temp = ''

    // split on commas
    var arr = numOfConditions[i].split(',');

    // consider first two splits only
    var result = arr.splice(0, 2);

    // join to make only 3 array elements
    result.push(arr.join(','));

    // variable, operator, variablevalue
    if (result.length !== 3) {
      grammarErr = 1;
      break;
    }

    /**************** START : variable ****************/
    //console.log(result);
    variable = result[0].match(/\(+(.*)/);

    console.log('variable',variable);

    if (!variable || variable.length !== 2) {
      grammarErr = 1;
      break;
    }

    // get the variableName and push
    whereParams.push(variable[1])

    // then replace the variable name with ??
    temp = replaceWhereParamsToQMarks(true, result[0])
    if (!temp) {
      grammarErr = 1;
      break;
    }
    whereQuery += temp

    /**************** END : variable ****************/


    /**************** START : operator and value ****************/
    comparisonOperator = getComparisonOperator(result[1])
    if (!comparisonOperator) {
      grammarErr = 1;
      break;
    }
    whereQuery += comparisonOperator

    // get the variableValue and push
    variableValue = result[2].match(/(.*?)\)/)
    if (!variableValue || variableValue.length !== 2) {
      grammarErr = 1;
      break;
    }
    whereParams.push(variableValue[1])

    // then replace the variableName with ?
    temp = replaceWhereParamsToQMarks(false, result[2])
    if (!temp) {
      grammarErr = 1;
      break;
    }
    whereQuery += temp

    // only
    if (numOfConditions.length !== -1 && i !== numOfConditions.length - 1) {
      //console.log('finding logical operator for',logicalOperatorsInClause[i]);
      logicalOperator = getLogicalOperator(logicalOperatorsInClause[i])

      if (!logicalOperator) {
        grammarErr = 1;
        break;
      }

      whereQuery += getLogicalOperator(logicalOperatorsInClause[i])
    }
    /**************** END : operator ****************/


  }

  let obj = {}

  obj['query'] = ''
  obj['params'] = []
  obj['err'] = grammarErr

  console.log(whereInQueryParams);
  console.log(whereQuery);
  console.log(whereParams);
  console.log(grammarErr);
  console.log('= = = = = = = = =');

  if (!grammarErr) {
    obj['query'] = whereQuery
    obj['params'] = whereParams
  }



  return obj


}

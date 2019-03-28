"use strict";

/**
 *
 * @param input : 1,2,3,4
 * @returns obj.query = (?,?,?,?) obj.params = [1,2,3,4]
 */
function prepareInClauseParams(input) {
  let inElems = input.split(",");
  let obj = {};
  obj.whereQuery = "";
  obj.whereParams = [];

  for (var j = 0; j < inElems.length; ++j) {
    if (j === 0) {
      //enclose with open parenthesis
      obj.whereQuery += "(";
    }
    if (j) {
      obj.whereQuery += ",";
    }
    // add q mark and push the variable
    obj.whereQuery += "?";
    obj.whereParams.push(inElems[j]);

    if (j === inElems.length - 1) {
      //enclose with closing parenthesis
      obj.whereQuery += ")";
    }
  }

  //console.log(obj);

  return obj;
}

function prepareLikeValue(value) {
  //return value.replace("~", "%");
  return value.replace(/~/g, "%");
}

function prepareIsValue(value) {
  //return value.replace("~", "%");
  if (value === "null") {
    return null;
  } else if (value === "true") {
    return true;
  } else if (value === "false") {
    return false;
  } else {
    return null;
  }
}

function prepareBetweenValue(value) {
  let values = value.split(",");
  let obj = {};
  obj.whereQuery = "";
  obj.whereParams = [];

  if (values.length === 2) {
    obj.whereQuery = " ? and ? ";
    obj.whereParams.push(values[0]);
    obj.whereParams.push(values[1]);
  }

  //console.log('prepareBetweenValue', obj);

  return obj;
}

function replaceWhereParamsToQMarks(
  openParentheses,
  str,
  comparisonOperator,
  condType
) {
  let converted = "";

  if (openParentheses) {
    for (var i = 0; i < str.length; ++i) {
      if (str[i] === "(") {
        converted += "(";
      } else {
        converted += "??";
        break;
      }
    }
  } else {
    if (
      comparisonOperator !== " in " &&
      comparisonOperator !== " between " &&
      condType !== " on "
    ) {
      converted = "?";
    } else if (condType === " on ") {
      converted = "??";
    }

    for (var i = str.length - 1; i >= 0; --i) {
      if (str[i] === ")") {
        converted += ")";
      } else {
        break;
      }
    }
  }

  return converted;
}

function getComparisonOperator(operator) {
  switch (operator) {
    case "eq":
      return "=";
      break;

    case "ne":
      return "!=";
      break;

    case "lt":
      return "<";
      break;

    case "lte":
      return "<=";
      break;

    case "gt":
      return ">";
      break;

    case "gte":
      return ">=";
      break;

    case "is":
      return " is ";
      break;

    case "isnot":
      return " is not ";
      break;

    // case 'isnull':
    //   return ' is NULL '
    //   break;

    // case 'isnnull':
    //   return ' is not NULL '
    //   break;

    case "like":
      return " like ";
      break;

    case "nlike":
      return " not like ";
      break;

    case "in":
      return " in ";
      break;

    case "bw":
      return " between ";
      break;

    default:
      return null;
      break;
  }
}

function getLogicalOperator(operator) {
  switch (operator) {
    case "~or":
      return "or";
      break;

    case "~and":
      return "and";
      break;

    // case '~not':
    //   return 'not'
    //   break;

    case "~xor":
      return "xor";
      break;

    default:
      return null;
      break;
  }
}

exports.getConditionClause = function(whereInQueryParams, condType = "where") {
  let whereQuery = "";
  let whereParams = [];
  let grammarErr = 0;
  let numOfConditions = whereInQueryParams.split(/~or|~and|~not|~xor/);
  let logicalOperatorsInClause = whereInQueryParams.match(
    /(~or|~and|~not|~xor)/g
  );

  if (
    numOfConditions &&
    logicalOperatorsInClause &&
    numOfConditions.length !== logicalOperatorsInClause.length + 1
  ) {
    console.log(
      "conditions and logical operators mismatch",
      numOfConditions.length,
      logicalOperatorsInClause.length
    );
  } else {
    //console.log('numOfConditions',numOfConditions,whereInQueryParams);
    //console.log('logicalOperatorsInClause',logicalOperatorsInClause);

    for (var i = 0; i < numOfConditions.length; ++i) {
      let variable = "";
      let comparisonOperator = "";
      let logicalOperator = "";
      let variableValue = "";
      let temp = "";

      // split on commas
      var arr = numOfConditions[i].split(",");

      // consider first two splits only
      var result = arr.splice(0, 2);

      // join to make only 3 array elements
      result.push(arr.join(","));

      // variable, operator, variablevalue
      if (result.length !== 3) {
        grammarErr = 1;
        break;
      }

      /**************** START : variable ****************/
      //console.log('variable, operator, variablevalue',result);
      variable = result[0].match(/\(+(.*)/);

      //console.log('variable',variable);

      if (!variable || variable.length !== 2) {
        grammarErr = 1;
        break;
      }

      // get the variableName and push
      whereParams.push(variable[1]);

      // then replace the variable name with ??
      temp = replaceWhereParamsToQMarks(true, result[0], " ignore ", condType);
      if (!temp) {
        grammarErr = 1;
        break;
      }
      whereQuery += temp;

      /**************** END : variable ****************/

      /**************** START : operator and value ****************/
      comparisonOperator = getComparisonOperator(result[1]);
      if (!comparisonOperator) {
        grammarErr = 1;
        break;
      }
      whereQuery += comparisonOperator;

      // get the variableValue and push to params
      variableValue = result[2].match(/(.*?)\)/);
      if (!variableValue || variableValue.length !== 2) {
        grammarErr = 1;
        break;
      }

      if (comparisonOperator === " in ") {
        let obj = prepareInClauseParams(variableValue[1]);
        whereQuery += obj.whereQuery;
        whereParams = whereParams.concat(obj.whereParams);
      } else if (
        comparisonOperator === " like " ||
        comparisonOperator === " not like "
      ) {
        whereParams.push(prepareLikeValue(variableValue[1]));
      } else if (comparisonOperator === " is ") {
        whereParams.push(prepareIsValue(variableValue[1]));
      } else if (comparisonOperator === " between ") {
        let obj = prepareBetweenValue(variableValue[1]);
        whereQuery += obj.whereQuery;
        whereParams = whereParams.concat(obj.whereParams);
        //console.log(whereQuery, whereParams);
      } else {
        whereParams.push(variableValue[1]);
      }

      // then replace the variableValue with ?
      temp = replaceWhereParamsToQMarks(
        false,
        result[2],
        comparisonOperator,
        condType
      );
      if (!temp) {
        grammarErr = 1;
        break;
      }
      whereQuery += temp;

      if (numOfConditions.length !== -1 && i !== numOfConditions.length - 1) {
        //console.log('finding logical operator for',logicalOperatorsInClause[i]);
        logicalOperator = getLogicalOperator(logicalOperatorsInClause[i]);

        if (!logicalOperator) {
          grammarErr = 1;
          break;
        }

        whereQuery += getLogicalOperator(logicalOperatorsInClause[i]);
      }
      /**************** END : operator ****************/
    }
  }

  let obj = {};

  obj["query"] = "";
  obj["params"] = [];
  obj["err"] = grammarErr;

  // console.log(whereInQueryParams);
  // console.log(whereQuery);
  // console.log(whereParams);
  // console.log(grammarErr);
  // console.log('= = = = = = = = =');

  if (!grammarErr) {
    obj["query"] = whereQuery;
    obj["params"] = whereParams;
  }

  return obj;
};

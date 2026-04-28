// Info: AWS Lambda handler - Get Survey by ID
'use strict';

const Handler = require('../../../../common/lambda-aws-handler');


/********************************************************************
AWS Lambda handler for GET /survey/{id}

@param {Object} event - AWS API Gateway event
@param {Object} context - AWS Lambda context
@param {Function} callback - AWS Lambda callback

@return {void}
*********************************************************************/
module.exports.handler = Handler(async function (event, context, callback) {

  const standard_request = Lib.Functions.buildStandardRequest({
    method: 'GET',
    path: '/survey/get-data',
    params: event.pathParameters || {},
    query: event.queryStringParameters || {},
    body: {},
    headers: Lib.Functions.lowerCaseKeys(event.headers || {}),
    auth: {},
    request_id: context.awsRequestId,
    source: 'lambda-aws'
  });

  const result = await Lib.SurveyController.getById(standard_request);

  return {
    statusCode: result.status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(result)
  };

});

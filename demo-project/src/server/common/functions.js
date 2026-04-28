// Info: Shared execution helpers for standardized request/response patterns
'use strict';



///////////////////////////Public Functions START//////////////////////////////
const Functions = module.exports = {

  /********************************************************************
  Build a standardized success response object

  @param {Object} data - Response payload
  @param {Number} [status] - (Optional) HTTP status code. Default: 200

  @return {Object} - Standardized response object
  *********************************************************************/
  successResponse: function (data, status) {

    return {
      success: true,
      status: status || 200,
      data: data,
      error: null
    };

  },


  /********************************************************************
  Build a standardized error response object

  @param {Object} error - Error object with code and message
  @param {Number} [status] - (Optional) HTTP status code. Default: 500

  @return {Object} - Standardized response object
  *********************************************************************/
  errorResponse: function (error, status) {

    return {
      success: false,
      status: status || error.status || 500,
      data: null,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'An unexpected error occurred'
      }
    };

  },


  /********************************************************************
  Build a standardized request object from raw transport data

  @param {Object} params - Raw request parameters
  @param {String} params.method - HTTP method
  @param {String} params.path - Route path
  @param {Object} [params.params] - URL parameters
  @param {Object} [params.query] - Query string parameters
  @param {Object} [params.body] - Request body
  @param {Object} [params.headers] - HTTP headers
  @param {Object} [params.auth] - Auth context
  @param {String} params.source - Adapter source identifier

  @return {Object} - Standardized request object
  *********************************************************************/
  buildStandardRequest: function (params) {

    return {
      method: params.method,
      path: params.path,
      params: params.params || {},
      query: params.query || {},
      body: params.body || {},
      headers: params.headers || {},
      auth: params.auth || {},
      meta: {
        request_id: params.request_id || Functions._generateRequestId(),
        request_time: Date.now(),
        source: params.source
      }
    };

  },


  /********************************************************************
  Generate a simple unique request ID

  @return {String} - Unique request identifier
  *********************************************************************/
  _generateRequestId: function () {

    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);

  },


  /********************************************************************
  Convert header keys to lowercase (AWS Lambda / AWS API Gateway compatibility)

  @param {Object} headers - Raw headers object

  @return {Object} - Headers with lowercased keys
  *********************************************************************/
  lowerCaseKeys: function (headers) {

    const result = {};

    for (const key in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, key)) {
        result[key.toLowerCase()] = headers[key];
      }
    }

    return result;

  },


  /********************************************************************
  Parse JSON body safely (AWS Lambda / AWS API Gateway compatibility)

  @param {String} body - Raw body string

  @return {Object} - Parsed JSON or empty object
  *********************************************************************/
  parseBody: function (body) {

    if (!body) {
      return {};
    }

    try {
      return JSON.parse(body);
    }
    catch {
      return {};
    }

  }

};///////////////////////////Public Functions END//////////////////////////////

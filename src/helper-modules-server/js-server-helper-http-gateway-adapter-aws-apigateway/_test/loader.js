// Info: Test loader for js-server-helper-http-gateway-adapter-aws-apigateway.
// Builds the base Lib container (Utils, Debug, Instance) and loads the
// http-gateway with this AWS API Gateway adapter injected. Tests can then
// feed real AWS event fixtures through the full pipeline (adapter -> gateway)
// and inspect both the populated instance and the Lambda response envelope.
'use strict';


const GatewayLoader = require('@superloomdev/js-server-helper-http-gateway');
const AdapterLoader = require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway');


/********************************************************************
Build the dependency container and a configured gateway for tests.
The gateway is wired with the AWS API Gateway adapter so test
handlers can invoke gateway methods directly against real API
Gateway v2.0 event fixtures.

@return {Object} - { Lib, gateway }
*********************************************************************/
module.exports = function loader () {

  const config_debug = { LOG_LEVEL: 'error' };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== FOUNDATION MODULES ========================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});


  // ==================== HTTP GATEWAY (WITH ADAPTER) ================ //

  const gateway = GatewayLoader(Lib, { ADAPTER: AdapterLoader });


  return { Lib: Lib, gateway: gateway };

};

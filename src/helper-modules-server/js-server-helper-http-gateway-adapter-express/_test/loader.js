// Info: Test loader for js-server-helper-http-gateway-adapter-express. Builds the
// base Lib container (Utils, Debug, Instance) used by all tests, then loads the
// http-gateway with this Express adapter injected. Returns both Lib and a
// ready-to-use gateway instance so tests can register Express routes that
// flow through the real adapter pipeline end-to-end.
'use strict';


const GatewayLoader = require('helper-http-gateway');
const AdapterLoader = require('helper-http-gateway-adapter-express');


/********************************************************************
Build the dependency container and a configured gateway for tests.
The gateway is wired with the Express adapter so registered Express
route handlers can invoke gateway methods directly.

@return {Object} - { Lib, gateway }
*********************************************************************/
module.exports = function loader () {

  const config_debug = { LOG_LEVEL: 'error' };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== FOUNDATION MODULES ========================= //

  Lib.Utils = require('helper-utils')(Lib, {});
  Lib.Debug = require('helper-debug')(Lib, config_debug);


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.Instance = require('helper-instance')(Lib, {});


  // ==================== HTTP GATEWAY (WITH ADAPTER) ================ //

  const gateway = GatewayLoader(Lib, { ADAPTER: AdapterLoader });


  return { Lib: Lib, gateway: gateway };

};

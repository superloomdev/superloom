// Info: All validators for js-server-helper-http-gateway.
// Config validators are called once at construction time and throw on
// misconfiguration so the loader fails fast at startup.
'use strict';


// Shared dependency injected by loader
let Lib;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib and returns the module-scope Validators
object. Takes only Lib - no CONFIG or ERRORS - because validators run
before CONFIG is validated.

@param {Object} shared_libs - Dependency container (Utils)

@return {Object} - Public Validators interface
*********************************************************************/
module.exports = function loader (shared_libs) {

  Lib = shared_libs;

  return Validators;

};///////////////////////////// Module-Loader END ///////////////////////////////



////////////////////////////// Public Functions START ////////////////////////
const Validators = {


  // ~~~~~~~~~~~~~~~~~~~~ Config Validators ~~~~~~~~~~~~~~~~~~~~
  // Called once at construction time from the http-gateway.js loader.
  // Throw Error (not TypeError) - misconfiguration is a setup error.

  /********************************************************************
  Validate the merged CONFIG. Throws on any missing-required violation
  so the loader fails before serving a single request.

  @param {Object} CONFIG - Merged module configuration

  @return {void}
  *********************************************************************/
  validateConfig: function (CONFIG) {

    if (
      Lib.Utils.isNullOrUndefined(CONFIG.ADAPTER) ||
      typeof CONFIG.ADAPTER !== 'function'
    ) {
      throw new Error(
        '[js-server-helper-http-gateway] CONFIG.ADAPTER must be an adapter factory function ' +
        '(e.g. require("js-server-helper-http-gateway-adapter-aws-apigateway"))'
      );
    }

  }

};
/////////////////////////////Public Functions END /////////////////////////////

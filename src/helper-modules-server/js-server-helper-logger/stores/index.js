// Info: Lazy store registry. Maps store names to factory loaders so only
// the requested store's source file is required at module-load time - the
// other backends' files stay on disk and their npm dependencies
// (mongodb, pg, mysql2, aws-sdk) are never required.
//
// Adding a new backend = one entry below + one file in this directory.
'use strict';


// Registry: store name -> factory function. require() is inside the closure
// so a file is read only when its name is requested.
//
// `__inject` is the test-only escape hatch - returns whatever object the
// caller passes in `STORE_CONFIG.store`. The double-underscore prefix is
// the signal that this is not for production use.
const STORE_FACTORIES = {
  'memory':   function () { return require('./memory'); },
  'postgres': function () { return require('./postgres'); },
  'mysql':    function () { return require('./mysql'); },
  'sqlite':   function () { return require('./sqlite'); },
  'mongodb':  function () { return require('./mongodb'); },
  'dynamodb': function () { return require('./dynamodb'); },
  '__inject': function () {
    return function injectFactory (Lib, store_config) {
      void Lib;
      if (
        store_config === undefined ||
        store_config === null ||
        typeof store_config.store !== 'object' ||
        store_config.store === null
      ) {
        throw new Error('[js-server-helper-logger] STORE_CONFIG.store is required for the __inject test store');
      }
      return store_config.store;
    };
  }
};


/********************************************************************
Resolve a store name to its factory. Throws on unknown names so
misconfiguration fails fast at loader time.

@param {String} store_name - The CONFIG.STORE value

@return {Function} - The store factory: factory(Lib, store_config) -> store
*********************************************************************/
module.exports = function loadStoreFactory (store_name) {

  const lazy_loader = STORE_FACTORIES[store_name];

  if (lazy_loader === undefined) {
    throw new Error(
      '[js-server-helper-logger] Unknown CONFIG.STORE "' + store_name + '". ' +
      'Supported: ' + Object.keys(STORE_FACTORIES).join(', ')
    );
  }

  return lazy_loader();

};

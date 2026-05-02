// Info: Lazy store registry. Maps store names to factory loaders so only
// the requested store's source file is required - other backends stay on
// disk and never load their npm dependencies (mongodb, pg, mysql2, etc.).
//
// Adding a new backend = adding a single line to STORE_FACTORIES below
// and dropping the implementation file in this directory.
'use strict';


// Registry: store name -> factory function (require() is inside the closure).
// Names are lower-case ASCII; underscores not allowed (keeps URLs/paths clean).
//
// `__inject` is a test-only escape hatch that returns whatever object the
// caller passes in `STORE_CONFIG.store`. Production code never uses this -
// the double-underscore prefix is the signal. Used by the unit-test suite
// to drive the verify module against ad-hoc fixtures (failing stores,
// mock stores, etc.) without going through the full registry path.
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
        throw new Error('[js-server-helper-verify] STORE_CONFIG.store is required for the __inject test store');
      }
      return store_config.store;
    };
  }
};


/********************************************************************
Resolve a store name to its factory. Throws on unknown names so
misconfiguration fails fast at loader time rather than on first request.

@param {String} store_name - The CONFIG.STORE value

@return {Function} - The store factory: factory(Lib, store_config) -> store
*********************************************************************/
module.exports = function loadStoreFactory (store_name) {

  const lazy_loader = STORE_FACTORIES[store_name];

  if (lazy_loader === undefined) {
    throw new Error(
      '[js-server-helper-verify] Unknown CONFIG.STORE "' + store_name + '". ' +
      'Supported: ' + Object.keys(STORE_FACTORIES).join(', ')
    );
  }

  return lazy_loader();

};

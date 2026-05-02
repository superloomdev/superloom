// Info: Store registry. Maps the configured STORE name to a factory
// function that lazily loads the store implementation.
//
// The require() calls live INSIDE the arrow functions, so the cost of
// loading a store (parsing the file, resolving its own dependencies,
// allocating its closures) is paid only for the chosen store. Other
// store files stay on disk and never enter memory.
//
// This pattern avoids `if (config.store === 'postgres') require(...)`,
// which is brittle and disrupts static analysis. Adding a new store is
// a one-line registry edit.
'use strict';


// Registry: store name -> factory function (require() is inside the closure).
// Names are lower-case ASCII; underscores not allowed (keeps URLs/paths clean).
const STORE_FACTORIES = {
  'memory':   function () { return require('./memory'); },
  'postgres': function () { return require('./postgres'); },
  'mysql':    function () { return require('./mysql'); },
  'sqlite':   function () { return require('./sqlite'); },
  'mongodb':  function () { return require('./mongodb'); },
  'dynamodb': function () { return require('./dynamodb'); }
};


/********************************************************************
Resolve a store name to its factory function. Throws on unknown names
so misconfiguration fails fast at loader time.

@param {String} store_name - The CONFIG.STORE value

@return {Function} - The store factory: factory(Lib, store_config) -> store
*********************************************************************/
module.exports = function loadStoreFactory (store_name) {

  if (typeof store_name !== 'string' || store_name.length === 0) {
    throw new Error(
      '[js-server-helper-auth] CONFIG.STORE is required (one of: ' +
      Object.keys(STORE_FACTORIES).join(', ') + ')'
    );
  }

  if (!Object.prototype.hasOwnProperty.call(STORE_FACTORIES, store_name)) {
    throw new Error(
      '[js-server-helper-auth] Unknown CONFIG.STORE "' + store_name +
      '". Valid: ' + Object.keys(STORE_FACTORIES).join(', ')
    );
  }

  // Only this one require() executes; the others stay on disk.
  return STORE_FACTORIES[store_name]();

};


// Expose the list of known store names for diagnostics + tests
module.exports.knownStores = function () {

  return Object.keys(STORE_FACTORIES);

};

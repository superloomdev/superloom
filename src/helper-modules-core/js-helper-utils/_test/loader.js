// Test loader for js-helper-utils
// Builds a Lib container for use in test files
'use strict';



module.exports = function loader () {

  // Build Lib container
  const Lib = {};

  // Load Utils instance
  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});

  // Return runtime objects
  return { Lib };

};

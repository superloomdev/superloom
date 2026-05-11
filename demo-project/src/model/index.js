// Info: Public export surface for the model package
// Each entity module is exported as a named property
'use strict';


module.exports = {
  Contact: require('./contact'),
  User: require('./user'),
  Survey: require('./survey'),
  Shared: require('./shared')
};

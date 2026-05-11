// Info: Server Model Extensions - exports all server-side model extensions
// Each entity's server model extends the base model with server-only fields
'use strict';

module.exports = {
  Survey: require('./survey'),
  Shared: require('./shared')
};

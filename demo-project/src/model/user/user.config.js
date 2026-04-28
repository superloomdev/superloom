// User validation boundaries + enums + defaults
// Overrideable via environment config via loader
'use strict';


module.exports = {

  // Name constraints
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,

  // Email and phone validation is handled by the Contact model (inter-module reference)
  // See: src/model/contact/

  // Status values
  STATUS_VALUES: ['active', 'inactive', 'suspended', 'deleted'],
  DEFAULT_STATUS: 'active',

  // Role values
  ROLE_VALUES: ['user', 'admin', 'moderator'],
  DEFAULT_ROLE: 'user'

};

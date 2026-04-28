// Info: Domain error catalog for User entity
// Error codes + default messages + optional HTTP status
'use strict';


module.exports = {

  // Validation errors
  NAME_REQUIRED: {
    code: 'USER_NAME_REQUIRED',
    message: 'User name is required',
    status: 400
  },

  NAME_INVALID: {
    code: 'USER_NAME_INVALID',
    message: 'User name does not meet length requirements',
    status: 400
  },

  EMAIL_REQUIRED: {
    code: 'USER_EMAIL_REQUIRED',
    message: 'Email address is required',
    status: 400
  },

  EMAIL_INVALID: {
    code: 'USER_EMAIL_INVALID',
    message: 'Email address format is invalid',
    status: 400
  },

  PHONE_INVALID: {
    code: 'USER_PHONE_INVALID',
    message: 'Phone number format is invalid',
    status: 400
  },

  STATUS_INVALID: {
    code: 'USER_STATUS_INVALID',
    message: 'User status value is not recognized',
    status: 400
  },

  ROLE_INVALID: {
    code: 'USER_ROLE_INVALID',
    message: 'User role value is not recognized',
    status: 400
  },

  // Business errors
  EMAIL_ALREADY_EXISTS: {
    code: 'USER_EMAIL_ALREADY_EXISTS',
    message: 'A user with this email already exists',
    status: 409
  },

  NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'User not found',
    status: 404
  },

  ID_REQUIRED: {
    code: 'USER_ID_REQUIRED',
    message: 'User ID is required',
    status: 400
  }

};

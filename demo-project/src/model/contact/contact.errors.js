// Info: Domain error catalog for Contact entity
'use strict';


module.exports = {

  // Email errors
  EMAIL_REQUIRED: {
    code: 'CONTACT_EMAIL_REQUIRED',
    message: 'Email address is required',
    status: 400
  },

  EMAIL_INVALID_FORMAT: {
    code: 'CONTACT_EMAIL_INVALID_FORMAT',
    message: 'Email address format is invalid',
    status: 400
  },

  EMAIL_INVALID_LENGTH: {
    code: 'CONTACT_EMAIL_INVALID_LENGTH',
    message: 'Email address does not meet length requirements',
    status: 400
  },

  EMAIL_DOMAIN_BLOCKED: {
    code: 'CONTACT_EMAIL_DOMAIN_BLOCKED',
    message: 'Email domain is not allowed',
    status: 400
  },

  EMAIL_DOMAIN_NOT_ALLOWED: {
    code: 'CONTACT_EMAIL_DOMAIN_NOT_ALLOWED',
    message: 'Email domain is not in the allowed list',
    status: 400
  },

  // Phone errors
  PHONE_COUNTRY_REQUIRED: {
    code: 'CONTACT_PHONE_COUNTRY_REQUIRED',
    message: 'Phone country is required',
    status: 400
  },

  PHONE_COUNTRY_INVALID: {
    code: 'CONTACT_PHONE_COUNTRY_INVALID',
    message: 'Phone country is not supported',
    status: 400
  },

  PHONE_NUMBER_REQUIRED: {
    code: 'CONTACT_PHONE_NUMBER_REQUIRED',
    message: 'Phone number is required',
    status: 400
  },

  PHONE_NUMBER_INVALID: {
    code: 'CONTACT_PHONE_NUMBER_INVALID',
    message: 'Phone number format is invalid for the given country',
    status: 400
  }

};

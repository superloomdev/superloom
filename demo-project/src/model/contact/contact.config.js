// Contact validation boundaries + enums + defaults
// Overrideable via environment config via loader
'use strict';


module.exports = {

  // Email constraints
  EMAIL_MIN_LENGTH: 5,
  EMAIL_MAX_LENGTH: 255,
  EMAIL_REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  // Allowed email domains (empty array = all domains allowed)
  // Projects can restrict to specific domains, e.g., ['company.com', 'partner.com']
  EMAIL_ALLOWED_DOMAINS: [],

  // Blocked email domains (disposable email providers, etc.)
  EMAIL_BLOCKED_DOMAINS: ['tempmail.com', 'throwaway.email', 'mailinator.com'],

  // Phone country constraints
  PHONE_COUNTRIES: {
    'in': { code: '+91', min_length: 10, max_length: 10, regex: /^[6-9][0-9]{9}$/ },
    'us': { code: '+1', min_length: 10, max_length: 10, regex: /^[2-9][0-9]{9}$/ },
    'uk': { code: '+44', min_length: 10, max_length: 10, regex: /^[0-9]{10}$/ },
    'sa': { code: '+966', min_length: 9, max_length: 9, regex: /^[0-9]{9}$/ }
  },

  // Phone number sanitization regex (remove everything except digits)
  PHONE_SANITIZE_REGEX: /[^0-9]/g,

  // Phone ID format: country_code + phone_number (used as unique identifier)
  PHONE_ID_SEPARATOR: '-'

};

// Info: Contact Process Module - Pure business logic for Contact entity
// Data transformations for email, phone, and address handling
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib;

// Domain config (injected; constants/enums, not runtime env)
let CONFIG;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib + CONFIG for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @return {void}
  *********************************************************************/
const loader = function (shared_libs, config) {

  Lib = shared_libs;
  CONFIG = config;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  // Run module-scope loader (local DI)
  loader(shared_libs, config);

  // Return Public Functions of this module
  return ContactProcess;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START///////////////////////////////
const ContactProcess = {

  /********************************************************************
  Format phone number for display

  @param {String} phone - Raw phone number
  @param {String} format - Output format (international, national, e164)

  @return {String} - Formatted phone number
  *********************************************************************/
  formatPhoneNumber: function (phone, format) {

    if (Lib.Utils.isEmpty(phone)) {
      return '';
    }

    // Remove all non-numeric characters
    const digits = phone.replace(/\D/g, '');

    if (digits.length === 0) {
      return phone;
    }

    // Simple formatting - assumes US/Canada format for demo
    const area = digits.slice(-10, -7);
    const prefix = digits.slice(-7, -4);
    const line = digits.slice(-4);

    switch (format) {
    case 'international':
      return `+1 (${area}) ${prefix}-${line}`;
    case 'national':
      return `(${area}) ${prefix}-${line}`;
    case 'e164':
      return `+1${area}${prefix}${line}`;
    default:
      return digits.slice(-10);
    }

  },


  /********************************************************************
  Mask phone number for privacy (show only last 4 digits)

  @param {String} phone - Phone number

  @return {String} - Masked phone number
  *********************************************************************/
  maskPhoneNumber: function (phone) {

    if (Lib.Utils.isEmpty(phone)) {
      return '';
    }

    const digits = phone.replace(/\D/g, '');
    const last4 = digits.slice(-4);

    if (digits.length <= 4) {
      return phone;
    }

    return '***-***-' + last4;

  },


  /********************************************************************
  Mask email for privacy (show only first 2 chars and domain)

  @param {String} email - Email address

  @return {String} - Masked email
  *********************************************************************/
  maskEmail: function (email) {

    if (Lib.Utils.isEmpty(email) || !email.includes('@')) {
      return email;
    }

    const [local, domain] = email.split('@');
    const visible = local.slice(0, 2);
    const masked = '*'.repeat(Math.max(local.length - 2, 3));

    return `${visible}${masked}@${domain}`;

  },


  /********************************************************************
  Normalize email address (lowercase, trim)

  @param {String} email - Email address

  @return {String} - Normalized email
  *********************************************************************/
  normalizeEmail: function (email) {

    if (Lib.Utils.isEmpty(email)) {
      return '';
    }

    return email.toLowerCase().trim();

  },


  /********************************************************************
  Extract domain from email

  @param {String} email - Email address

  @return {String|null} - Domain or null
  *********************************************************************/
  extractEmailDomain: function (email) {

    if (Lib.Utils.isEmpty(email) || !email.includes('@')) {
      return null;
    }

    return email.split('@')[1].toLowerCase();

  },


  /********************************************************************
  Format address as single line

  @param {Object} address - Address object
  @param {String} address.line1 - Street address
  @param {String} [address.line2] - Apartment, suite, etc.
  @param {String} address.city - City
  @param {String} address.state - State/province
  @param {String} address.postal_code - Postal/ZIP code
  @param {String} [address.country] - Country

  @return {String} - Formatted address
  *********************************************************************/
  formatAddressLine: function (address) {

    if (Lib.Utils.isEmpty(address)) {
      return '';
    }

    const parts = [];

    if (address.line1) {
      parts.push(address.line1);
    }

    if (address.line2) {
      parts.push(address.line2);
    }

    const city_state = [];
    if (address.city) {
      city_state.push(address.city);
    }
    if (address.state) {
      city_state.push(address.state);
    }

    if (city_state.length > 0) {
      parts.push(city_state.join(', '));
    }

    if (address.postal_code) {
      parts.push(address.postal_code);
    }

    if (address.country) {
      parts.push(address.country);
    }

    return parts.join(', ');

  },


  /********************************************************************
  Build contact summary for display

  @param {Object} contact_data - Contact data
  @param {String} contact_data.email - Email
  @param {String} [contact_data.phone] - Phone number
  @param {Object} [contact_data.address] - Address object

  @return {Object} - Contact summary
  *********************************************************************/
  buildContactSummary: function (contact_data) {

    return {
      email: contact_data.email,
      email_masked: ContactProcess.maskEmail(contact_data.email),
      email_domain: ContactProcess.extractEmailDomain(contact_data.email),
      phone: contact_data.phone || null,
      phone_masked: contact_data.phone ? ContactProcess.maskPhoneNumber(contact_data.phone) : null,
      phone_formatted: contact_data.phone ? ContactProcess.formatPhoneNumber(contact_data.phone, 'national') : null,
      has_address: !Lib.Utils.isEmpty(contact_data.address),
      address_summary: !Lib.Utils.isEmpty(contact_data.address)
        ? ContactProcess.formatAddressLine(contact_data.address)
        : null
    };

  },


  /********************************************************************
  Check if contact has complete information

  @param {Object} contact_data - Contact data

  @return {Object} - Completeness check result
  *********************************************************************/
  checkCompleteness: function (contact_data) {

    const result = {
      is_complete: false,
      has_email: !Lib.Utils.isEmpty(contact_data.email),
      has_phone: !Lib.Utils.isEmpty(contact_data.phone),
      has_address: !Lib.Utils.isEmpty(contact_data.address),
      missing_fields: []
    };

    if (!result.has_email) {
      result.missing_fields.push('email');
    }

    if (!result.has_phone) {
      result.missing_fields.push('phone');
    }

    if (!result.has_address) {
      result.missing_fields.push('address');
    }

    result.is_complete = result.missing_fields.length === 0;

    return result;

  }

};///////////////////////////Public Functions END///////////////////////////////

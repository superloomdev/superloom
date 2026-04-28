// Contact entity data + DTO utilities
// Centralized construction and output shaping
// Standard pattern: entity + public data transformers
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
  return ContactData;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const ContactData = { // Public functions accessible by other modules

  /********************************************************************
  Create email data with sanitization

  @param {String} email - Email address

  @return {Object} - Canonical email data
  *********************************************************************/
  createEmail: function (email) {

    // Initialise
    const result = {};

    // Only add email if provided
    if (email !== undefined && email !== null) {
      result.email = email.trim().toLowerCase();
    }

    // Return
    return result;

  },


  /********************************************************************
  Create phone data with sanitization

  @param {String} phone_country - Country code key (e.g., 'in', 'us')
  @param {String} phone_number - Phone number (will be sanitized)

  @return {Object} - Canonical phone data
  *********************************************************************/
  createPhone: function (phone_country, phone_number) {

    // Return
    return {
      phone_country: phone_country ? phone_country.toLowerCase() : null,
      phone_number: phone_number ? phone_number.replace(CONFIG.PHONE_SANITIZE_REGEX, '') : null
    };

  },


  /********************************************************************
  Create address data

  @param {String} line1 - Street address
  @param {String} [line2] - Apartment, suite, floor
  @param {String} city - City name
  @param {String} state - State or province
  @param {String} postal_code - ZIP or postal code
  @param {String} [country] - Country code

  @return {Object} - Canonical address data
  *********************************************************************/
  createAddress: function (line1, line2, city, state, postal_code, country) {

    // Return
    return {
      line1: line1 ? line1.trim() : null,
      line2: line2 ? line2.trim() : null,
      city: city ? city.trim() : null,
      state: state ? state.trim() : null,
      postal_code: postal_code ? postal_code.trim() : null,
      country: country ? country.toLowerCase() : null
    };

  },


  /********************************************************************
  Create complete contact data with all components

  @param {Object} email_data - Email data object
  @param {Object} phone_data - Phone data object
  @param {Object} [address_data] - Address data object
  @param {String} [contact_id] - Optional contact identifier

  @return {Object} - Complete contact data
  *********************************************************************/
  createContact: function (email_data, phone_data, address_data, contact_id) {

    // Initialise
    const data = {};

    // Set email if provided
    if (email_data && email_data.email) {
      data.email = email_data.email;
    }

    // Set phone if provided
    if (phone_data && phone_data.phone_country) {
      data.phone_country = phone_data.phone_country;
      data.phone_number = phone_data.phone_number;
      data.phone_id = ContactData.buildPhoneId(phone_data.phone_country, phone_data.phone_number);
    }

    // Set address if provided
    if (address_data) {
      data.address = address_data;
    }

    // Set contact_id if provided
    if (contact_id) {
      data.contact_id = contact_id;
    }


    // Return
    return data;

  },


  /********************************************************************
  Create deep contact data with nested structures

  @param {Object} contact_data - Core contact data
  @param {Object} [metadata] - System metadata
  @param {Object} [preferences] - Contact preferences

  @return {Object} - Contact deep data
  *********************************************************************/
  createDeep: function (contact_data, metadata, preferences) {

    // Return
    return {
      contact_data: contact_data,
      metadata: metadata || {},
      preferences: preferences || {}
    };

  },


  /********************************************************************
  Build phone ID from country and number (used as unique identifier)

  @param {String} phone_country - Country code key
  @param {String} phone_number - Sanitized phone number

  @return {String|null} - Phone ID (e.g., '+91-9876543210') or null if incomplete
  *********************************************************************/
  buildPhoneId: function (phone_country, phone_number) {

    // Check for required fields
    if (!phone_country || !phone_number) {
      return null;
    }

    // Get country config
    const country_config = CONFIG.PHONE_COUNTRIES[phone_country.toLowerCase()];
    if (!country_config) {
      return null;
    }

    // Sanitize phone number
    const sanitized = phone_number.replace(CONFIG.PHONE_SANITIZE_REGEX, '');


    // Return
    return country_config.code + CONFIG.PHONE_ID_SEPARATOR + sanitized;

  },


  /********************************************************************
  Transform to public output
  Contact data is generally public, but we still sanitize

  @param {Object} contact_data - Full internal contact data

  @return {Object} - Public contact data
  *********************************************************************/
  toPublic: function (contact_data) {

    // Initialise
    const data = {};

    // Add email if present
    if (contact_data.email !== undefined) {
      data.email = contact_data.email;
    }

    // Add phone if present
    if (contact_data.phone_country !== undefined) {
      data.phone_country = contact_data.phone_country;
      data.phone_number = contact_data.phone_number;
    }

    // Add phone_id if present
    if (contact_data.phone_id !== undefined) {
      data.phone_id = contact_data.phone_id;
    }

    // Add address if present
    if (contact_data.address) {
      data.address = contact_data.address;
    }


    // Return
    return data;

  },


  /********************************************************************
  Transform to summary for list views

  @param {Object} contact_data - Full internal contact data

  @return {Object} - Minimal summary
  *********************************************************************/
  toSummary: function (contact_data) {

    // Return
    return {
      email: contact_data.email,
      phone_country: contact_data.phone_country,
      phone_number: contact_data.phone_number,
      phone_id: contact_data.phone_id,
      has_address: !!(contact_data.address && contact_data.address.line1)
    };

  },


  /********************************************************************
  Transform external input to internal canonical shape

  @param {Object} external_data - Raw external data

  @return {Object} - Canonical internal shape
  *********************************************************************/
  toInternal: function (external_data) {

    // Initialise components
    const email_data = ContactData.createEmail(external_data.email);
    const phone_data = ContactData.createPhone(
      external_data.phone_country,
      external_data.phone_number
    );
    let address_data = null;

    // Build address if provided
    if (external_data.address || external_data.line1) {
      address_data = ContactData.createAddress(
        external_data.line1 || (external_data.address && external_data.address.line1),
        external_data.line2 || (external_data.address && external_data.address.line2),
        external_data.city || (external_data.address && external_data.address.city),
        external_data.state || (external_data.address && external_data.address.state),
        external_data.postal_code || (external_data.address && external_data.address.postal_code),
        external_data.country || (external_data.address && external_data.address.country)
      );
    }


    // Return
    return ContactData.createContact(email_data, phone_data, address_data, external_data.contact_id);

  }

};////////////////////////////Public Functions END//////////////////////////////


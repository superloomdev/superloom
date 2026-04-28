// User entity data + DTO utilities
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
  return UserData;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const UserData = { // Public functions accessible by other modules

  /********************************************************************
  Create a new User data object with defaults and sanitization
  This is the canonical shape - used for creation and internal representation

  @param {Object} data - Raw user data
  @param {String} data.name - User full name
  @param {String} data.email - User email address
  @param {String} [data.phone] - User phone number
  @param {String} [data.role] - User role (default: 'user')
  @param {String} [data.status] - User status (default: 'active')

  @return {Object} - Canonical user data with defaults applied
  *********************************************************************/
  create: function (data) {

    // Initialise
    const user_data = {
      id: data.id || null,
      name: data.name ? data.name.trim() : null,
      email: data.email ? data.email.trim().toLowerCase() : null,
      phone: data.phone ? data.phone.trim() : null,
      role: data.role || CONFIG.DEFAULT_ROLE,
      status: data.status || CONFIG.DEFAULT_STATUS,
      created_at: Date.now(),
      updated_at: Date.now()
    };


    // Return
    return user_data;

  },


  /********************************************************************
  Create a partial update data object (only changed fields + updated_at)
  Used for PATCH operations - only includes fields that are provided

  @param {Object} data - Fields to update
  @param {String} [data.name] - Updated name
  @param {String} [data.email] - Updated email
  @param {String} [data.phone] - Updated phone
  @param {String} [data.status] - Updated status

  @return {Object} - Update data with only provided fields + updated_at
  *********************************************************************/
  createUpdate: function (data) {

    // Initialise
    const update = {};

    // Set fields if provided
    if (data.name !== undefined && data.name !== null) {
      update.name = data.name.trim();
    }

    if (data.email !== undefined && data.email !== null) {
      update.email = data.email.trim().toLowerCase();
    }

    if (data.phone !== undefined && data.phone !== null) {
      update.phone = data.phone.trim();
    }

    if (data.status !== undefined && data.status !== null) {
      update.status = data.status;
    }

    update.updated_at = Date.now();


    // Return
    return update;

  },


  /********************************************************************
  Create deep user data with nested structures
  Used when user is part of a larger aggregate (order, survey response, etc.)

  @param {Object} user_data - Core user data
  @param {Object} [contact_data] - Associated contact data (email, phone, address)
  @param {Object} [preferences] - User preferences
  @param {Object} [metadata] - System metadata (created_by, source, etc.)

  @return {Object} - User deep data with nested structures
  *********************************************************************/
  createDeep: function (user_data, contact_data, preferences, metadata) {

    // Return
    return {
      user_data: user_data,
      contact_data: contact_data || {},
      preferences: preferences || {},
      metadata: metadata || {}
    };

  },


  /********************************************************************
  Transform to public output (strips server-only fields)
  Safe for API responses - removes internal timestamps and metadata

  @param {Object} user_data - Full internal user data

  @return {Object} - Public-safe user data
  *********************************************************************/
  toPublic: function (user_data) {

    // Initialise
    const public_data = {
      id: user_data.id,
      name: user_data.name,
      email: user_data.email,
      phone: user_data.phone,
      role: user_data.role,
      status: user_data.status,
      created_at: user_data.created_at
    };


    // Return
    return public_data;

  },


  /********************************************************************
  Transform to summary for list views (minimal fields)
  Used in user lists, dropdowns, references

  @param {Object} user_data - Full internal user data

  @return {Object} - Minimal summary for lists
  *********************************************************************/
  toSummary: function (user_data) {

    // Return
    return {
      id: user_data.id,
      name: user_data.name,
      email: user_data.email,
      status: user_data.status
    };

  },


  /********************************************************************
  Transform external input to internal canonical shape
  Used when receiving data from external sources (APIs, imports, etc.)

  @param {Object} external_data - Raw external data
  @param {String} external_data.name - User name
  @param {String} external_data.email - User email
  @param {String} [external_data.phone] - User phone

  @return {Object} - Canonical internal shape (calls create)
  *********************************************************************/
  toInternal: function (external_data) {

    // Transform external shape to internal canonical shape
    // This is where field mapping happens (e.g., external 'userName' -> internal 'name')

    // Return
    return UserData.create({
      name: external_data.name || external_data.userName,
      email: external_data.email || external_data.userEmail,
      phone: external_data.phone || external_data.userPhone,
      role: external_data.role,
      status: external_data.status
    });

  }

};////////////////////////////Public Functions END//////////////////////////////

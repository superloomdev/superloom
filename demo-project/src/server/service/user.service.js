// Info: User Core Module - Business logic and orchestration for User entity
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib = {};

// Runtime config (injected; resolved app config)
let Config = {};


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib + Config for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - resolved app configuration
  @return {void}
  *********************************************************************/
const loader = function (shared_libs, config) {

  Lib = shared_libs;
  Config = config;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  // Run module-scope loader (local DI)
  loader(shared_libs, config);

  // Return Public Functions of this module
  return UserCore;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const UserCore = {

  /********************************************************************
  Create a new User

  @param {Object} data - Validated create input data object
  @param {String} data.name - User full name
  @param {String} data.email - User email address
  @param {String} [data.phone] - (Optional) User phone number
  @param {String} [data.role] - (Optional) User role

  @return {Object} result - { success: true, data: user } or { success: false, error: error }
  *********************************************************************/
  createUser: async function (data) {

    // Business rule: check if email already exists (via DB helper)
    // const existing = await Lib.DB.queryRecords('users', { email: data.email });
    // if (existing && existing.length > 0) {
    //   return { success: false, error: Lib.User.errors.EMAIL_ALREADY_EXISTS };
    // }


    // Build data object using model
    const user_data = Lib.User.data.create(data);


    // Persist to database (via DB helper)
    // var record = await Lib.DB.addRecord('users', user_data);


    // Placeholder: simulate persisted record with an ID
    const record = { ...user_data, id: 'usr_' + Date.now().toString(36) };


    // Return structured result
    return { success: true, data: record };

  },


  /********************************************************************
  Get User by ID

  @param {String} id - User ID

  @return {Object} result - { success: true, data: user } or { success: false, error: error }
  *********************************************************************/
  getUserById: async function (id) {

    // Fetch from database (via DB helper)
    // var record = await Lib.DB.getRecord('users', { id: id });


    // Placeholder: simulate a not-found scenario
    const record = null;

    if (!record) {
      return { success: false, error: Lib.User.errors.NOT_FOUND };
    }


    // Return
    return { success: true, data: record };

  },


  /********************************************************************
  Update User

  @param {Object} data - Validated update input data object
  @param {String} data.id - User ID
  @param {String} [data.name] - Updated name
  @param {String} [data.email] - Updated email
  @param {String} [data.phone] - Updated phone
  @param {String} [data.status] - Updated status

  @return {Object} result - { success: true, data: user } or { success: false, error: error }
  *********************************************************************/
  updateUser: async function (data) {

    // Verify user exists
    // var existing = await Lib.DB.getRecord('users', { id: data.id });
    // if (!existing) {
    //   return { success: false, error: Lib.User.errors.NOT_FOUND };
    // }


    // Build update shape using model
    const update_data = Lib.User.data.createUpdate(data);


    // Persist update to database (via DB helper)
    // var record = await Lib.DB.updateRecord('users', { id: data.id }, update_data);


    // Placeholder: simulate updated record
    const record = { id: data.id, ...update_data };


    // Return
    return { success: true, data: record };

  }

};///////////////////////////Public Functions END///////////////////////////////

// Info: User Controller Module - Thin adapter between interfaces and core
// Handles sanitization, validation via Model, Data creation, and delegates to Core
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib = {};
let Config = {};



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib + Config for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - entity config from model
  @return {void}
  *********************************************************************/
const loader = function (shared_libs, config) {

  Lib = shared_libs;
  Config = config;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const UserController = {

  /********************************************************************
  Create a new User

  @param {Object} request - Standardized request object
  @param {Object} request.body - Request body
  @param {String} request.body.name - User full name
  @param {String} request.body.email - User email address
  @param {String} [request.body.phone] - (Optional) User phone number
  @param {String} [request.body.role] - (Optional) User role

  @return {Object} - Standardized response object
  *********************************************************************/
  create: async function (request) {

    // Step 1: Extract and trim input from request body
    const input = {
      name: request.body.name,
      email: request.body.email,
      phone: request.body.phone,
      role: request.body.role
    };


    // Step 2: Validate using Model (shared validation - same for Express and Lambda)
    const validation_errors = Lib.User.validation.validateCreate(input);
    if (validation_errors) {
      return Lib.Functions.errorResponse(validation_errors[0], validation_errors[0].status);
    }


    // Step 3: Build Data using Model (one complete data structure)
    const data = Lib.User.data.create(input);


    // Step 4: Delegate to Service
    const result = await Lib.User.service.createUser(data);


    // Step 5: Handle error
    if (!result.success) {
      return Lib.Functions.errorResponse(result.error, result.error.status);
    }

    // Step 6: Return success response with public data
    return Lib.Functions.successResponse(
      Lib.User.data.toPublic(result.data),
      201
    );

  },


  /********************************************************************
  Get User by ID

  @param {Object} request - Standardized request object
  @param {Object} request.params - URL parameters
  @param {String} request.params.id - User ID

  @return {Object} - Standardized response object
  *********************************************************************/
  getById: async function (request) {

    // Step 1: Extract ID from params
    const id = request.params.id;


    // Step 2: Validate required param
    if (!id) {
      return Lib.Functions.errorResponse(Lib.User.errors.ID_REQUIRED, 400);
    }


    // Step 3: Delegate to Service
    const result = await Lib.User.service.getUserById(id);


    // Step 4: Handle error
    if (!result.success) {
      return Lib.Functions.errorResponse(result.error, result.error.status);
    }

    // Step 5: Return success response with public data
    return Lib.Functions.successResponse(
      Lib.User.data.toPublic(result.data)
    );

  },


  /********************************************************************
  Update User

  @param {Object} request - Standardized request object
  @param {Object} request.params - URL parameters
  @param {String} request.params.id - User ID
  @param {Object} request.body - Fields to update

  @return {Object} - Standardized response object
  *********************************************************************/
  update: async function (request) {

    // Step 1: Extract input
    const id = request.params.id;
    const input = {
      name: request.body.name,
      email: request.body.email,
      phone: request.body.phone,
      status: request.body.status
    };


    // Step 2: Validate required param
    if (!id) {
      return Lib.Functions.errorResponse(Lib.User.errors.ID_REQUIRED, 400);
    }


    // Step 3: Validate using Model
    const validation_errors = Lib.User.validation.validateUpdate(input);
    if (validation_errors) {
      return Lib.Functions.errorResponse(validation_errors[0], validation_errors[0].status);
    }


    // Step 4: Build update shape using Model
    const update_data = Lib.User.data.createUpdate(input);
    update_data.id = id;


    // Step 5: Delegate to Service
    const result = await Lib.User.service.updateUser(update_data);


    // Step 6: Handle error
    if (!result.success) {
      return Lib.Functions.errorResponse(result.error, result.error.status);
    }

    // Step 7: Return success response with public data
    return Lib.Functions.successResponse(
      Lib.User.data.toPublic(result.data)
    );

  }

};///////////////////////////Public Functions END///////////////////////////////



//////////////////////////////Module Exports START//////////////////////////////
module.exports = function (shared_libs, config) {

  // Run module-scope loader (local DI)
  loader(shared_libs, config);

  // Return Public Functions of this module
  return UserController;

};/////////////////////////////Module Exports END///////////////////////////////

// Info: Server bootstrap and dependency injection root
// Loads all dependencies, merges config with environment, builds Lib and Config
// Pattern: Load entities in dependency order, each entity completes all layers before next
// Progressive buildup: Lib.Entity = { data, errors, process, validation, service, controller }
'use strict';


/********************************************************************
Load all dependencies, merge configuration, and build runtime objects

@return {Object} result - Runtime objects
@return {Object} result.Lib - Dependency container with all loaded modules
@return {Object} result.Config - Fully resolved application configuration
*********************************************************************/
module.exports = async function loader () {

  // ========================= CONFIGURATION ========================= //

  // Load static config
  const static_config = require('./config');

  // Merge static config with environment variables (env overrides static)
  const Config = {
    ...static_config,
    PORT: process.env.PORT || static_config.PORT,
    NODE_ENV: process.env.NODE_ENV || static_config.NODE_ENV,
    database: {
      ...static_config.database,
      host: process.env.DB_HOST || static_config.database.host,
      port: process.env.DB_PORT || static_config.database.port,
      name: process.env.DB_NAME || static_config.database.name,
      user: process.env.DB_USER || static_config.database.user,
      password: process.env.DB_PASSWORD || static_config.database.password
    },
    aws_s3: {
      ...static_config.aws_s3,
      region: process.env.AWS_REGION || static_config.aws_s3.region,
      bucket: process.env.AWS_S3_BUCKET || static_config.aws_s3.bucket
    },
    auth: {
      ...static_config.auth,
      token_secret: process.env.AUTH_TOKEN_SECRET || static_config.auth.token_secret,
      token_expiry: process.env.AUTH_TOKEN_EXPIRY || static_config.auth.token_expiry
    },
    debug: {
      ...static_config.debug,
      ENVIRONMENT: process.env.NODE_ENV || static_config.debug.ENVIRONMENT
    }
  };


  // Sub-configs: each helper module receives ONLY its relevant config slice
  const config_debug = {
    LOG_LEVEL: Config.debug.LOG_LEVEL,
    LOG_FORMAT: Config.debug.LOG_FORMAT,
    INCLUDE_STACK_TRACE: Config.debug.INCLUDE_STACK_TRACE,
    INCLUDE_MEMORY_USAGE: Config.debug.INCLUDE_MEMORY_USAGE,
    APP_NAME: Config.debug.APP_NAME,
    ENVIRONMENT: Config.debug.ENVIRONMENT
  };

  // var config_database = { ...Config.database };
  // var config_aws_s3 = { ...Config.aws_s3 };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== HELPER MODULES ============================= //
  // Helper modules are platform-agnostic utilities shared across all entities.
  // Each receives Lib + ONLY its relevant sub-config (no full Config access).

  Lib.Utils = require('@superloomdev/js-helper-utils')();
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);


  // ==================== SERVER HELPER MODULES ====================== //
  // Server-only helpers (DB wrappers, Cloud SDK wrappers).
  // Each receives Lib + ONLY its relevant sub-config.

  // Lib.DB = require('@superloomdev/js-server-helper-sql-postgres')(Lib, config_database);
  // Lib.S3 = require('@superloomdev/js-server-helper-storage-aws-s3')(Lib, config_aws_s3);


  // ==================== ENTITY NAMESPACES START ====================== //
  // Entities loaded in dependency order (independent first)
  // Each entity builds completely: model -> core -> controller

  // Load model packages (non-executed; each entity executed individually)
  const Models = require('../../model');
  const ModelsExtended = require('../../model-server');

  // Contact: Depends on none. Used by User, Survey
  // Loads: { data, errors, process, validation, _config }
  const ContactModel = Models.Contact(Lib, {});
  Lib.Contact = {
    data: ContactModel.data,
    errors: ContactModel.errors,
    process: ContactModel.process,
    validation: ContactModel.validation
  };
  Lib.Contact.service = require('../service/contact.service')(Lib, ContactModel._config);
  Lib.Contact.controller = require('../controller/contact.controller')(Lib, ContactModel._config);


  // User: Depends on Contact. Used by Survey
  // Loads: { data, errors, process, validation, _config }
  const UserModel = Models.User(Lib, {});
  Lib.User = {
    data: UserModel.data,
    errors: UserModel.errors,
    process: UserModel.process,
    validation: UserModel.validation
  };
  Lib.User.service = require('../service/user.service')(Lib, UserModel._config);
  Lib.User.controller = require('../controller/user.controller')(Lib, UserModel._config);


  // Survey: Depends on Contact, User. Used by none
  // Loads: { data, errors, process, validation, _config }
  const SurveyModel = Models.Survey(Lib, {});
  Lib.Survey = {
    data: SurveyModel.data,
    errors: SurveyModel.errors,
    process: SurveyModel.process,
    validation: SurveyModel.validation
  };
  const SurveyModelExtended = ModelsExtended.Survey(Lib, {});
  Lib.Survey = { /* extended merges into base, key-by-key */
    data: { ...Lib.Survey.data, ...SurveyModelExtended.data },
    errors: { ...Lib.Survey.errors, ...SurveyModelExtended.errors },
    process: { ...Lib.Survey.process, ...SurveyModelExtended.process },
    validation: { ...Lib.Survey.validation, ...SurveyModelExtended.validation }
  };
  const SurveyConfig = { ...SurveyModel._config, ...SurveyModelExtended._config };
  Lib.Survey.service = require('../service/survey.service')(Lib, SurveyConfig);
  Lib.Survey.controller = require('../controller/survey.controller')(Lib, SurveyConfig);


  // Shared: Aggregates reusable logic contributed by multiple entities
  // Loaded last as it may reference any entity; may also have server extensions
  const SharedModel = Models.Shared(Lib, {});
  Lib.Shared = {
    data: SharedModel.data,
    errors: SharedModel.errors,
    process: SharedModel.process,
    validation: SharedModel.validation,
    config: SharedModel.config  // Public config (Shared is special)
  };
  const SharedModelExtended = ModelsExtended.Shared(Lib, {});
  Lib.Shared = { /* extended merges into base, key-by-key */
    data: { ...Lib.Shared.data, ...SharedModelExtended.data },
    errors: { ...Lib.Shared.errors, ...SharedModelExtended.errors },
    process: { ...Lib.Shared.process, ...SharedModelExtended.process },
    validation: { ...Lib.Shared.validation, ...SharedModelExtended.validation },
    config: Lib.Shared.config  // Preserve public config
  };
  const SharedConfig = { ...SharedModel._config, ...SharedModelExtended._config };
  Lib.Shared.service = require('../service/shared.service')(Lib, SharedConfig);
  Lib.Shared.controller = require('../controller/shared.controller')(Lib, SharedConfig);


  // Return runtime objects
  return { Lib, Config };

};

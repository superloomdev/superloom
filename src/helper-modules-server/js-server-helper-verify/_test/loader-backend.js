// Info: Test loader for js-server-helper-verify with one storage helper
// attached. Selects the helper based on `BACKEND_KIND` (sqlite | postgres |
// mysql | mongodb | dynamodb). process.env is read ONLY here.
'use strict';


/********************************************************************
Build a dependency container plus the chosen storage helper.

Environment variables (read here, nowhere else):
  BACKEND_KIND          - 'sqlite' | 'postgres' | 'mysql' | 'mongodb' | 'dynamodb'
  POSTGRES_HOST / PORT / DATABASE / USER / PASSWORD
  MYSQL_HOST    / PORT / DATABASE / USER / PASSWORD
  MONGO_URL             - full MongoDB connection URI
  MONGO_DATABASE        - default 'test_db'
  DYNAMO_ENDPOINT       - e.g. http://127.0.0.1:8000
  AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY

@return {Object} - { Lib, kind }
*********************************************************************/
module.exports = function loader () {

  const kind = process.env.BACKEND_KIND || 'sqlite';

  const config_debug = { LOG_LEVEL: 'error' };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== FOUNDATION MODULES ========================= //

  Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, config_debug);
  Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});


  // ==================== STORAGE HELPER ============================== //

  switch (kind) {

    case 'sqlite': {
      Lib.SQLite = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, {
        FILE: ':memory:'
      });
      break;
    }

    case 'postgres': {
      Lib.Postgres = require('@superloomdev/js-server-helper-sql-postgres')(Lib, {
        HOST: process.env.POSTGRES_HOST,
        PORT: parseInt(process.env.POSTGRES_PORT, 10),
        DATABASE: process.env.POSTGRES_DATABASE,
        USER: process.env.POSTGRES_USER,
        PASSWORD: process.env.POSTGRES_PASSWORD,
        POOL_MAX: 5
      });
      break;
    }

    case 'mysql': {
      Lib.MySQL = require('@superloomdev/js-server-helper-sql-mysql')(Lib, {
        HOST: process.env.MYSQL_HOST,
        PORT: parseInt(process.env.MYSQL_PORT, 10),
        DATABASE: process.env.MYSQL_DATABASE,
        USER: process.env.MYSQL_USER,
        PASSWORD: process.env.MYSQL_PASSWORD,
        POOL_MAX: 5
      });
      break;
    }

    case 'mongodb': {
      Lib.MongoDB = require('@superloomdev/js-server-helper-nosql-mongodb')(Lib, {
        CONNECTION_STRING: process.env.MONGO_URL,
        DATABASE_NAME: process.env.MONGO_DATABASE || 'test_db',
        MAX_POOL_SIZE: 5,
        SERVER_SELECTION_TIMEOUT: 5000
      });
      break;
    }

    case 'dynamodb': {
      Lib.DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
        ENDPOINT: process.env.DYNAMO_ENDPOINT,
        REGION: process.env.AWS_REGION || 'us-east-1'
      });
      break;
    }

    default:
      throw new Error('[test-loader] BACKEND_KIND must be sqlite|postgres|mysql|mongodb|dynamodb, got: ' + kind);

  }


  return { Lib: Lib, kind: kind };

};

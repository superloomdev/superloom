// Info: Express server startup script
// Runs the loader, initializes Express app, and starts listening
'use strict';


/********************************************************************
Start the Express server

Loads all dependencies via the server loader, initializes the Express
application with routes, and begins listening on the configured port.

Usage: node server.js
*********************************************************************/
const start = async function () {

  // Step 1: Run the server loader to build Lib and Config
  const loader = require('../../../common/loader');
  const { Lib, Config } = await loader();


  // Step 2: Add shared functions to Lib
  Lib.Functions = require('../../../common/functions');


  // Step 3: Initialize Express app with loaded dependencies
  const initApp = require('./app');
  const app = initApp(Lib, Config);


  // Step 4: Start listening
  const port = Config.PORT || 3000;
  app.listen(port, function () {

    Lib.Debug.log(`Server started on port ${port} [${Config.NODE_ENV}]`);

  });

};


// Run
start().catch(function (err) {

  console.error('Failed to start server:', err);
  process.exit(1);

});

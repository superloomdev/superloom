// Info: Express application entry point for Docker/self-hosted deployment
// Converts Express request format to standardized request, calls shared controller
'use strict';

const express = require('express');



/********************************************************************
Initialize Express application with loaded dependencies

@param {Object} Lib - Dependency container from loader
@param {Object} Config - Resolved application configuration

@return {Object} app - Express application instance
*********************************************************************/
const initApp = function (Lib, Config) {

  // Create Express app
  const app = express();


  // Middleware: Parse JSON body
  app.use(express.json());


  // Middleware: Parse URL-encoded body
  app.use(express.urlencoded({ extended: true }));


  // Load routes
  const userRoutes = require('./routes/user')(Lib);
  const surveyRoutes = require('./routes/survey')(Lib);
  app.use('/user', userRoutes);
  app.use('/survey', surveyRoutes);


  // Health check endpoint
  app.get('/health', function (req, res) {

    res.status(200).json({ status: 'ok', source: 'express' });

  });


  // 404 handler
  app.use(function (req, res) {

    res.status(404).json(
      Lib.Functions.errorResponse({ code: 'NOT_FOUND', message: 'Route not found' }, 404)
    );

  });


  // Global error handler
  app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars

    Lib.Debug.error('Express global error handler', err);

    res.status(500).json(
      Lib.Functions.errorResponse({ code: 'INTERNAL_ERROR', message: 'Internal server error' }, 500)
    );

  });


  return app;

};


module.exports = initApp;

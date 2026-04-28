// Info: Express routes for User entity
// Converts Express request to standardized format and calls shared controller
'use strict';

const express = require('express');
const Functions = require('../../../../common/functions');



/********************************************************************
Initialize User routes

@param {Object} Lib - Dependency container from loader

@return {Object} router - Express Router with user routes
*********************************************************************/
const initRoutes = function (Lib) {

  const router = express.Router();


  /********************************************************************
  POST /user/create - Create a new user
  *********************************************************************/
  router.post('/create', async function (req, res) {

    // Convert Express request to standard format
    const standard_request = Functions.buildStandardRequest({
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      body: req.body,
      headers: req.headers,
      auth: req.auth || {},
      request_id: req.headers['x-request-id'],
      source: 'express'
    });

    // Call shared controller
    const result = await Lib.UserController.create(standard_request);

    // Send response
    res.status(result.status).json(result);

  });


  /********************************************************************
  GET /user/:id - Get user by ID
  *********************************************************************/
  router.get('/:id', async function (req, res) {

    // Convert Express request to standard format
    const standard_request = Functions.buildStandardRequest({
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      body: req.body,
      headers: req.headers,
      auth: req.auth || {},
      request_id: req.headers['x-request-id'],
      source: 'express'
    });

    // Call shared controller
    const result = await Lib.UserController.getById(standard_request);

    // Send response
    res.status(result.status).json(result);

  });


  /********************************************************************
  PUT /user/:id - Update user
  *********************************************************************/
  router.put('/:id', async function (req, res) {

    // Convert Express request to standard format
    const standard_request = Functions.buildStandardRequest({
      method: req.method,
      path: req.path,
      params: { ...req.params },
      query: req.query,
      body: req.body,
      headers: req.headers,
      auth: req.auth || {},
      request_id: req.headers['x-request-id'],
      source: 'express'
    });

    // Call shared controller
    const result = await Lib.UserController.update(standard_request);

    // Send response
    res.status(result.status).json(result);

  });


  return router;

};


module.exports = initRoutes;

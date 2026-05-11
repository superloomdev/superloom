// Info: Express routes for Survey entity
// Converts Express request to standardized format and calls shared controller
'use strict';

const express = require('express');
const Functions = require('../../../../common/functions');



/********************************************************************
Initialize Survey routes

@param {Object} Lib - Dependency container from loader

@return {Object} router - Express Router with survey routes
*********************************************************************/
const initRoutes = function (Lib) {

  const router = express.Router();


  /********************************************************************
  POST /survey/create - Create a new survey
  *********************************************************************/
  router.post('/create', async function (req, res) {

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

    const result = await Lib.SurveyController.create(standard_request);
    res.status(result.status).json(result);

  });


  /********************************************************************
  GET /survey/:id - Get survey by ID
  *********************************************************************/
  router.get('/:id', async function (req, res) {

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

    const result = await Lib.SurveyController.getById(standard_request);
    res.status(result.status).json(result);

  });


  /********************************************************************
  PUT /survey/:id - Update survey
  *********************************************************************/
  router.put('/:id', async function (req, res) {

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

    const result = await Lib.SurveyController.update(standard_request);
    res.status(result.status).json(result);

  });


  return router;

};


module.exports = initRoutes;

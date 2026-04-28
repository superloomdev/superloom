// Info: Configuration for js-server-helper-mongodb
'use strict';


module.exports = {

  // Connection URI (preferred) or build from components
  URI: process.env.MONGODB_URI || '',

  // Connection components (if URI not provided)
  HOST: process.env.MONGODB_HOST || 'localhost',
  PORT: process.env.MONGODB_PORT || 27017,
  HOSTS: process.env.MONGODB_HOSTS || '', // For replica sets: 'host1:port1,host2:port2'
  DATABASE: process.env.MONGODB_DATABASE || 'test',
  USER: process.env.MONGODB_USER || '',
  PASSWORD: process.env.MONGODB_PASSWORD || '',
  OPTIONS: process.env.MONGODB_OPTIONS || '', // e.g., 'replicaSet=rs0&ssl=true'

  // Pool settings
  POOL_MAX: parseInt(process.env.MONGODB_POOL_MAX, 10) || 10,
  POOL_MIN: parseInt(process.env.MONGODB_POOL_MIN, 10) || 2,
  POOL_IDLE_TIMEOUT: parseInt(process.env.MONGODB_POOL_IDLE_TIMEOUT, 10) || 30000

};

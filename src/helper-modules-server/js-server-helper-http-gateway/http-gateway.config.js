// Info: Configuration defaults for js-server-helper-http-gateway.
// ADAPTER is required at construction time. All other keys have sensible
// defaults. The loader throws if ADAPTER is still null at startup.
'use strict';


module.exports = {

  // Adapter factory function. Pass the result of require() for the chosen
  // adapter package - the same way you pass STORE for auth.
  //   ADAPTER: require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway')
  //   ADAPTER: require('@superloomdev/js-server-helper-http-gateway-adapter-express')
  // Required.
  ADAPTER: null,

  // Per-adapter configuration. Shape varies by ADAPTER - the chosen adapter's
  // factory validates its own required keys. Pass null or {} if the adapter
  // needs no extra options.
  // Optional.
  ADAPTER_CONFIG: null

};

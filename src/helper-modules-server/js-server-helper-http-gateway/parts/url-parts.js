// Info: URL parsing utilities for js-server-helper-http-gateway.
// Thin wrapper around the tldts npm package that exposes a normalized
// url-parts object. All functions are adapter-agnostic.
//
// Singleton: pure URL-string transformation with no per-caller state or
// config. Node.js require cache guarantees the same UrlParts object is
// returned on every subsequent require. No factory needed.
'use strict';


// URL parsing library (npm: tldts). Module-scope const — loaded once.
const UrlParser = require('tldts');

// Shared dependencies injected by loader (uniform parts signature)
let Lib; // eslint-disable-line no-unused-vars
let CONFIG; // eslint-disable-line no-unused-vars
let ERRORS; // eslint-disable-line no-unused-vars


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib, CONFIG, and ERRORS and returns the
module-scope UrlParts object directly. All three are accepted for
signature uniformity with other parts — none are consumed today.

@param {Object} shared_libs - Dependency container (Utils, Debug)
@param {Object} config      - Merged module configuration
@param {Object} errors      - Module error catalog

@return {Object} - Public UrlParts interface
*********************************************************************/
module.exports = function loader (shared_libs, config, errors) {

  // Assign to module-scope vars so public and private objects can close over them
  Lib = shared_libs;
  CONFIG = config;
  ERRORS = errors;

  return UrlParts;

};///////////////////////////// Module-Loader END ///////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const UrlParts = {

  /********************************************************************
  Extract the component parts of a URL.

  Examples:
    'http://www.abc.example.co.uk:8080/path'
    -> { sub_domain: 'www.abc', domain: 'example.co.uk',
         domain_without_tld: 'example', tld: 'co.uk',
         hostname: 'www.abc.example.co.uk', is_ip: false }

  @param {String} url - Full URL string to parse

  @return {Object} - Parsed URL components
    @param {String}  sub_domain          - Subdomain portion ('www.abc')
    @param {String}  domain              - Full domain with TLD ('example.co.uk')
    @param {String}  domain_without_tld  - Domain name without TLD ('example')
    @param {String}  tld                 - Public suffix / TLD ('co.uk')
    @param {String}  hostname            - Full hostname ('www.abc.example.co.uk')
    @param {Boolean} is_ip               - true when URL is an IP address
  *********************************************************************/
  getUrlParts: function (url) {

    const parsed = UrlParser.parse(url);

    return {
      sub_domain: parsed.subdomain,
      domain: parsed.domain,
      domain_without_tld: parsed.domainWithoutSuffix,
      tld: parsed.publicSuffix,
      hostname: parsed.hostname,
      is_ip: parsed.isIp
    };

  }

};
////////////////////////////Public Functions END//////////////////////////////

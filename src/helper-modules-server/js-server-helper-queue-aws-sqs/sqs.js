// Info: AWS SQS message queue wrapper. Send, receive, delete, and schedule messages.
// Server-only: uses AWS SDK v3 SQS client with explicit credential injection.
//
// Compatibility: Node.js 20.19+.
//
// Factory pattern: each loader call returns an independent SQS interface
// with its own Lib, CONFIG, and per-instance SQS client.
//
// Lazy-loaded AWS SDK v3 adapter (stateless, shared across instances):
//   - '@aws-sdk/client-sqs' -> SQSClient class + Commands
'use strict';

// Shared stateless SDK adapter (module-level - require() is cached anyway).
let SQSAdapter = null;



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
Lib, CONFIG, and SQS client.

@param {Object} shared_libs - Lib container with Utils, Debug, Instance
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug,
    Instance: shared_libs.Instance
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./sqs.config'),
    config || {}
  );

  // Mutable per-instance state (SQS client and queue URL cache live here)
  const state = {
    client: null,
    queue_urls: {}
  };

  // Create and return the public interface
  return createInterface(Lib, CONFIG, state);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib, CONFIG, and state.

@param {Object} Lib - Dependency container (Utils, Debug, Instance)
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} state - Mutable state holder (SQS client, queue URL cache)

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, state) {

  ///////////////////////////Public Functions START//////////////////////////////
  const SQS = {

    /********************************************************************
    Send a message to a queue.

    @param {Object} instance - Request lifecycle instance (from Instance.initialize)
    @param {String} queue_name - Queue name (not URL)
    @param {Object} message - Message body (will be JSON stringified)
    @param {Object} [options] - Send options
    @param {Integer} [options.delay_seconds] - Delay before message becomes visible (0-900)
    @param {String} [options.message_group_id] - Group ID for FIFO queues

    @return {Promise<Object>} - { success, message_id, error }
    *********************************************************************/
    send: async function (instance, queue_name, message, options) {

      // Initialize SQS client on first use
      _SQS.initIfNot();

      // Record operation start time
      const start_ms = Date.now();

      try {

        // Resolve queue URL from name (cached after first lookup)
        const queue_url = await _SQS.getQueueUrl(queue_name);

        // Ensure options object exists
        const opts = options || {};

        // Create SQS SendMessage command params
        const params = {
          QueueUrl: queue_url,
          MessageBody: JSON.stringify(message)
        };

        // Add optional delay before message becomes visible
        if (!Lib.Utils.isNullOrUndefined(opts.delay_seconds)) {
          params.DelaySeconds = opts.delay_seconds;
        }

        // Add FIFO queue group ID if provided
        if (!Lib.Utils.isNullOrUndefined(opts.message_group_id)) {
          params.MessageGroupId = opts.message_group_id;
        }

        // Execute SendMessage command
        const command = new SQSAdapter.SendMessageCommand(params);
        const response = await state.client.send(command);

        // Log successful send operation
        Lib.Debug.performanceAuditLog('SQS-Send', queue_name, start_ms, instance['time_ms']);

        // Return successful response with message ID
        return {
          success: true,
          message_id: response.MessageId,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('SQS send failed', { queue: queue_name, error: error.message });

        // Return error response
        return {
          success: false,
          message_id: null,
          error: {
            type: 'SEND_ERROR',
            message: error.message
          }
        };

      }

    },


    /********************************************************************
    Receive messages from a queue (polling).

    @param {Object} instance - Request lifecycle instance (from Instance.initialize)
    @param {String} queue_name - Queue name
    @param {Object} [options] - Receive options
    @param {Integer} [options.max_messages] - Max messages to receive (1-10, default: 10)
    @param {Integer} [options.visibility_timeout] - Visibility timeout in seconds
    @param {Integer} [options.wait_time_seconds] - Long polling wait time (0-20)

    @return {Promise<Object>} - { success, messages, error }
    *********************************************************************/
    receive: async function (instance, queue_name, options) {

      // Initialize SQS client on first use
      _SQS.initIfNot();

      // Record operation start time
      const start_ms = Date.now();

      try {

        // Resolve queue URL from name (cached after first lookup)
        const queue_url = await _SQS.getQueueUrl(queue_name);

        // Ensure options object exists
        const opts = options || {};

        // Create SQS ReceiveMessage command params
        const params = {
          QueueUrl: queue_url,
          MaxNumberOfMessages: opts.max_messages || 10,
          VisibilityTimeout: opts.visibility_timeout || CONFIG.DEFAULT_VISIBILITY_TIMEOUT,
          WaitTimeSeconds: opts.wait_time_seconds || 0
        };

        // Execute ReceiveMessage command
        const command = new SQSAdapter.ReceiveMessageCommand(params);
        const response = await state.client.send(command);

        // Transform raw SQS messages into clean output format
        const messages = [];
        if (response.Messages) {
          response.Messages.forEach(function (msg) {
            messages.push({
              message_id: msg.MessageId,
              receipt_handle: msg.ReceiptHandle,
              body: _SQS.parseBody(msg.Body),
              attributes: msg.Attributes || {}
            });
          });
        }

        // Log successful receive operation
        Lib.Debug.performanceAuditLog('SQS-Receive', queue_name + ' (' + messages.length + ')', start_ms, instance['time_ms']);

        // Return successful response with messages array
        return {
          success: true,
          messages: messages,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('SQS receive failed', { queue: queue_name, error: error.message });

        // Return error response
        return {
          success: false,
          messages: [],
          error: {
            type: 'RECEIVE_ERROR',
            message: error.message
          }
        };

      }

    },


    /********************************************************************
    Delete a message from queue after successful processing.

    @param {Object} instance - Request lifecycle instance (from Instance.initialize)
    @param {String} queue_name - Queue name
    @param {String} receipt_handle - Receipt handle from receive()

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    delete: async function (instance, queue_name, receipt_handle) {

      // Initialize SQS client on first use
      _SQS.initIfNot();

      // Record operation start time
      const start_ms = Date.now();

      try {

        // Resolve queue URL from name (cached after first lookup)
        const queue_url = await _SQS.getQueueUrl(queue_name);

        // Create SQS DeleteMessage command params
        const params = {
          QueueUrl: queue_url,
          ReceiptHandle: receipt_handle
        };

        // Execute DeleteMessage command
        const command = new SQSAdapter.DeleteMessageCommand(params);
        await state.client.send(command);

        // Log successful delete operation
        Lib.Debug.performanceAuditLog('SQS-Delete', queue_name, start_ms, instance['time_ms']);

        // Return successful response
        return {
          success: true,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('SQS delete failed', { queue: queue_name, error: error.message });

        // Return error response
        return {
          success: false,
          error: {
            type: 'DELETE_ERROR',
            message: error.message
          }
        };

      }

    },


    /********************************************************************
    Send a delayed message (scheduled for future delivery).

    @param {Object} instance - Request lifecycle instance (from Instance.initialize)
    @param {String} queue_name - Queue name
    @param {Object} message - Message body (will be JSON stringified)
    @param {Integer} delay_seconds - Delay in seconds before message becomes visible (0-900)

    @return {Promise<Object>} - { success, message_id, error }
    *********************************************************************/
    sendDelayed: async function (instance, queue_name, message, delay_seconds) {

      // Delegate to send with delay option
      return await SQS.send(instance, queue_name, message, { delay_seconds: delay_seconds });

    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START/////////////////////////////
  const _SQS = {

    /********************************************************************
    Lazy-load the AWS SDK v3 SQS adapter. Shared across every instance
    because the SDK module is stateless - only the SQS client holds
    per-instance state.

    @return {void}
    *********************************************************************/
    ensureAdapter: function () {

      // Load SQS client and commands into module-level cache
      if (Lib.Utils.isNullOrUndefined(SQSAdapter)) {
        SQSAdapter = require('@aws-sdk/client-sqs');
      }

    },


    /********************************************************************
    Create this instance's SQS client on first use. Options are built
    from the merged CONFIG; explicit credentials and custom endpoint
    (for ElasticMQ) are injected if present.

    @return {void}
    *********************************************************************/
    initIfNot: function () {

      // Already built
      if (!Lib.Utils.isNullOrUndefined(state.client)) {
        return;
      }

      // Adapter must be loaded before client creation
      _SQS.ensureAdapter();

      Lib.Debug.performanceAuditLog('Init-Start', 'SQS Client', Date.now());

      // Base client options - region and retry config
      const client_options = {
        region: CONFIG.REGION,
        maxAttempts: CONFIG.MAX_RETRIES
      };

      // Inject explicit credentials if provided via config
      if (!Lib.Utils.isNullOrUndefined(CONFIG.KEY) && !Lib.Utils.isNullOrUndefined(CONFIG.SECRET)) {
        client_options.credentials = {
          accessKeyId: CONFIG.KEY,
          secretAccessKey: CONFIG.SECRET
        };
      }

      // Set custom endpoint for ElasticMQ (emulated testing)
      if (!Lib.Utils.isNullOrUndefined(CONFIG.ENDPOINT)) {
        client_options.endpoint = CONFIG.ENDPOINT;
      }

      // Build SQS client
      state.client = new SQSAdapter.SQSClient(client_options);

      Lib.Debug.performanceAuditLog('Init-End', 'SQS Client', Date.now());
      Lib.Debug.debug('SQS Client Initialized', {
        region: CONFIG.REGION,
        endpoint: CONFIG.ENDPOINT || null
      });

    },


    /********************************************************************
    Resolve queue URL from queue name. Caches resolved URLs in per-instance
    state to avoid repeated API calls.

    If QUEUE_URL_PREFIX is configured, the URL is constructed directly.
    Otherwise, the GetQueueUrl API is called and the result is cached.

    @param {String} queue_name - Queue name
    @return {Promise<String>} - Resolved queue URL
    *********************************************************************/
    getQueueUrl: async function (queue_name) {

      // Return cached URL if already resolved
      if (state.queue_urls[queue_name]) {
        return state.queue_urls[queue_name];
      }

      // Construct URL from prefix if configured
      if (!Lib.Utils.isNullOrUndefined(CONFIG.QUEUE_URL_PREFIX) && CONFIG.QUEUE_URL_PREFIX !== '') {
        const url = CONFIG.QUEUE_URL_PREFIX + queue_name;
        state.queue_urls[queue_name] = url;
        return url;
      }

      // Look up queue URL via SQS API
      const command = new SQSAdapter.GetQueueUrlCommand({ QueueName: queue_name });
      const response = await state.client.send(command);

      // Cache the resolved URL
      state.queue_urls[queue_name] = response.QueueUrl;

      return response.QueueUrl;

    },


    /********************************************************************
    Parse message body from JSON string. Returns the original string
    if parsing fails (non-JSON messages are supported).

    @param {String} body - Raw message body string
    @return {*} - Parsed object or original string
    *********************************************************************/
    parseBody: function (body) {

      try {
        return JSON.parse(body);
      }
      catch (e) { // eslint-disable-line no-unused-vars
        return body;
      }

    }

  };//////////////////////////Private Functions END/////////////////////////////



  // Return public interface
  return SQS;

};/////////////////////////// createInterface END ///////////////////////////////

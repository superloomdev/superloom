// Info: Canonical session record shape used internally by the module.
// Every store serializes this shape to its native on-disk layout and
// deserializes back. parts/policy.js operates exclusively on this shape.
//
// Field grouping:
//   - Identity:       tenant_id, actor_id, actor_type, token_key, token_secret_hash
//   - Refresh (JWT):  refresh_token_hash, refresh_family_id  (Phase 5; null in db_only mode)
//   - Lifecycle:      created_at, expires_at, last_active_at
//   - Install:        install_id, install_platform, install_form_factor (immutable)
//   - Client:         client_*  (last-known, mutable on throttled refresh)
//   - Push:           push_provider, push_token (forward-compat for notification module)
//   - Custom:         custom_data (project-owned envelope; auth never reads it)
'use strict';


module.exports = function (Lib) {


  ////////////////////////////// Public Methods START /////////////////////////////
  const RecordShape = {

    /********************************************************************
    Build a canonical record from named fields. Missing optional fields
    default to null (or false for booleans). Required fields trigger a
    TypeError if absent - those are programmer errors, not envelope errors.

    @param {Object} fields - Named field values

    @return {Object} - Canonical session record
    *********************************************************************/
    buildRecord: function (fields) {

      // Required identity
      RecordShape.assertRequiredString(fields, 'tenant_id');
      RecordShape.assertRequiredString(fields, 'actor_id');
      RecordShape.assertRequiredString(fields, 'actor_type');
      RecordShape.assertRequiredString(fields, 'token_key');
      RecordShape.assertRequiredString(fields, 'token_secret_hash');

      // Required lifecycle
      RecordShape.assertRequiredInteger(fields, 'created_at');
      RecordShape.assertRequiredInteger(fields, 'expires_at');
      RecordShape.assertRequiredInteger(fields, 'last_active_at');

      // Required install identity
      RecordShape.assertRequiredString(fields, 'install_platform');
      RecordShape.assertRequiredString(fields, 'install_form_factor');

      // Build the canonical shape - all fields explicit, nulls where appropriate
      return {

        // Identity
        tenant_id:           fields.tenant_id,
        actor_id:            fields.actor_id,
        actor_type:          fields.actor_type,
        token_key:           fields.token_key,
        token_secret_hash:   fields.token_secret_hash,

        // Refresh-token (Phase 5 - null in db_only mode)
        refresh_token_hash:  RecordShape.coerceNullable(fields.refresh_token_hash),
        refresh_family_id:   RecordShape.coerceNullable(fields.refresh_family_id),

        // Lifecycle
        created_at:          fields.created_at,
        expires_at:          fields.expires_at,
        last_active_at:      fields.last_active_at,

        // Install identity (immutable post-creation)
        install_id:          RecordShape.coerceNullable(fields.install_id),
        install_platform:    fields.install_platform,
        install_form_factor: fields.install_form_factor,

        // Client metadata (mutable on throttled refresh)
        client_name:         RecordShape.coerceNullable(fields.client_name),
        client_version:      RecordShape.coerceNullable(fields.client_version),
        client_is_browser:   RecordShape.coerceBoolean(fields.client_is_browser),
        client_os_name:      RecordShape.coerceNullable(fields.client_os_name),
        client_os_version:   RecordShape.coerceNullable(fields.client_os_version),
        client_screen_w:     RecordShape.coerceNullableInteger(fields.client_screen_w),
        client_screen_h:     RecordShape.coerceNullableInteger(fields.client_screen_h),
        client_ip_address:   RecordShape.coerceNullable(fields.client_ip_address),
        client_user_agent:   RecordShape.coerceNullable(fields.client_user_agent),

        // Push (forward-compat - written by attachDeviceToSession)
        push_provider:       RecordShape.coerceNullable(fields.push_provider),
        push_token:          RecordShape.coerceNullable(fields.push_token),

        // Custom envelope (project-owned)
        custom_data:         RecordShape.coerceNullable(fields.custom_data)

      };

    },


    /********************************************************************
    The list of canonical field names. Stores use this to know which keys
    must be serialized/deserialized. Order matches buildRecord.

    @return {String[]} - All canonical field names in order
    *********************************************************************/
    getFieldNames: function () {

      return [
        'tenant_id', 'actor_id', 'actor_type', 'token_key', 'token_secret_hash',
        'refresh_token_hash', 'refresh_family_id',
        'created_at', 'expires_at', 'last_active_at',
        'install_id', 'install_platform', 'install_form_factor',
        'client_name', 'client_version', 'client_is_browser',
        'client_os_name', 'client_os_version',
        'client_screen_w', 'client_screen_h',
        'client_ip_address', 'client_user_agent',
        'push_provider', 'push_token',
        'custom_data'
      ];

    }

  };//////////////////////////// Public Methods END //////////////////////////////


  ////////////////////////////// Helper Methods START /////////////////////////////

  /********************************************************************
  Throw TypeError if the named field is not a non-empty string.
  Used during record construction to catch programmer errors fast.

  @param {Object} fields - Named field values
  @param {String} key - Field name to check

  @return {void}
  *********************************************************************/
  RecordShape.assertRequiredString = function (fields, key) {

    if (
      Lib.Utils.isNullOrUndefined(fields[key]) ||
      !Lib.Utils.isString(fields[key]) ||
      Lib.Utils.isEmptyString(fields[key])
    ) {
      throw new TypeError('[js-server-helper-auth] record field ' + key + ' must be a non-empty string');
    }

  };


  /********************************************************************
  Throw TypeError if the named field is not an integer.

  @param {Object} fields - Named field values
  @param {String} key - Field name to check

  @return {void}
  *********************************************************************/
  RecordShape.assertRequiredInteger = function (fields, key) {

    if (
      Lib.Utils.isNullOrUndefined(fields[key]) ||
      !Lib.Utils.isNumber(fields[key]) ||
      !Lib.Utils.isInteger(fields[key])
    ) {
      throw new TypeError('[js-server-helper-auth] record field ' + key + ' must be an integer');
    }

  };


  /********************************************************************
  Map undefined/null/empty-string to null. Used for optional fields so
  the record always has explicit nulls, not undefined keys.

  @param {*} value - Field value

  @return {*} - The value, or null if undefined/null/empty
  *********************************************************************/
  RecordShape.coerceNullable = function (value) {

    if (Lib.Utils.isNullOrUndefined(value)) {
      return null;
    }

    if (Lib.Utils.isString(value) && Lib.Utils.isEmptyString(value)) {
      return null;
    }

    return value;

  };


  /********************************************************************
  Map undefined to false; otherwise pass-through (already boolean).

  @param {*} value - Field value

  @return {Boolean} - The value coerced to boolean
  *********************************************************************/
  RecordShape.coerceBoolean = function (value) {

    if (Lib.Utils.isNullOrUndefined(value)) {
      return false;
    }

    return Boolean(value);

  };


  /********************************************************************
  Map undefined/null to null; otherwise expect an integer (not coerced
  silently - throws TypeError on non-integer values, mirroring the
  required-integer assertion).

  @param {*} value - Field value

  @return {Integer|null} - The integer value or null
  *********************************************************************/
  RecordShape.coerceNullableInteger = function (value) {

    if (Lib.Utils.isNullOrUndefined(value)) {
      return null;
    }

    if (!Lib.Utils.isNumber(value) || !Lib.Utils.isInteger(value)) {
      throw new TypeError('[js-server-helper-auth] record integer field must be an integer or null');
    }

    return value;

  };

  ///////////////////////////// Helper Methods END ////////////////////////////////


  return RecordShape;

};

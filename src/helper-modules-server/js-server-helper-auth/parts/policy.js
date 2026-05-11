// Info: Pure list-then-filter algorithm that decides what happens when
// a new session is being created and existing sessions are present for
// the same actor.
//
// Pure function: no I/O. The caller (auth.js) loads the existing-sessions
// list from the store, calls applyLimits(), receives a decision, then
// performs the deletes and the insert.
//
// The algorithm runs in this order:
//   1. Drop any sessions whose expires_at has already passed.
//   2. Same-installation replacement: if install_id is provided and any
//      existing session matches (tenant_id, actor_id, install_id), mark
//      those sessions for deletion and remove them from the active set
//      before any cap evaluation. This step ALWAYS runs, regardless of
//      whether a cap would have been hit.
//   3. Tier checks: total_max, by_form_factor_max, by_platform_max are
//      each evaluated against the post-replacement active set.
//   4. If any tier is over its cap:
//        evict_oldest_on_limit = true  -> queue the oldest matching session
//                                          (by last_active_at) for deletion
//        evict_oldest_on_limit = false -> reject the createSession call
//
// Returns:
//   { decision: 'allow', to_delete: [...] }   - safe to insert the new session
//   { decision: 'reject', tier: 'total'|'form_factor'|'platform' } - cap hit
'use strict';


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. Returns one independent Policy part. Pure
list-then-filter algorithm - no I/O, no state - so the loader has
nothing to validate and just delegates to createInterface.

@param {Object} Lib - Dependency container (unused here)
@param {Object} CONFIG - Merged module configuration (unused here)
@param {Object} ERRORS - Error catalog for this module (unused here)

@return {Object} - Public Policy interface
*********************************************************************/
module.exports = function loader (Lib, CONFIG, ERRORS) {

  // No per-instance validation or state for this part.
  return createInterface(Lib, CONFIG, ERRORS);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Build the public Policy interface. Lib/CONFIG/ERRORS are part of the
uniform parts-factory signature; this part doesn't consume them
today.

@param {Object} Lib - Dependency container
@param {Object} CONFIG - Merged module configuration
@param {Object} ERRORS - Error catalog for this module

@return {Object} - Public Policy interface
*********************************************************************/
const createInterface = function (Lib, CONFIG, ERRORS) { // eslint-disable-line no-unused-vars


  ///////////////////////////Public Functions START//////////////////////////////
  const Policy = {

    /********************************************************************
    Decide whether a new session can be inserted, and which existing
    sessions (if any) need to be deleted to make room.

    @param {Object} options
    @param {Object[]} options.existing - All existing session records for this actor
    @param {Integer}  options.now - Current unix-seconds timestamp
    @param {String}   options.install_id - The new session's install_id (or null)
    @param {String}   options.install_form_factor - The new session's form_factor
    @param {String}   options.install_platform - The new session's platform
    @param {Object}   options.limits - The CONFIG.LIMITS object
    @param {Integer}    options.limits.total_max
    @param {Object|null} options.limits.by_form_factor_max
    @param {Object|null} options.limits.by_platform_max
    @param {Boolean}    options.limits.evict_oldest_on_limit

    @return {Object} - Decision envelope
    *********************************************************************/
    applyLimits: function (options) {

      // Filter out sessions that have already expired; clean-up runs separately
      let active = options.existing.filter(function (session) {
        return session.expires_at > options.now;
      });

      // Accumulate sessions to delete before inserting the new one
      const to_delete = [];

      // Step 1: Same-installation replacement (always-on)
      // If install_id is provided and any existing session has the same
      // install_id, queue those sessions for deletion. This rule fires
      // regardless of cap state - same install means same physical client,
      // we replace transparently.
      if (
        options.install_id !== null &&
        options.install_id !== undefined &&
        options.install_id !== ''
      ) {

        // Collect all sessions that share the same install_id
        const same_install = active.filter(function (session) {
          return session.install_id === options.install_id;
        });

        // Queue each same-install session for deletion
        for (const victim of same_install) {
          to_delete.push(victim);
        }

        // Remove the queued sessions from the active set before cap evaluation
        active = active.filter(function (session) {
          return session.install_id !== options.install_id;
        });

      }

      // Step 2: Total-count cap
      const total_check = Policy.checkTotal(active, options.limits.total_max);
      if (total_check.over_cap === true) {

        if (options.limits.evict_oldest_on_limit === true) {

          // Evict the LRU session to make room for the new one
          const victim = Policy.pickOldest(active);
          if (victim !== null) {
            to_delete.push(victim);
            active = Policy.removeBySessionKey(active, victim);
          }

        } else {
          // Hard cap with no eviction - reject the new session
          return { decision: 'reject', tier: 'total', to_delete: to_delete };
        }

      }

      // Step 3: Per-form-factor cap
      if (
        options.limits.by_form_factor_max !== null &&
        options.limits.by_form_factor_max !== undefined
      ) {

        // Look up the per-form-factor cap; undefined means no cap for this form_factor
        const ff_cap = options.limits.by_form_factor_max[options.install_form_factor];

        if (Number.isFinite(ff_cap)) {

          // Filter down to sessions with the same form_factor as the new session
          const ff_active = active.filter(function (session) {
            return session.install_form_factor === options.install_form_factor;
          });

          if (ff_active.length >= ff_cap) {

            if (options.limits.evict_oldest_on_limit === true) {

              // Evict the LRU session in this form_factor tier
              const victim = Policy.pickOldest(ff_active);
              if (victim !== null) {
                to_delete.push(victim);
                active = Policy.removeBySessionKey(active, victim);
              }

            } else {
              // Hard cap with no eviction - reject the new session
              return { decision: 'reject', tier: 'form_factor', to_delete: to_delete };
            }

          }

        }

      }

      // Step 4: Per-platform cap
      if (
        options.limits.by_platform_max !== null &&
        options.limits.by_platform_max !== undefined
      ) {

        // Look up the per-platform cap; undefined means no cap for this platform
        const plat_cap = options.limits.by_platform_max[options.install_platform];

        if (Number.isFinite(plat_cap)) {

          // Filter down to sessions with the same platform as the new session
          const plat_active = active.filter(function (session) {
            return session.install_platform === options.install_platform;
          });

          if (plat_active.length >= plat_cap) {

            if (options.limits.evict_oldest_on_limit === true) {

              // Evict the LRU session in this platform tier
              const victim = Policy.pickOldest(plat_active);
              if (victim !== null) {
                to_delete.push(victim);
              }

            } else {
              // Hard cap with no eviction - reject the new session
              return { decision: 'reject', tier: 'platform', to_delete: to_delete };
            }

          }

        }

      }

      // All caps satisfied - allow the insert
      return { decision: 'allow', to_delete: to_delete };

    },


    /********************************************************************
    Check the total-count cap. After same-install replacement, would
    inserting one more session push us strictly over total_max?

    @param {Object[]} active - Active sessions after same-install replacement
    @param {Integer} total_max - The total cap

    @return {Object} - { over_cap: boolean, count: integer, max: integer }
    *********************************************************************/
    checkTotal: function (active, total_max) {

      // Inserting one more brings the count to active.length + 1;
      // we are over the cap when active.length already equals or exceeds total_max
      return {
        over_cap: active.length >= total_max,
        count: active.length,
        max: total_max
      };

    },


    /********************************************************************
    Pick the session with the smallest last_active_at (oldest LRU).
    Returns null if the input is empty.

    @param {Object[]} candidates - Sessions to choose from

    @return {Object|null} - The LRU session or null
    *********************************************************************/
    pickOldest: function (candidates) {

      // Return null immediately if there are no candidates to choose from
      if (candidates.length === 0) {
        return null;
      }

      // Walk the list tracking the session with the smallest last_active_at
      let oldest = candidates[0];
      for (let i = 1; i < candidates.length; i++) {

        if (candidates[i].last_active_at < oldest.last_active_at) {
          oldest = candidates[i];
        }

      }

      // Return the least-recently-active session
      return oldest;

    },


    /********************************************************************
    Remove a session from a list by matching on (actor_id, token_key).
    Returns a new array; does not mutate the input.

    @param {Object[]} list - The list to filter
    @param {Object} target - The session to remove

    @return {Object[]} - New list without the target session
    *********************************************************************/
    removeBySessionKey: function (list, target) {

      // Filter out the target by matching on (actor_id, token_key)
      return list.filter(function (session) {

        return !(
          session.actor_id === target.actor_id &&
          session.token_key === target.token_key
        );

      });

    }

  };///////////////////////////Public Functions END////////////////////////////////


  return Policy;

};/////////////////////////// createInterface END ////////////////////////////////


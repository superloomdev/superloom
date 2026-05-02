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


module.exports = function (Lib) {

  // Suppress unused-var warning in Phase 1 - Lib reserved for future logging hooks
  void Lib;


  ////////////////////////////// Public Methods START /////////////////////////////
  const Policy = {

    /********************************************************************
    Decide whether a new session can be inserted, and which existing
    sessions (if any) need to be deleted to make room.

    @param {Object} args
    @param {Object[]} args.existing - All existing session records for this actor
    @param {Integer}  args.now - Current unix-seconds timestamp
    @param {String}   args.install_id - The new session's install_id (or null)
    @param {String}   args.install_form_factor - The new session's form_factor
    @param {String}   args.install_platform - The new session's platform
    @param {Object}   args.limits - The CONFIG.LIMITS object
    @param {Integer}    args.limits.total_max
    @param {Object|null} args.limits.by_form_factor_max
    @param {Object|null} args.limits.by_platform_max
    @param {Boolean}    args.limits.evict_oldest_on_limit

    @return {Object} - Decision envelope
    *********************************************************************/
    applyLimits: function (args) {

      // Drop expired sessions - they will be cleaned up later
      let active = args.existing.filter(function (session) {
        return session.expires_at > args.now;
      });

      const to_delete = [];

      // Step 1: Same-installation replacement (always-on)
      // If install_id is provided and any existing session has the same
      // install_id, queue those sessions for deletion. This rule fires
      // regardless of cap state - same install means same physical client,
      // we replace transparently.
      if (
        args.install_id !== null &&
        args.install_id !== undefined &&
        args.install_id !== ''
      ) {

        const same_install = active.filter(function (session) {
          return session.install_id === args.install_id;
        });

        for (const victim of same_install) {
          to_delete.push(victim);
        }

        active = active.filter(function (session) {
          return session.install_id !== args.install_id;
        });

      }

      // Step 2: Total-count cap
      const total_check = Policy.checkTotal(active, args.limits.total_max);
      if (total_check.over_cap === true) {

        if (args.limits.evict_oldest_on_limit === true) {

          const victim = Policy.pickOldest(active);
          if (victim !== null) {
            to_delete.push(victim);
            active = Policy.removeBySessionKey(active, victim);
          }

        } else {
          return { decision: 'reject', tier: 'total', to_delete: to_delete };
        }

      }

      // Step 3: Per-form-factor cap
      if (
        args.limits.by_form_factor_max !== null &&
        args.limits.by_form_factor_max !== undefined
      ) {

        const ff_cap = args.limits.by_form_factor_max[args.install_form_factor];

        // ff_cap may be undefined - meaning "no cap configured for this form_factor"
        if (Number.isFinite(ff_cap)) {

          const ff_active = active.filter(function (session) {
            return session.install_form_factor === args.install_form_factor;
          });

          if (ff_active.length >= ff_cap) {

            if (args.limits.evict_oldest_on_limit === true) {

              const victim = Policy.pickOldest(ff_active);
              if (victim !== null) {
                to_delete.push(victim);
                active = Policy.removeBySessionKey(active, victim);
              }

            } else {
              return { decision: 'reject', tier: 'form_factor', to_delete: to_delete };
            }

          }

        }

      }

      // Step 4: Per-platform cap
      if (
        args.limits.by_platform_max !== null &&
        args.limits.by_platform_max !== undefined
      ) {

        const plat_cap = args.limits.by_platform_max[args.install_platform];

        if (Number.isFinite(plat_cap)) {

          const plat_active = active.filter(function (session) {
            return session.install_platform === args.install_platform;
          });

          if (plat_active.length >= plat_cap) {

            if (args.limits.evict_oldest_on_limit === true) {

              const victim = Policy.pickOldest(plat_active);
              if (victim !== null) {
                to_delete.push(victim);
                active = Policy.removeBySessionKey(active, victim);
              }

            } else {
              return { decision: 'reject', tier: 'platform', to_delete: to_delete };
            }

          }

        }

      }

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

      // Inserting one more brings the count to active.length + 1.
      // We're over the cap when active.length >= total_max.
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

      if (candidates.length === 0) {
        return null;
      }

      let oldest = candidates[0];
      for (let i = 1; i < candidates.length; i++) {

        if (candidates[i].last_active_at < oldest.last_active_at) {
          oldest = candidates[i];
        }

      }

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

      return list.filter(function (session) {

        return !(
          session.actor_id === target.actor_id &&
          session.token_key === target.token_key
        );

      });

    }

  };//////////////////////////// Public Methods END //////////////////////////////


  return Policy;

};

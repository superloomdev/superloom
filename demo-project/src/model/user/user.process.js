// Info: User Process Module - Pure business logic and data transformations for User entity
// No database interaction - just data manipulation and calculations
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib;

// Domain config (injected; constants/enums, not runtime env)
let CONFIG;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib + CONFIG for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @return {void}
  *********************************************************************/
const loader = function (shared_libs, config) {

  Lib = shared_libs;
  CONFIG = config;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  // Run module-scope loader (local DI)
  loader(shared_libs, config);

  // Return Public Functions of this module
  return UserProcess;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START///////////////////////////////
const UserProcess = {

  /********************************************************************
  Calculate user account age in days

  @param {String} created_at - ISO timestamp of user creation

  @return {Number} - Days since account creation
  *********************************************************************/
  calculateAccountAgeDays: function (created_at) {

    const created_date = new Date(created_at);
    const current_date = new Date();
    const diff_ms = current_date - created_date;
    const diff_days = Math.floor(diff_ms / (1000 * 60 * 60 * 24));

    return diff_days;

  },


  /********************************************************************
  Format user display name based on available fields

  @param {Object} user_data - User data object
  @param {String} user_data.name - User full name
  @param {String} [user_data.email] - User email
  @param {String} [user_data.role] - User role

  @return {String} - Formatted display name
  *********************************************************************/
  formatDisplayName: function (user_data) {

    if (!Lib.Utils.isEmpty(user_data.name)) {
      return user_data.name;
    }

    if (!Lib.Utils.isEmpty(user_data.email)) {
      return user_data.email.split('@')[0];
    }

    return 'Anonymous';

  },


  /********************************************************************
  Calculate user activity score based on various metrics

  @param {Object} metrics - Activity metrics
  @param {Number} [metrics.login_count] - Number of logins
  @param {Number} [metrics.survey_count] - Number of surveys completed
  @param {Number} [metrics.days_since_last_login] - Days since last login

  @return {Number} - Activity score (0-100)
  *********************************************************************/
  calculateActivityScore: function (metrics) {

    let score = 0;

    // Base score from login count (max 40 points)
    const login_score = Math.min((metrics.login_count || 0) * 2, 40);
    score += login_score;

    // Score from survey participation (max 40 points)
    const survey_score = Math.min((metrics.survey_count || 0) * 8, 40);
    score += survey_score;

    // Recency bonus (max 20 points)
    const days_since = metrics.days_since_last_login != null ? metrics.days_since_last_login : 30;
    if (days_since === 0) {
      score += 20;
    } else if (days_since <= 7) {
      score += 15;
    } else if (days_since <= 30) {
      score += 10;
    } else if (days_since <= 90) {
      score += 5;
    }

    return Math.min(score, 100);

  },


  /********************************************************************
  Build user summary object for lists/dashboards

  @param {Object} user_data - Full user data
  @param {String} user_data.id - User ID
  @param {String} user_data.name - User name
  @param {String} user_data.email - User email
  @param {String} [user_data.role] - User role
  @param {String} [user_data.status] - User status
  @param {String} user_data.created_at - Creation timestamp

  @return {Object} - User summary object
  *********************************************************************/
  buildUserSummary: function (user_data) {

    const account_age_days = UserProcess.calculateAccountAgeDays(user_data.created_at);
    const display_name = UserProcess.formatDisplayName(user_data);

    return {
      id: user_data.id,
      display_name: display_name,
      email: user_data.email,
      role: user_data.role || 'user',
      status: user_data.status || 'active',
      account_age_days: account_age_days,
      is_new: account_age_days <= 7
    };

  },


  /********************************************************************
  Enrich user data with computed fields

  @param {Object} user_data - Base user data
  @param {Object} [activity_metrics] - Optional activity metrics

  @return {Object} - Enriched user data with computed fields
  *********************************************************************/
  enrichUserData: function (user_data, activity_metrics) {

    const enriched = { ...user_data };

    // Add computed fields
    enriched.display_name = UserProcess.formatDisplayName(user_data);
    enriched.account_age_days = UserProcess.calculateAccountAgeDays(user_data.created_at);

    if (activity_metrics) {
      enriched.activity_score = UserProcess.calculateActivityScore(activity_metrics);
      enriched.activity_level = enriched.activity_score >= 70 ? 'high' :
        enriched.activity_score >= 40 ? 'medium' : 'low';
    }

    return enriched;

  },


  /********************************************************************
  Validate password strength

  @param {String} password - Password to validate

  @return {Object|null} - Validation error or null if valid
  *********************************************************************/
  validatePasswordStrength: function (password) {

    if (Lib.Utils.isEmpty(password)) {
      return { field: 'password', message: 'Password is required' };
    }

    if (password.length < 8) {
      return { field: 'password', message: 'Password must be at least 8 characters' };
    }

    if (!/[A-Z]/.test(password)) {
      return { field: 'password', message: 'Password must contain at least one uppercase letter' };
    }

    if (!/[a-z]/.test(password)) {
      return { field: 'password', message: 'Password must contain at least one lowercase letter' };
    }

    if (!/[0-9]/.test(password)) {
      return { field: 'password', message: 'Password must contain at least one number' };
    }

    return null;

  },


  /********************************************************************
  Filter users by role and status

  @param {Array} users - Array of user objects
  @param {Object} filters - Filter criteria
  @param {String} [filters.role] - Role to filter by
  @param {String} [filters.status] - Status to filter by
  @param {Boolean} [filters.is_new] - Filter by new users only

  @return {Array} - Filtered user array
  *********************************************************************/
  filterUsers: function (users, filters) {

    return users.filter(function (user) {

      if (filters.role && user.role !== filters.role) {
        return false;
      }

      if (filters.status && user.status !== filters.status) {
        return false;
      }

      if (filters.is_new !== undefined) {
        const account_age = UserProcess.calculateAccountAgeDays(user.created_at);
        const is_new = account_age <= 7;
        if (is_new !== filters.is_new) {
          return false;
        }
      }

      return true;

    });

  },


  /********************************************************************
  Sort users by specified criteria

  @param {Array} users - Array of user objects
  @param {String} sort_by - Sort field (name, created_at, activity_score)
  @param {String} order - Sort order (asc, desc)

  @return {Array} - Sorted user array
  *********************************************************************/
  sortUsers: function (users, sort_by, order) {

    const sorted = [...users];

    sorted.sort(function (a, b) {

      let val_a = a[sort_by];
      let val_b = b[sort_by];

      // Handle nested/computed fields
      if (sort_by === 'display_name') {
        val_a = UserProcess.formatDisplayName(a);
        val_b = UserProcess.formatDisplayName(b);
      }

      if (val_a === val_b) {
        return 0;
      }

      const comparison = val_a < val_b ? -1 : 1;
      return order === 'desc' ? -comparison : comparison;

    });

    return sorted;

  }

};///////////////////////////Public Functions END///////////////////////////////

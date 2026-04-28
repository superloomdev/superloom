# User Base Model

Shared domain model - safe to share between server and client.

## Overview

The User model represents an authenticated user account with profile information, contact details, and role-based access control.

## Data Attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | String | Yes | - | Unique identifier (e.g., 'usr_abc123') |
| `name` | String | Yes | - | Full name of the user |
| `email` | String | Yes | - | Unique email address |
| `phone` | String | No | null | Contact phone number |
| `role` | String | No | 'user' | User role: 'admin', 'user', 'guest' |
| `status` | String | No | 'active' | Account status: 'active', 'inactive', 'suspended' |
| `created_at` | ISO String | Yes | now | Timestamp when account was created |
| `updated_at` | ISO String | Yes | now | Timestamp of last update |

## Module Files

| File | Purpose |
|---|---|
| `index.js` | Public export surface (Standard Loader) |
| `user.config.js` | Domain constants and rules (lengths, regex, enums) |
| `user.data.js` | **Consolidated: Data shapes + transformations** |
| `user.errors.js` | Domain error catalog (error codes + messages + HTTP status) |
| `user.validation.js` | Pure validation functions (`validateCreate`, `validateUpdate`) |
| `user.process.js` | Pure business logic - calculations, transformations, filters |

## Exported Functions

### Data (`model.data`)
- **`create(data)`** - Creates a canonical user data object with defaults
  - Params: `{ name, email, phone?, role? }`
  - Returns: `{ name, email, phone, role, status, created_at, updated_at }`
- **`createUpdate(data)`** - Creates an update shape with only provided fields
  - Params: `{ name?, email?, phone?, status? }`
  - Returns: Object with only non-null fields + `updated_at`
- **`createDeep(user_data, contact_data?, preferences?, metadata?)`** - Builds deep data
- **`toPublic(user_data)`** - Builds public output (strips server-only fields)
- **`toSummary(user_data)`** - Builds minimal summary for lists
- **`toInternal(external_data)`** - Transforms external input to internal shape

### Validation (`model.validation`)
- **`validateCreate(data)`** - Validates data for creating a new user
  - Returns: `false` if valid, `Error[]` if invalid
- **`validateUpdate(data)`** - Validates data for updating a user
  - Returns: `false` if valid, `Error[]` if invalid

### Process (`model.process`) - Pure business logic
- **`calculateAccountAgeDays(created_at)`** - Days since account creation
- **`formatDisplayName(user_data)`** - Display name from name or email prefix
- **`calculateActivityScore(metrics)`** - Calculate 0-100 activity score from login/survey metrics
- **`buildUserSummary(user_data)`** - Summary object for lists/dashboards
- **`enrichUserData(user_data, activity_metrics)`** - Add computed fields (display_name, account_age_days, activity_score, activity_level)
- **`validatePasswordStrength(password)`** - Validate password requirements
- **`filterUsers(users, filters)`** - Filter array by role, status, is_new
- **`sortUsers(users, sort_by, order)`** - Sort users by field (name, created_at, etc.)

### Errors (`model.errors`)
- `NAME_REQUIRED`, `NAME_INVALID`, `EMAIL_REQUIRED`, `EMAIL_INVALID`
- `PHONE_INVALID`, `STATUS_INVALID`, `ROLE_INVALID`
- `EMAIL_ALREADY_EXISTS`, `NOT_FOUND`, `ID_REQUIRED`

## Usage

```javascript
// Load model via parent loader
const loadLib = require('../_test/loader');
const Lib = loadLib();
const User = Lib.User;

// Validate
const errors = User.validation.validateCreate({ name: 'John', email: 'john@example.com' });

// Create data
const user = User.data.create({ name: 'John', email: 'john@example.com' });

// Build public response
const output = User.data.toPublic(user);

// Use process functions
const summary = User.process.buildUserSummary(user);
```

## Dependencies
- `Lib.Utils`: For string and object utilities
- `Lib.Contact`: For email/phone validation delegation (via `Lib.Contact.validation`)
- `CONFIG`: Internal entity configuration (loaded within module, not exported)

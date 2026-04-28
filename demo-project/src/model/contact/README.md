# Contact Model

Project-specific contact module for email and phone number handling. Different projects may have different validation rules (allowed domains, supported countries, etc.).

**This module is referenced by other entity modules** (e.g., User model validates email/phone via Contact model). This demonstrates inter-module references in the model layer.

## Overview

The Contact model handles email and phone number validation, formatting, and privacy masking. It provides both validation for data integrity and process functions for display transformations.

## Data Attributes

### Email Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | String | Yes | Email address (validated against format, domains) |

### Phone Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `phone_country` | String | Yes | Country code (e.g., 'US', 'IN') |
| `phone_number` | String | Yes | Phone number digits |

### Address Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `line1` | String | Yes | Street address |
| `line2` | String | No | Apartment, suite, floor |
| `city` | String | Yes | City name |
| `state` | String | Yes | State or province |
| `postal_code` | String | Yes | ZIP or postal code |
| `country` | String | No | Country (default from phone_country) |

## Module Files

| File | Purpose |
|---|---|
| `index.js` | Public export surface (Standard Loader) |
| `contact.config.js` | Email/phone validation rules, allowed domains |
| `contact.data.js` | **Consolidated: Data shapes + transformations** |
| `contact.validation.js` | Validation functions for email and phone |
| `contact.errors.js` | Domain error catalog |
| `contact.process.js` | Formatting, masking, privacy functions |

## Exported Functions

### Data (`model.data`)
- **`createEmail(email)`** - Builds email data (trimmed, lowercased)
- **`createPhone(phone_country, phone_number)`** - Builds phone data (sanitized)
- **`createAddress(line1, line2, city, state, postal_code, country)`** - Builds address data
- **`createContact(email_data, phone_data, address_data, contact_id)`** - Builds complete contact
- **`createDeep(contact_data, metadata?, preferences?)`** - Builds deep data
- **`toPublic(contact_data)`** - Builds public output
- **`toSummary(contact_data)`** - Builds minimal summary
- **`toInternal(external_data)`** - Transforms external input to internal shape
- **`buildPhoneId(phone_country, phone_number)`** - Builds unique phone ID

### Validation (`model.validation`)
- **`validateEmail(email)`** - Validates email format, length, domains
- **`validatePhone(phone_country, phone_number)`** - Validates phone with country-specific rules
- **`validateEmailOptional(email)`** - Skips if not provided
- **`validatePhoneOptional(phone_country, phone_number)`** - Skips if not provided

### Process (`model.process`) - Formatting and Privacy
- **`formatPhoneNumber(phone, format)`** - Format phone (international, national, e164)
- **`maskPhoneNumber(phone)`** - Mask for privacy (***-***-1234)
- **`maskEmail(email)`** - Mask email (jo***@example.com)
- **`normalizeEmail(email)`** - Lowercase and trim
- **`extractEmailDomain(email)`** - Extract domain from email
- **`formatAddressLine(address)`** - Format address as single line string
- **`buildContactSummary(contact_data)`** - Build summary with masked/formatted fields
- **`checkCompleteness(contact_data)`** - Check if email, phone, address all present

## Usage

```javascript
// Load model via parent loader
const loadLib = require('../_test/loader');
const Lib = loadLib();
const Contact = Lib.Contact;

// Create data
const emailData = Contact.data.createEmail('john@example.com');
const contact = Contact.data.createContact(emailData, null, null);

// Use process functions
const masked = Contact.process.maskEmail(contact.email);
```

## Dependencies
- `Lib.Utils`: For string and object utilities
- `CONFIG`: Internal entity configuration (loaded within module, not exported)

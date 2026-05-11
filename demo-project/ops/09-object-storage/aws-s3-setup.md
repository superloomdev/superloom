# AWS S3 Setup

## Prerequisites

IAM policies and roles created.

## Steps

### Bucket: Source Code (Private)

Stores source code used by Lambda deployments.

* S3 → Create Bucket
* Bucket Name: `[TODO: stage]-[project]-source-code`
* Region: `[TODO: e.g., ap-south-1]`
* ACL: Disabled (default)
* Block all public access: Checked

### Bucket: File Upload (Private, Auto-Expiry)

Temporary storage for files uploaded directly from clients via signed URLs.

* S3 → Create Bucket
* Bucket Name: `[TODO: stage]-[project]-file-upload`
* Region: `[TODO: e.g., ap-south-1]`
* Object Ownership: ACLs enabled, Bucket owner preferred
* Block public access: Unchecked (allow public access)

After creation:
* Management → Lifecycle → Create Lifecycle Rule:
  * Rule Name: `Auto Expire in 2 days`
  * Scope: Apply to all objects
  * Expire current versions: 2 days
  * Delete incomplete multipart uploads: 2 days
* Permissions → CORS:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "POST", "PUT", "HEAD"],
    "AllowedOrigins": ["[TODO: your-domain.com]"],
    "ExposeHeaders": ["Content-Length", "ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### Bucket: Raw Files (Private)

Stores unprocessed images and videos.

* S3 → Create Bucket
* Bucket Name: `[TODO: stage]-[project]-file-raw`
* Region: `[TODO: e.g., ap-south-1]`
* ACL: Disabled (default)
* Block all public access: Checked

### Bucket: Media (Public)

Stores processed images and files for public access.

* S3 → Create Bucket
* Bucket Name: `[TODO: stage]-[project]-media`
* Region: `[TODO: e.g., ap-south-1]`
* ACL: Disabled (default)
* Block public access: Unchecked

After creation:
* Properties → Static Website Hosting: Enabled
  * Index Document: `index.html`
* Permissions → Bucket Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::[TODO: bucket-name]/*"]
    }
  ]
}
```
* Permissions → CORS:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

### Bucket: Web App Hosting (Public)

Hosts static web applications (SPA).

* S3 → Create Bucket
* Bucket Name: `[TODO: stage]-[project]-[app-name]`
* Region: `[TODO: e.g., ap-south-1]`
* Block public access: Unchecked

After creation:
* Properties → Static Website Hosting: Enabled
  * Index Document: `index.html`
  * Error Document: `index.html` (for SPA routing)
* Permissions → Bucket Policy: Same public read pattern as Media bucket
* Permissions → CORS: Configure allowed origins for your domains

### Bucket: Logging (Private)

Stores server and access logs.

* S3 → Create Bucket
* Bucket Name: `[TODO: stage]-[project]-logging`
* Region: `[TODO: e.g., ap-south-1]`
* ACL: Disabled (default)
* Block all public access: Checked

## Notes

- Bucket names must be globally unique across all AWS accounts
- Use consistent naming: `[stage]-[project]-[purpose]`
- All bucket ARNs should be reflected in IAM policies (see `05-identity-access/`)

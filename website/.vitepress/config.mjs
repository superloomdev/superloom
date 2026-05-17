import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Superloom',
  description: 'A modular Node.js framework for backend applications. Build once. Deploy anywhere. AI-native.',
  srcDir: '.',
  outDir: './DIST',
  cacheDir: './.vitepress/cache',

  srcExclude: [
    'docs/README.md',
    'docs/architecture/modules/templates/*.md',
  ],

  // Strict link-checking. Pre-existing dead links are whitelisted below as Phase 3 cleanup targets;
  // any NEW broken cross-link will fail the build. See __dev__/plans/0008-module-readme-pilot.md
  // (Phase 2 Step 2.8 Execution Notes) for why each pattern is here.
  ignoreDeadLinks: [
    // .mdx orphan files - VitePress 1.x does not route .mdx files (these have Docusaurus-era
    // `import Tabs` and `<Tabs>` JSX). Phase 3 cleanup: convert to .md.
    // Affects: error-handling, module-structure-js, entity-creation-guide-js, server-interfaces.
    /\/error-handling$/,
    /\/module-structure-js$/,
    /\/entity-creation-guide-js$/,
    /\/server-interfaces$/,

    // Out-of-docs-tree references - VitePress only resolves links inside srcDir.
    // Phase 3 cleanup: convert these to absolute GitHub URLs.
    /\.windsurf\//,
    /__dev__\//,
    /\/AGENTS$/,

    // Pre-existing wrong paths in ops/README.md (website-ops tree). Phase 3 cleanup.
    /docs\/architecture\/operations-documentation$/,
    /docs\/ops\/index$/,

    // Pre-existing references to files that have never existed.
    // Phase 3 cleanup: replace with valid links or remove.
    /\/CHANGELOG$/,
    /\/ROBOTS$/,
    /\.env\..*\.example$/,
    /\/dev\/index$/,
    /\/templates\/index$/,
    /\/configuration$/,
  ],

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo-color.svg' }],
    ['meta', { name: 'theme-color', content: '#4F6BFF' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Superloom' }],
  ],

  themeConfig: {
    logo: {
      light: '/logo-color.svg',
      dark: '/logo-mono.svg',
    },

    siteTitle: 'Superloom',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs/', activeMatch: '^/docs/' },
      { text: 'Guide', link: '/docs/guide/getting-started', activeMatch: '^/docs/guide/' },
      { text: 'GitHub', link: 'https://github.com/superloomdev/superloom' },
    ],

    sidebar: {
      '/docs/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Superloom?', link: '/docs/' },
          ],
        },
        {
          text: 'Philosophy',
          collapsed: false,
          items: [
            { text: 'Why the Server Uses MVC', link: '/docs/philosophy/why-server-mvc' },
            { text: 'DTO Philosophy',          link: '/docs/philosophy/dto-philosophy-js' },
          ],
        },
        {
          text: 'Guide',
          collapsed: false,
          items: [
            { text: 'Getting Started',   link: '/docs/guide/getting-started' },
            { text: 'Creating Entities', link: '/docs/guide/creating-entities-js' },
            { text: 'IDE Setup',         link: '/docs/guide/ide-setup' },
          ],
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            {
              text: 'Foundations',
              collapsed: false,
              items: [
                { text: 'Architectural Philosophy',  link: '/docs/architecture/foundations/architectural-philosophy' },
                { text: 'Code Formatting',           link: '/docs/architecture/foundations/code-formatting-js' },
                { text: 'Error Handling',            link: '/docs/architecture/foundations/error-handling' },
                { text: 'Validation Approach',       link: '/docs/architecture/foundations/validation-approach' },
                { text: 'Operations Documentation',  link: '/docs/architecture/foundations/operations-documentation' },
              ],
            },
            {
              text: 'Server',
              collapsed: true,
              items: [
                { text: 'Server Loader',         link: '/docs/architecture/server/server-loader' },
                { text: 'Server Interfaces',     link: '/docs/architecture/server/server-interfaces' },
                { text: 'Controllers',           link: '/docs/architecture/server/server-controller-modules' },
                { text: 'Services',              link: '/docs/architecture/server/server-service-modules' },
                { text: 'Server Common',         link: '/docs/architecture/server/server-common' },
                { text: 'Model Modules',         link: '/docs/architecture/server/model-modules' },
                { text: 'Entity Creation Guide', link: '/docs/architecture/server/entity-creation-guide-js' },
              ],
            },
            {
              text: 'Modules',
              collapsed: true,
              items: [
                { text: 'Module Structure',         link: '/docs/architecture/modules/module-structure-js' },
                { text: 'Module Categorization',    link: '/docs/architecture/modules/module-categorization' },
                { text: 'README Structure',         link: '/docs/architecture/modules/module-readme-structure' },
                { text: 'Module Publishing',        link: '/docs/architecture/modules/module-publishing' },
                { text: 'Core Helpers',             link: '/docs/architecture/modules/core-helper-modules' },
                { text: 'Server Helpers',           link: '/docs/architecture/modules/server-helper-modules' },
                { text: 'Peer Dependencies',        link: '/docs/architecture/modules/peer-dependencies' },
                { text: 'Complex Module Docs',      link: '/docs/architecture/modules/complex-module-docs-guide' },
              ],
            },
            {
              text: 'Testing',
              collapsed: true,
              items: [
                { text: 'Testing Strategy',     link: '/docs/architecture/testing/testing-strategy' },
                { text: 'Module Testing',       link: '/docs/architecture/testing/module-testing' },
                { text: 'Unit Test Authoring',  link: '/docs/architecture/testing/unit-test-authoring-js' },
                { text: 'Integration Testing',  link: '/docs/architecture/testing/integration-testing' },
                { text: 'Migration Pitfalls',   link: '/docs/architecture/testing/migration-pitfalls' },
              ],
            },
          ],
        },
        {
          text: 'Developer Setup',
          collapsed: true,
          items: [
            { text: 'Overview',                link: '/docs/dev/README' },
            { text: 'Git Account Setup',       link: '/docs/dev/onboarding-git-account' },
            { text: 'GitHub Packages',         link: '/docs/dev/onboarding-github-packages' },
            { text: 'npmrc Setup',             link: '/docs/dev/npmrc-setup' },
            { text: 'CI/CD Publishing',        link: '/docs/dev/cicd-publishing' },
            { text: 'Local Module Testing',    link: '/docs/dev/testing-local-modules' },
            { text: 'Documentation Standards', link: '/docs/dev/documentation-standards' },
            { text: 'Pitfalls Journal',        link: '/docs/dev/pitfalls' },
          ],
        },
        {
          text: 'Versioning',
          collapsed: true,
          items: [
            { text: 'Overview',               link: '/docs/versioning/' },
            { text: 'Semantic Versioning',    link: '/docs/versioning/semantic-versioning' },
            { text: 'Dependency Management',  link: '/docs/versioning/dependency-management' },
            { text: 'CI Dependency Graph',    link: '/docs/versioning/ci-dependency-graph' },
            { text: 'Version Bump Checklist', link: '/docs/versioning/bump-checklist' },
            { text: 'Changelog Format',       link: '/docs/versioning/changelog-format' },
            { text: 'API Stability',          link: '/docs/versioning/api-stability-js' },
          ],
        },
        {
          text: 'Operations',
          collapsed: true,
          items: [
            { text: 'Overview',                       link: '/docs/ops/README' },
            { text: 'Billing (AWS Budgets)',          link: '/docs/ops/billing/aws-budget-setup' },
            { text: 'CDN (CloudFront)',               link: '/docs/ops/cdn/aws-cloudfront-setup' },
            { text: 'Cloud Provider (AWS)',           link: '/docs/ops/cloud-provider/aws-account-setup' },
            { text: 'Deployment (Serverless)',        link: '/docs/ops/deployment/serverless-setup' },
            { text: 'Dev Environment (Workspaces)',   link: '/docs/ops/development-environment/aws-workspace-setup' },
            { text: 'DNS (Route 53)',                 link: '/docs/ops/dns/aws-route53-setup' },
            { text: 'Domain',                         link: '/docs/ops/domain/domain-setup' },
            { text: 'Identity & Access (IAM)',        link: '/docs/ops/identity-access/aws-iam-setup' },
            { text: 'Messaging (SES)',                link: '/docs/ops/messaging/aws-ses-setup' },
            { text: 'Networking (VPC)',               link: '/docs/ops/networking/aws-vpc-setup' },
            { text: 'NoSQL: DynamoDB',                link: '/docs/ops/nosql-database/aws-dynamodb-setup' },
            { text: 'NoSQL: MongoDB Atlas',           link: '/docs/ops/nosql-database/mongodb-atlas-setup' },
            { text: 'Object Storage (S3)',            link: '/docs/ops/object-storage/aws-s3-setup' },
            { text: 'Parameter Store (SSM)',          link: '/docs/ops/parameter-management/aws-ssm-setup' },
            { text: 'SQL: RDS MySQL',                 link: '/docs/ops/relational-database/aws-rds-mysql-setup' },
            { text: 'SQL: RDS Postgres',              link: '/docs/ops/relational-database/aws-rds-postgres-setup' },
            { text: 'Scheduled Tasks (EventBridge)',  link: '/docs/ops/scheduled-tasks/aws-eventbridge-setup' },
            { text: 'Source Control: Actions',        link: '/docs/ops/source-control/github-actions-setup' },
            { text: 'Source Control: Org',            link: '/docs/ops/source-control/github-org-setup' },
            { text: 'Source Control: Tokens',         link: '/docs/ops/source-control/github-tokens-setup' },
            { text: 'SSL Certificates (ACM)',         link: '/docs/ops/ssl-certificates/aws-acm-setup' },
          ],
        },
        {
          text: 'Website Ops',
          collapsed: true,
          items: [
            { text: 'Overview',                   link: '/ops/README' },
            { text: '00 · Domain Setup',           link: '/ops/00-domain/domain-setup' },
            { text: '01 · DNS (Route 53)',         link: '/ops/01-dns/aws-route53-setup' },
            { text: '02 · SSL Certificate (ACM)',  link: '/ops/02-ssl-certificates/aws-acm-setup' },
            { text: '03 · Object Storage (S3)',    link: '/ops/03-object-storage/aws-s3-setup' },
            { text: '04 · CDN (CloudFront)',       link: '/ops/04-cdn/aws-cloudfront-setup' },
            { text: '05 · IAM Policy',             link: '/ops/05-identity-access/aws-iam-setup' },
            { text: '06 · CI/CD Deployment',       link: '/ops/06-deployment/aws-cicd-setup' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/superloomdev/superloom' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-present Superloom',
    },

    editLink: {
      pattern: 'https://github.com/superloomdev/superloom/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },

    outline: {
      level: [2, 3],
    },
  },

  markdown: {
    lineNumbers: true,
  },

})

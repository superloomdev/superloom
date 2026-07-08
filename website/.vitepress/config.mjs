import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Superloom',
  description: 'A modular Node.js framework for backend applications. Build once. Deploy anywhere. AI-native.',
  srcDir: '.',
  outDir: './DIST',
  cacheDir: './.vitepress/cache',

  srcExclude: [
    'docs/README.md',
  ],

  // Strict link-checking with empty whitelist. Phase 3 cleared all pre-existing dead links;
  // any broken cross-link will now fail the build. Add a regex here only as a last resort
  // and document why in the same line.
  ignoreDeadLinks: [],

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
      { text: 'GitHub', link: 'https://github.com/superloomdev' },
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
          text: 'Guide',
          collapsed: false,
          items: [
            { text: 'Getting Started',   link: '/docs/guide/getting-started' },
            { text: 'Creating Entities', link: '/docs/guide/creating-entities-js' },
            { text: 'IDE Setup',         link: '/docs/guide/ide-setup' },
          ],
        },
        {
          text: 'Principles',
          collapsed: false,
          items: [
            { text: 'Engineering Philosophy',    link: '/docs/principles/engineering-philosophy' },
            { text: 'Code Readability',          link: '/docs/principles/code-readability' },
            { text: 'File Archetypes',           link: '/docs/principles/file-archetypes' },
            { text: 'Module Design',             link: '/docs/principles/module-design' },
            { text: 'Server Architecture',       link: '/docs/principles/server-architecture' },
            { text: 'Error Handling',            link: '/docs/principles/error-handling' },
            { text: 'Validation',                link: '/docs/principles/validation' },
            { text: 'Testing',                   link: '/docs/principles/testing' },
            { text: 'Versioning and Releases',   link: '/docs/principles/versioning-and-releases' },
            { text: 'Third-Party Libraries',     link: '/docs/principles/third-party-libraries' },
            { text: 'Operations Documentation',  link: '/docs/principles/operations-documentation' },
            { text: 'Documentation Authoring',   link: '/docs/principles/documentation-authoring' },
            { text: 'Extending to a Language',   link: '/docs/principles/extending-to-a-language' },
          ],
        },
        {
          text: 'JavaScript',
          collapsed: false,
          items: [
            { text: 'Overview and Reading Path', link: '/docs/languages/js/index' },
            { text: 'Project Structure',         link: '/docs/languages/js/project-structure' },
            { text: 'Code Formatting',           link: '/docs/languages/js/code-formatting' },
            { text: 'Module Structure',          link: '/docs/languages/js/module-structure' },
            { text: 'Module Classes',            link: '/docs/languages/js/module-classes' },
            { text: 'Factory vs Singleton',      link: '/docs/languages/js/factory-vs-singleton' },
            { text: 'Error Handling',            link: '/docs/languages/js/error-handling' },
            { text: 'Validation',                link: '/docs/languages/js/validation' },
            { text: 'Dependencies',              link: '/docs/languages/js/dependencies' },
            { text: 'DTO Philosophy',            link: '/docs/languages/js/dto-philosophy' },
            { text: 'Module Docs',               link: '/docs/languages/js/module-docs' },
            { text: 'Complex Module Docs',       link: '/docs/languages/js/module-docs-complex' },
            { text: 'THOUGHTS.md Convention',    link: '/docs/languages/js/module-thoughts-file' },
            { text: 'Publishing',                link: '/docs/languages/js/publishing' },
            {
              text: 'Testing',
              collapsed: true,
              items: [
                { text: 'Testing Strategy',    link: '/docs/languages/js/testing-strategy' },
                { text: 'Unit Test Authoring', link: '/docs/languages/js/unit-test-authoring' },
                { text: 'Module Testing',      link: '/docs/languages/js/module-testing' },
                { text: 'Integration Testing', link: '/docs/languages/js/integration-testing' },
                { text: 'Migration Pitfalls',  link: '/docs/languages/js/pitfalls-migration' },
              ],
            },
            {
              text: 'Server Layers',
              collapsed: true,
              items: [
                { text: 'Server Loader',         link: '/docs/languages/js/server/server-loader' },
                { text: 'Server Interfaces',     link: '/docs/languages/js/server/server-interfaces' },
                { text: 'Controllers',           link: '/docs/languages/js/server/server-controller-modules' },
                { text: 'Services',              link: '/docs/languages/js/server/server-service-modules' },
                { text: 'Server Common',         link: '/docs/languages/js/server/server-common' },
                { text: 'Model Modules',         link: '/docs/languages/js/server/model-modules' },
                { text: 'Entity Creation Guide', link: '/docs/languages/js/server/entity-creation-guide-js' },
              ],
            },
            {
              text: 'Versioning',
              collapsed: true,
              items: [
                { text: 'Overview',               link: '/docs/languages/js/versioning/' },
                { text: 'Semantic Versioning',    link: '/docs/languages/js/versioning/semantic-versioning' },
                { text: 'Dependency Management',  link: '/docs/languages/js/versioning/dependency-management' },
                { text: 'CI Dependency Graph',    link: '/docs/languages/js/versioning/ci-dependency-graph' },
                { text: 'Version Bump Checklist', link: '/docs/languages/js/versioning/bump-checklist' },
                { text: 'Changelog Format',       link: '/docs/languages/js/versioning/changelog-format' },
                { text: 'API Stability',          link: '/docs/languages/js/versioning/api-stability-js' },
                { text: 'README Versioning Section', link: '/docs/languages/js/versioning/version-bump-section' },
              ],
            },
            {
              text: 'Module Catalogs',
              collapsed: true,
              items: [
                { text: 'Core Helpers',   link: '/docs/languages/js/catalog-core' },
                { text: 'Server Helpers', link: '/docs/languages/js/catalog-server' },
                { text: 'Client Helpers', link: '/docs/languages/js/catalog-client' },
              ],
            },
          ],
        },
        {
          text: 'AI-Assisted Development',
          collapsed: false,
          items: [
            { text: 'Overview',            link: '/docs/ai/index' },
            { text: 'Agent Configuration', link: '/docs/ai/agent-configuration' },
            { text: 'Workflow Authoring',  link: '/docs/ai/workflow-authoring' },
            { text: 'Model Tiering',       link: '/docs/ai/model-tiering' },
          ],
        },
        {
          text: 'Developer Setup',
          collapsed: true,
          items: [
            { text: 'Overview',                link: '/docs/dev/README' },
            { text: 'Organisation Structure',  link: '/docs/dev/org-structure' },
            { text: 'Git Account Setup',       link: '/docs/dev/onboarding-git-account' },
            { text: 'GitHub Packages',         link: '/docs/dev/onboarding-github-packages' },
            { text: 'npmrc Setup',             link: '/docs/dev/npmrc-setup' },
            { text: 'CI/CD Publishing',        link: '/docs/dev/cicd-publishing' },
            { text: 'Local Module Testing',    link: '/docs/dev/testing-local-modules' },
            { text: 'Planning System',         link: '/docs/dev/planning' },
            { text: 'Pitfalls Journal',        link: '/docs/dev/pitfalls' },
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
      { icon: 'github', link: 'https://github.com/superloomdev' },
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

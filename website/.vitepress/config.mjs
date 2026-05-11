import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Superloom',
  description: 'A modular Node.js framework for backend applications. Build once. Deploy anywhere. AI-native.',
  srcDir: '.',
  outDir: './DIST',
  cacheDir: './.vitepress/cache',

  srcExclude: [
    'docs/README.md',
    'docs/architecture/templates/*.md',
  ],

  ignoreDeadLinks: true,

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
          text: 'Guide',
          collapsed: false,
          items: [
            { text: 'Getting Started', link: '/docs/guide/getting-started' },
            { text: 'Creating Entities', link: '/docs/guide/creating-entities-js' },
            { text: 'IDE Setup', link: '/docs/guide/ide-setup' },
          ],
        },
        {
          text: 'Philosophy',
          collapsed: false,
          items: [
            { text: 'Why MVC', link: '/docs/philosophy/why-mvc' },
            { text: 'DTO Philosophy', link: '/docs/philosophy/dto-philosophy-js' },
          ],
        },
        {
          text: 'Architecture',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/docs/architecture/architectural-philosophy' },
            { text: 'Code Formatting', link: '/docs/architecture/code-formatting-js' },
            { text: 'Error Handling', link: '/docs/architecture/error-handling' },
            { text: 'Validation Approach', link: '/docs/architecture/validation-approach' },
            { text: 'Module Structure', link: '/docs/architecture/module-structure-js' },
            { text: 'Module Testing', link: '/docs/architecture/module-testing' },
            { text: 'Module Publishing', link: '/docs/architecture/module-publishing' },
            { text: 'Peer Dependencies', link: '/docs/architecture/peer-dependencies' },
            { text: 'Entity Creation Guide', link: '/docs/architecture/entity-creation-guide-js' },
            { text: 'Model Modules', link: '/docs/architecture/model-modules' },
            { text: 'Server Loader', link: '/docs/architecture/server-loader' },
            { text: 'Server Interfaces', link: '/docs/architecture/server-interfaces' },
            { text: 'Controllers', link: '/docs/architecture/server-controller-modules' },
            { text: 'Services', link: '/docs/architecture/server-service-modules' },
            { text: 'Server Helpers', link: '/docs/architecture/server-helper-modules' },
            { text: 'Server Common', link: '/docs/architecture/server-common' },
            { text: 'Core Helpers', link: '/docs/architecture/core-helper-modules' },
            { text: 'Testing Strategy', link: '/docs/architecture/testing-strategy' },
            { text: 'Unit Test Authoring', link: '/docs/architecture/unit-test-authoring-js' },
            { text: 'Integration Testing', link: '/docs/architecture/integration-testing' },
            { text: 'Operations Documentation', link: '/docs/architecture/operations-documentation' },
            { text: 'Module Categorization', link: '/docs/architecture/module-categorization' },
            { text: 'Complex Module Docs', link: '/docs/architecture/complex-module-docs-guide' },
          ],
        },
        {
          text: 'README Templates',
          collapsed: true,
          items: [
            { text: 'Master Template', link: '/docs/architecture/templates/README-master-template' },
            { text: 'Foundation Module', link: '/docs/architecture/templates/README-foundation-module' },
            { text: 'Feature Module', link: '/docs/architecture/templates/README-feature-module' },
            { text: 'Storage Adapter', link: '/docs/architecture/templates/README-storage-adapter' },
          ],
        },
        {
          text: 'Developer Setup',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/docs/dev/README' },
            { text: 'Git Account Setup', link: '/docs/dev/onboarding-git-account' },
            { text: 'GitHub Packages', link: '/docs/dev/onboarding-github-packages' },
            { text: 'npmrc Setup', link: '/docs/dev/npmrc-setup' },
            { text: 'CI/CD Publishing', link: '/docs/dev/cicd-publishing' },
            { text: 'Local Module Testing', link: '/docs/dev/testing-local-modules' },
            { text: 'Documentation Standards', link: '/docs/dev/documentation-standards' },
            { text: 'Pitfalls Journal', link: '/docs/dev/pitfalls' },
          ],
        },
        {
          text: 'Versioning',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/docs/versioning/' },
            { text: 'Semantic Versioning', link: '/docs/versioning/semantic-versioning' },
            { text: 'Dependency Management', link: '/docs/versioning/dependency-management' },
            { text: 'CI Dependency Graph', link: '/docs/versioning/ci-dependency-graph' },
            { text: 'Version Bump Checklist', link: '/docs/versioning/bump-checklist' },
            { text: 'Changelog Format', link: '/docs/versioning/changelog-format' },
            { text: 'API Stability', link: '/docs/versioning/api-stability-js' },
          ],
        },
        {
          text: 'Operations',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/docs/ops/README' },
          ],
        },
        {
          text: 'Website Ops',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/ops/README' },
            { text: '00 · Domain Setup', link: '/ops/00-domain/domain-setup' },
            { text: '01 · DNS (Route 53)', link: '/ops/01-dns/aws-route53-setup' },
            { text: '02 · SSL Certificate (ACM)', link: '/ops/02-ssl-certificates/aws-acm-setup' },
            { text: '03 · Object Storage (S3)', link: '/ops/03-object-storage/aws-s3-setup' },
            { text: '04 · CDN (CloudFront)', link: '/ops/04-cdn/aws-cloudfront-setup' },
            { text: '05 · IAM Policy', link: '/ops/05-identity-access/aws-iam-setup' },
            { text: '06 · CI/CD Deployment', link: '/ops/06-deployment/aws-cicd-setup' },
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

# Repository Setup (One-Time)

This guide is for whoever is creating the GitHub repository for the first time. **Regular contributors do not need to read this.** The repository already exists at [github.com/superloomdev/superloom](https://github.com/superloomdev/superloom); skip ahead to [`onboarding-git-account.md`](onboarding-git-account.md) instead.

## On This Page

- [GitHub Repository](#github-repository)
- [Step 1 - Add the Remote](#step-1---add-the-remote)
- [Step 2 - Push](#step-2---push)
- [Step 3 - Verify on GitHub](#step-3---verify-on-github)
- [Step 4 - Recommended Repository Settings](#step-4---recommended-repository-settings-github)

---

## GitHub Repository

- **Organization:** superloomdev
- **Repository name:** superloom
- **URL:** https://github.com/superloomdev/superloom
- **Visibility:** Public
- **Description:** An opinionated Node.js framework with modular helper libraries, architecture guidelines, and a demo project - built to run the same codebase on Docker and AWS Lambda.

When creating: **do not initialize with a README, .gitignore, or license** - the repository already has all of these.

---

## Step 1 - Add the Remote

```bash
git remote add origin git@github.com:superloomdev/superloom.git
```

If you have multiple GitHub accounts, override the remote to use your SSH alias (configured per [`onboarding-git-account.md`](onboarding-git-account.md)):

```bash
git remote set-url origin git@github-contrib:superloomdev/superloom.git
```

---

## Step 2 - Push

```bash
git push -u origin main
```

---

## Step 3 - Verify on GitHub

Go to https://github.com/superloomdev/superloom and confirm all files are present.

---

## Step 4 - Recommended Repository Settings (GitHub)

After the first push, configure the following under **Settings**:

- **Default branch:** `main`
- **Branch protection on `main`:**
  - Require pull request before merging
  - Require at least 1 approval
  - Disallow force pushes
- **Actions → General:** Allow GitHub Actions for CI/CD

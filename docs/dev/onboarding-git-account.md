# Git Account Setup

How to configure Git on your development machine to contribute to this repository. `superloomdev` is a GitHub organization, so you contribute through your personal GitHub account that is a member of the org. If you juggle multiple GitHub accounts on one machine, this guide also walks you through the SSH alias trick that keeps each project pushing as the right identity.

## On This Page

- [Step 1 - Check Existing SSH Keys](#step-1---check-existing-ssh-keys)
- [Step 2 - Generate an SSH Key](#step-2---generate-an-ssh-key)
- [Step 3 - Add the Public Key to GitHub](#step-3---add-the-public-key-to-github)
- [Step 4 - Configure `~/.ssh/config`](#step-4---configure-sshconfig)
- [Step 5 - Register Keys with the SSH Agent](#step-5---register-keys-with-the-ssh-agent)
- [Step 6 - Add or Verify the Remote](#step-6---add-or-verify-the-remote)
- [Step 7 - Set Local Git Identity](#step-7---set-local-git-identity-for-this-repo)
- [Step 8 - Test the Connection](#step-8---test-the-connection)
- [Step 9 - Push to GitHub](#step-9---push-to-github)
- [Quick Reference](#quick-reference)

---

## Step 1 - Check Existing SSH Keys

```bash
ls ~/.ssh/
```

If you already have an SSH key for the GitHub account you are contributing with, skip to Step 3. Otherwise continue.

---

## Step 2 - Generate an SSH Key

```bash
ssh-keygen -t ed25519 -C "your-machine-label" -f ~/.ssh/id_github_contrib
```

- The `-C` flag is a comment label to identify the key - use something like `sj-macbook` or `work-laptop`. It has no functional effect on authentication or commits
- This creates `~/.ssh/id_github_contrib` (private) and `~/.ssh/id_github_contrib.pub` (public)
- When asked for a passphrase: press Enter twice to skip, or set one for at-rest encryption of the key file

> **Note on naming:** SSH conventionally uses underscores in key file names. The remaining steps assume the underscore variant `id_github_contrib`. Pick any name you like, but keep it consistent across all the commands below.

---

## Step 3 - Add the Public Key to GitHub

1. Copy the public key:
   ```bash
   cat ~/.ssh/id_github_contrib.pub
   ```

2. Go to **GitHub (your contributing account) → Settings → SSH and GPG keys → New SSH key**
3. Paste the contents, give it a name like `macbook-dev`, save

---

## Step 4 - Configure `~/.ssh/config`

Edit or create `~/.ssh/config` to define which key to use for each host alias:

```
# Account used for contributing to superloomdev
Host github-contrib
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_github_contrib
```

The alias `github-contrib` is local to your machine only - it still connects to `github.com`, but uses the specified key. Name the alias whatever makes sense to you (`github-work`, `github-personal`, ...).

---

## Step 5 - Register Keys with the SSH Agent

```bash
ssh-add ~/.ssh/id_github_contrib
```

---

## Step 6 - Add or Verify the Remote

The repository remote is always the real GitHub URL:

```bash
git remote -v
```

If the remote is not set yet:
```bash
git remote add origin git@github.com:superloomdev/superloom.git
```

### Override for multi-account users (optional)

If your system default SSH key belongs to a different account, override the remote locally so pushes use the correct key. This change is local only - never committed:

```bash
git remote set-url origin git@github-contrib:superloomdev/superloom.git
```

Skip this if your default SSH key already belongs to the account you are contributing with.

---

## Step 7 - Set Local Git Identity for This Repo

Set your commit author identity for this repo only. Does not affect any other repo on your machine:

```bash
git config user.name "Your Name"
git config user.email "your-commit-email@example.com"
```

Verify:
```bash
git config user.name
git config user.email
```

---

## Step 8 - Test the Connection

```bash
ssh -T github-contrib
```

Expected response:
```
Hi your-username! You've successfully authenticated, but GitHub does not provide shell access.
```

---

## Step 9 - Push to GitHub

Once the repository exists on GitHub at `github.com/superloomdev/superloom`:

```bash
git push -u origin main
```

---

## Quick Reference

| Task | Command |
|---|---|
| Check identity configured for this repo | `git config user.email` |
| Check the current remote | `git remote -v` |
| Test SSH connection | `ssh -T github-contrib` |
| List all loaded SSH keys | `ssh-add -l` |
| Override remote for multi-account | `git remote set-url origin git@github-contrib:superloomdev/superloom.git` |

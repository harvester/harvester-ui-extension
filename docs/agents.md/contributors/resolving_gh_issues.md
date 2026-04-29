## Milestone guidance

- All issues must first be resolved in the `main` branch
- If backports are needed they can be made via the backport bot
  - pull requests
    - comment `@Mergifyio backport <target branch>` e.g. `@Mergifyio backport release-harvester-v1.8`
    - All backported pull requests must link to a backported issue


## Creating a branch

### To resolve an issue
- Checkout the branch matching the milestone of the issue `git checkout ${targetMilestoneBranch}`. Replace `${targetMilestoneBranch}` with the target milestone of the issue. For example
  - `main` for the latest unreleased minor version
  - `release-harvester-v.X` for release minor versions
    - `release-harvester-v1.6`
    - `release-harvester-v1.7`
    - `release-harvester-v1.8`
- Ensure you have the latest of that branch `git pull --rebase`
- Checkout the branch to commit the changes to `git checkout issue-${issueNumber}`. Replace `${issueNumber}` with the issue number.

## Creating a commit

- This project uses commit-lint with [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) to ensure consistent and meaningful commit messages.

### Commit Message Format
All commit messages must follow the conventional commit format:
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Supported Types
- feat: New features
- fix: Bug fixes
- docs: Documentation changes
- style: Code style changes (formatting, missing semicolons, etc.)
- refactor: Code refactoring
- perf: Performance improvements
- test: Adding or updating tests
- build: Build system or external dependencies
- ci: CI/CD changes
- chore: Other changes that don't modify src or test files
- revert: Reverts a previous commit
- wip: Work in progress
- deps: Dependency updates
- security: Security fixes

## Creating a Pull Request

- Pull requests must come from forks
- Description should always have commit supported type prefix. E.g `fix: XXX`, `feat: OOO`
- A Pull Request will only be merged once
  - ALL CI gates have passed
  - At least one harvester/harvester-ui-extension code owners reviews and approves the PR

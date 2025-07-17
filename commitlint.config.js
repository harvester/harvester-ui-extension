module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules:   {
    // Enforce conventional commit format
    'type-enum': [
      2,
      'always',
      [
        'feat', // New features
        'fix', // Bug fixes
        'docs', // Documentation changes
        'style', // Code style changes (formatting, missing semicolons, etc.)
        'refactor', // Code refactoring
        'perf', // Performance improvements
        'test', // Adding or updating tests
        'build', // Build system or external dependencies
        'ci', // CI/CD changes
        'chore', // Other changes that don't modify src or test files
        'revert', // Reverts a previous commit
        'wip', // Work in progress
        'deps', // Dependency updates
        'security', // Security fixes
      ]
    ],
    'type-case':              [2, 'always', 'lower-case'],
    'type-empty':             [2, 'never'],
    'subject-case':           [0, 'never'],
    'subject-empty':          [2, 'never'],
    'subject-full-stop':      [2, 'never', '.'],
    'subject-max-length':     [0, 'never'],
    'body-leading-blank':     [2, 'always'],
    'body-max-line-length':   [2, 'always', 100],
    'footer-leading-blank':   [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],
  },
  // Ignore merge commits and revert commits
  ignores: [
    (commit) => commit.includes('Merge'),
    (commit) => commit.includes('Revert'),
    (commit) => commit.includes('merge'),
    (commit) => commit.includes('revert'),
  ],
};

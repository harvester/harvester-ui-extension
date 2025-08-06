const fs = require('fs');
const path = require('path');

// GitHub API request function
async function githubRequest(endpoint) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !repo) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY environment variables are required');
  }

  const url = `https://api.github.com/repos/${ repo }${ endpoint }`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${ token }`,
      Accept:        'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${ response.status } ${ response.statusText }`);
  }

  return response.json();
}

// Get PR authors from GitHub API
async function getPRAuthors(prNumber) {
  try {
    // Get PR details
    const pr = await githubRequest(`/pulls/${ prNumber }`);

    // Get PR commits
    const commits = await githubRequest(`/pulls/${ prNumber }/commits`);

    // Collect all unique authors
    const authors = new Set();

    // Add PR creator
    if (pr.user && pr.user.login) {
      authors.add(pr.user.login);
    }

    // Add commit authors
    for (const commit of commits) {
      if (commit.author && commit.author.login) {
        authors.add(commit.author.login);
      }
      if (commit.committer && commit.committer.login) {
        authors.add(commit.committer.login);
      }
    }

    // Convert to comma-separated string
    const authorList = Array.from(authors).join(', ');

    // eslint-disable-next-line no-console
    console.log(`Found ${ authors.size } authors for PR #${ prNumber }: ${ authorList }`);

    return authorList;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(`PR #${ prNumber } not found in this repository`);

    return 'PR not found';
  }
}

// Extract PR numbers from changelog content
function extractPRNumbers(changelogContent) {
  const prNumbers = new Set();

  // Match both formats: [#PR_NUMBER] and (#PR_NUMBER)
  const patterns = [
    /\[#(\d+)\]/g, // [#123]
    /\(#(\d+)\)/g // (#123)
  ];

  for (const pattern of patterns) {
    const matches = changelogContent.match(pattern);

    if (matches) {
      for (const match of matches) {
        const prNumber = match.match(/\d+/)[0];

        prNumbers.add(prNumber);
      }
    }
  }

  return Array.from(prNumbers);
}

// Add original authors to changelog entries
async function addOriginalAuthors(changelogContent) {
  const prNumbers = extractPRNumbers(changelogContent);

  // eslint-disable-next-line no-console
  console.log(`Found ${ prNumbers.length } PR numbers to process`);

  let updatedContent = changelogContent;

  for (const prNumber of prNumbers) {
    // eslint-disable-next-line no-console
    console.log(`Processing PR #${ prNumber }...`);
    const originalAuthors = await getPRAuthors(prNumber);

    // Try new format first
    let pattern = new RegExp(`\\(\\[#${ prNumber }\\]\\([^)]+\\)\\)`, 'g');

    // If API failed, don't change the line at all
    if (originalAuthors.includes('not found') || originalAuthors.includes('API error')) {
      // eslint-disable-next-line no-console
      console.log(`Skipping PR #${ prNumber } due to API error, preserving existing content`);
      continue;
    }

    // Add @ to each individual author
    const authorsWithAt = originalAuthors.split(', ').map((author) => `@${ author.trim() }`).join(', ');

    if (updatedContent.match(pattern)) {
      updatedContent = updatedContent.replace(pattern, `([#${ prNumber }](https://github.com/NickChungSUSE/harvester-ui-extension/pull/${ prNumber })) - Authors: ${ authorsWithAt }`);
    } else {
      // Try old format - replace the entire line content after the PR number
      pattern = new RegExp(`\\(#${ prNumber }\\)[^\\n]*`, 'g');
      updatedContent = updatedContent.replace(pattern, `([#${ prNumber }](https://github.com/NickChungSUSE/harvester-ui-extension/pull/${ prNumber })) - Authors: ${ authorsWithAt }`);
    }
  }

  return updatedContent;
}

// Restore commit type prefixes to changelog entries
function restoreCommitPrefixes(changelogContent) {
  // Map of section titles to their commit type prefixes
  const sectionPrefixMap = {
    Features:                   'feat',
    'Bug Fixes':                'fix',
    'Performance Improvements': 'perf',
    Documentation:              'docs',
    'Code Style Changes':       'style',
    Refactoring:                'refactor',
    Tests:                      'test',
    'Build System':             'build',
    'CI/CD':                    'ci',
    Dependencies:               'deps',
    Security:                   'security',
    Chores:                     'chore',
    Reverts:                    'revert'
  };

  const lines = changelogContent.split('\n');
  let currentPrefix = null;

  const processedLines = lines.map((line) => {
    const trimmedLine = line.trim();

    // Check if this line is a section header (### Section Name)
    const sectionMatch = trimmedLine.match(/^### (.+)$/);

    if (sectionMatch && sectionPrefixMap[sectionMatch[1]]) {
      currentPrefix = sectionPrefixMap[sectionMatch[1]];
      // eslint-disable-next-line no-console
      console.log(`Found section: "${ sectionMatch[1] }" with prefix: "${ currentPrefix }"`);

      return line; // Return the section header as-is
    }

    // If we're in a section and this line is not empty and not a section header
    if (currentPrefix && trimmedLine && !trimmedLine.match(/^###/)) {
      // Check if prefix is already present
      if (trimmedLine.startsWith(`${ currentPrefix }: `)) {
        // eslint-disable-next-line no-console
        console.log(`Line already has prefix: "${ trimmedLine }"`);

        return line; // Already has prefix, don't add again
      }
      // If line starts with *, keep the bullet point
      if (trimmedLine.startsWith('* ')) {
        const result = `* ${ currentPrefix }: ${ trimmedLine.substring(2) }`;

        // eslint-disable-next-line no-console
        console.log(`Added prefix to bullet point: "${ result }"`);

        return result;
      }

      // Otherwise, add the prefix directly
      const result = `${ currentPrefix }: ${ trimmedLine }`;

      // eslint-disable-next-line no-console
      console.log(`Added prefix: "${ result }"`);

      return result;
    }

    // eslint-disable-next-line no-console
    console.log(`Skipping line: "${ trimmedLine }" (currentPrefix: ${ currentPrefix })`);

    return line;
  });

  return processedLines.join('\n');
}

// Main function
async function addAuthors() {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

  // eslint-disable-next-line no-console
  console.log('Script started');
  // eslint-disable-next-line no-console
  console.log('Current working directory:', process.cwd());
  // eslint-disable-next-line no-console
  console.log('Changelog path:', changelogPath);

  if (!fs.existsSync(changelogPath)) {
    // eslint-disable-next-line no-console
    console.log('CHANGELOG.md not found, skipping author addition');

    return;
  }

  // eslint-disable-next-line no-console
  console.log('CHANGELOG.md found, reading content...');
  let changelogContent = fs.readFileSync(changelogPath, 'utf8');

  // eslint-disable-next-line no-console
  console.log('Changelog content length:', changelogContent.length);
  // eslint-disable-next-line no-console
  console.log('First 200 characters:', changelogContent.substring(0, 200));

  // Add original authors to the changelog
  // eslint-disable-next-line no-console
  console.log('Adding original authors...');
  changelogContent = await addOriginalAuthors(changelogContent);

  // Restore commit type prefixes
  // eslint-disable-next-line no-console
  console.log('Restoring commit prefixes...');
  changelogContent = restoreCommitPrefixes(changelogContent);

  // Write the updated changelog
  // eslint-disable-next-line no-console
  console.log('Writing updated changelog...');
  fs.writeFileSync(changelogPath, changelogContent);
  // eslint-disable-next-line no-console
  console.log('Original authors added and prefixes restored to changelog successfully');
}

// Run the script
// eslint-disable-next-line no-console
console.log('Starting script...');
addAuthors().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Error adding original authors:', error);
  process.exit(1);
});

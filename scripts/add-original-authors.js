#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'SUSE';
const REPO_NAME = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'harvester-ui-extension';

if (!GITHUB_TOKEN) {
  // eslint-disable-next-line no-console
  console.error('GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// GitHub API helper
function githubRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path:     `/repos/${ REPO_OWNER }/${ REPO_NAME }${ endpoint }`,
      headers:  {
        Authorization: `token ${ GITHUB_TOKEN }`,
        'User-Agent':    'harvester-ui-extension-release-script'
      }
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${ data }`));
        }
      });
    }).on('error', reject);
  });
}

// Get PR authors from GitHub API
async function getPRAuthors(prNumber) {
  try {
    const pr = await githubRequest(`/pulls/${ prNumber }`);

    if (!pr.user) {
      // eslint-disable-next-line no-console
      console.warn(`PR #${ prNumber } not found in this repository`);

      return 'PR not found';
    }

    // Get all commits in the PR to find all contributors
    const commits = await githubRequest(`/pulls/${ prNumber }/commits`);

    if (!Array.isArray(commits)) {
      // eslint-disable-next-line no-console
      console.warn(`Failed to fetch commits for PR #${ prNumber }`);

      return pr.user.login; // Fallback to PR creator
    }

    // Collect all unique authors from commits
    const authors = new Set();

    authors.add(pr.user.login); // Add PR creator

    for (const commit of commits) {
      if (commit.author && commit.author.login) {
        authors.add(commit.author.login);
      }
      if (commit.committer && commit.committer.login) {
        authors.add(commit.committer.login);
      }
    }

    // Convert to array and sort
    const authorList = Array.from(authors).sort();

    // eslint-disable-next-line no-console
    console.log(`Found ${ authorList.length } authors for PR #${ prNumber }: ${ authorList.join(', ') }`);

    return authorList.join(', ');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to fetch PR ${ prNumber }: ${ error.message }`);

    return 'API error';
  }
}

// Extract PR numbers from changelog entries
function extractPRNumbers(changelogContent) {
  const prNumbers = new Set();

  // Match patterns like [#123] or (#123) in the changelog, but only the main PR references
  // Handle different formats:
  // - (#PR_NUMBER) (COMMIT_HASH) - old format
  // - (#PR_NUMBER) (COMMIT_HASH), closes - old format
  // - (#PR_NUMBER) (COMMIT_HASH), closes #OTHER_PR - old format
  // - ([#PR_NUMBER](link)) (COMMIT_HASH), closes - new format
  // We want to match the main PR reference, not the "closes #PR" part
  // Look for the first PR number that's not in the "closes" part
  const prRegex = /#(\d+)/g;
  let match;

  while ((match = prRegex.exec(changelogContent)) !== null) {
    // Add all PR numbers found in the changelog
    const prNumber = parseInt(match[1]);

    prNumbers.add(prNumber);
  }

  return prNumbers;
}

// Add original authors to changelog entries
async function addOriginalAuthors(changelogContent) {
  const prNumbers = extractPRNumbers(changelogContent);

  // eslint-disable-next-line no-console
  console.log(`Found ${ prNumbers.size } PR numbers to process`);

  let updatedContent = changelogContent;

  // Process each PR number
  for (const prNumber of prNumbers) {
    // eslint-disable-next-line no-console
    console.log(`Processing PR #${ prNumber }...`);
    const originalAuthors = await getPRAuthors(prNumber);

    // Handle both old format (#PR_NUMBER) and new format ([#PR_NUMBER](link))
    // Old format: (#PR_NUMBER) (COMMIT_HASH), closes
    // New format: ([#PR_NUMBER](link)) (COMMIT_HASH), closes
    // Try new format first
    let pattern = new RegExp(`\\(\\[#${ prNumber }\\]\\([^)]+\\)\\)`, 'g');

    if (updatedContent.match(pattern)) {
      updatedContent = updatedContent.replace(pattern, `([#${ prNumber }](https://github.com/NickChungSUSE/harvester-ui-extension/pull/${ prNumber })) - Authors: ${ originalAuthors } (merged by mergify[bot])`);
    } else {
      // Try old format - also remove any trailing ", closes" text
      pattern = new RegExp(`\\(#${ prNumber }\\)([^\\n]*)`, 'g');
      updatedContent = updatedContent.replace(pattern, `([#${ prNumber }](https://github.com/NickChungSUSE/harvester-ui-extension/pull/${ prNumber })) - Authors: ${ originalAuthors } (merged by mergify[bot])`);
    }
  }

  return updatedContent;
}

// Main function
async function addAuthors() {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    // eslint-disable-next-line no-console
    console.log('CHANGELOG.md not found, skipping author addition');

    return;
  }

  let changelogContent = fs.readFileSync(changelogPath, 'utf8');

  // Add original authors to the changelog
  changelogContent = await addOriginalAuthors(changelogContent);

  // Write the updated changelog
  fs.writeFileSync(changelogPath, changelogContent);
  // eslint-disable-next-line no-console
  console.log('Original authors added to changelog successfully');
}

// Run the script
addAuthors().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Error adding original authors:', error);
  process.exit(1);
});

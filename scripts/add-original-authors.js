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

// Get PR author from GitHub API
async function getPRAuthor(prNumber) {
  try {
    const pr = await githubRequest(`/pulls/${ prNumber }`);

    return pr.user?.login || 'unknown';
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to fetch PR ${ prNumber }: ${ error.message }`);

    return 'unknown';
  }
}

// Extract PR numbers from changelog entries
function extractPRNumbers(changelogContent) {
  const prNumbers = new Set();

  // Match patterns like (#123) in the changelog
  const prRegex = /\(#(\d+)\)/g;
  let match;

  while ((match = prRegex.exec(changelogContent)) !== null) {
    prNumbers.add(parseInt(match[1]));
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
    const originalAuthor = await getPRAuthor(prNumber);

    // Replace the pattern: (#PR_NUMBER) with author info
    const pattern = new RegExp(`\\(#${ prNumber }\\)`, 'g');

    updatedContent = updatedContent.replace(pattern, `(#${ prNumber }) - Author: ${ originalAuthor } (merged by mergify[bot])`);
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

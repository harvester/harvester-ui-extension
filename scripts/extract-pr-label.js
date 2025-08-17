/* eslint-disable no-console */
if (process.argv.length < 3) {
  console.error('No PR title as first argument');
  process.exit(1);
}

const LABEL_MAP = {
  bug:         'bugfix',
  feat:        'feature',
  docs:        'documentation',
  enhancement: 'enhancement',
  refactor:    'refactor',
  style:       'style',
  chore:       'chore',
  other:       'other'
};
const prTitle = process.argv[2];
const prLabel = prTitle.split(':')[0].trim();

console.log(LABEL_MAP[prLabel] || 'other');

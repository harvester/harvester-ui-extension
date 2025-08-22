/* eslint-disable no-console */
import load from "@commitlint/load";

if (process.argv.length < 3) {
  console.error('No PR title as first argument');
  process.exit(1);
}

const config = await load({ extends: ["./commitlint.config.js"] });

const commitPrefix = config?.rules?.['type-enum']?.[2] || [];

const LABEL_MAP = commitPrefix.reduce((acc, curr) => {
  switch(curr){
    case 'fix':
      acc[curr] = 'bugfix';
      break;
    case 'feat':
      acc[curr] = 'feature';
      break;
    case 'docs':
      acc[curr] = 'documentation';
      break;
    case 'perf':
      acc[curr] = 'performance';
      break;
    case 'deps':
      acc[curr] = 'dependency';
      break;
    default:
      acc[curr] = curr;
  }
  return acc;
}, {});

const prTitle = process.argv[2];
const prLabel = prTitle.split(':')[0].trim();

console.log(LABEL_MAP[prLabel] || 'other');

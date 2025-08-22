/* eslint-disable no-console */
import load from "@commitlint/load";

if (process.argv.length < 3) {
  console.error('No PR title as first argument');
  process.exit(1);
}

const prTitle = process.argv[2];
const prLabel = prTitle.split(':')[0].trim();

const config = await load({ extends: ["./commitlint.config.js"] });
const commitPrefix = config?.rules?.['type-enum']?.[2] || [];
const label = commitPrefix.includes(prLabel) ? prLabel : 'other';

console.log(label);

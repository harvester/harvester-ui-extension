#!/usr/bin/env node
/**
 * Summarise the accessibility report written by @rancher/cypress (cypress/accessibility/accessibility.json)
 * as a Markdown table, one row per page, for the GitHub job summary.
 *
 *   node scripts/e2e/a11y-summary.mjs [report.json] >> "$GITHUB_STEP_SUMMARY"
 */
import fs from 'node:fs';

const file = process.argv[2] || 'cypress/accessibility/accessibility.json';
const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

if (!fs.existsSync(file)) {
  console.log(`No accessibility report at \`${ file }\`.`); // eslint-disable-line no-console
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const pages = new Map();

// Each check is a leaf of the test title tree; collect its violations under the test that ran it
function walk(node, path) {
  const here = node.name ? [...path, node.name] : path;

  if (node.violations?.length) {
    const page = here.slice(1, 3).join(' > ') || here.join(' > ');
    const entry = pages.get(page) || { rules: new Map() };

    for (const v of node.violations) {
      const rule = entry.rules.get(v.id) || { impact: v.impact, help: v.help, nodes: 0 };

      rule.nodes += v.nodes?.length || 0;
      entry.rules.set(v.id, rule);
    }
    pages.set(page, entry);
  }
  (node.children || []).forEach((child) => walk(child, here));
}

(report.children || []).forEach((child) => walk(child, []));

const lines = ['### Accessibility (report only)', ''];

if (!pages.size) {
  lines.push(`No violations in ${ report.stats?.totalTests ?? 0 } checks.`);
} else {
  lines.push(`| Page | ${ IMPACTS.join(' | ') } | Rules |`, `|---|${ IMPACTS.map(() => '---:').join('|') }|---|`);
  for (const [page, { rules }] of pages) {
    const counts = IMPACTS.map((impact) => [...rules.values()].filter((r) => r.impact === impact).length || '');
    const ids = [...rules.entries()].map(([id, r]) => `\`${ id }\` (${ r.nodes })`).join(', ');

    lines.push(`| ${ page } | ${ counts.join(' | ') } | ${ ids } |`);
  }
  lines.push('', 'Counts are rules per impact; the number after each rule is how many elements fail it. The full report, with screenshots, is in the artifact this job uploaded.');
}

console.log(lines.join('\n')); // eslint-disable-line no-console

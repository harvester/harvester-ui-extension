export const COMPONENT_LABEL = 'health.harvesterhci.io/component';
export const IGNORE_RULE_SOURCE_LABEL = 'health.harvesterhci.io/source';

export const IGNORE_DURATION_DAYS = {
  days7:   7,
  days30:  30,
  forever: 0,
};

export const AFFECTED_RESOURCES_TRUNCATE_COUNT = 3;
export const MESSAGE_TRUNCATE_LENGTH = 100;

export const SEVERITY_COLORS = {
  Error:   'bg-error',
  Warning: 'bg-warning',
  Info:    'bg-info',
  Healthy: 'bg-success',
};

export const HEALTH_SUMMARY_SEVERITY_RANK = {
  Error:   0,
  Warning: 1,
  Healthy: 2,
};

export const COMPONENT_HEALTH_SEVERITIES = ['Error', 'Warning', 'Info'];

export function severityColor(severity) {
  return SEVERITY_COLORS[severity] || 'bg-info';
}

export function healthSummarySeverity(row) {
  if (row.errorCount > 0) {
    return 'Error';
  }

  if (row.warningCount > 0) {
    return 'Warning';
  }

  return 'Healthy';
}

// the summaries already leave out what is ignored
export function totalErrorCount(healthSummaries) {
  return (healthSummaries || []).reduce((total, summary) => {
    return Object.values(summary?.status?.components || {}).reduce((sum, counts) => sum + (counts?.errorCount || 0), total);
  }, 0);
}

export function componentOf(componentHealth) {
  return componentHealth?.metadata?.labels?.[COMPONENT_LABEL] || componentHealth?.metadata?.name;
}

export function allAffectedResourceNames(row) {
  return Object.keys(row?.affectedResources?.names || {});
}

// the resources that no HealthIgnoreRule ignores
export function activeAffectedResourceNames(row) {
  const names = row?.affectedResources?.names || {};

  return Object.keys(names).filter((name) => !names[name]?.ignored);
}

export function resourceIgnoredBy(row, name) {
  const detail = row?.affectedResources?.names?.[name];

  return detail?.ignored ? detail.ignoredBy : '';
}

export function ignoredResourceCount(row) {
  return allAffectedResourceNames(row).length - activeAffectedResourceNames(row).length;
}

// what "Show ignored" brings back: the checks ignored as a whole, and the ignored resources of the other checks
export function ignoredCounts(checks) {
  return (checks || []).reduce((counts, check) => {
    if (check.ignored) {
      counts.checks += 1;
    } else {
      counts.resources += ignoredResourceCount(check);
    }

    return counts;
  }, { checks: 0, resources: 0 });
}

// the UI keeps one rule per check under this name, so Kubernetes refuses a second one for the same check
export function ignoreRuleName(componentHealthName, checkName) {
  return `${ componentHealthName }.${ checkName.toLowerCase() }`;
}

export function affectedResourceKind(row) {
  return row?.affectedResources?.kind || '';
}

// what the UI calls that kind, in the singular or plural of how many there are
export function affectedResourceLabel(row, store) {
  const { apiVersion = '', kind = '' } = row?.affectedResources || {};
  const group = apiVersion.includes('/') ? `${ apiVersion.split('/')[0] }.` : '';
  const schema = store.getters['harvester/schemaFor'](`${ group }${ kind.toLowerCase() }`);

  return schema ? store.getters['type-map/labelFor'](schema, row.affectedCount) : kind;
}

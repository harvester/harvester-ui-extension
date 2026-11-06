export const COMPONENT_LABEL = 'health.harvesterhci.io/component';
export const NODE_LABEL = 'health.harvesterhci.io/node';
export const IGNORE_RULE_SOURCE_LABEL = 'health.harvesterhci.io/source';
export const IGNORED_BY_MIN_SEVERITY = 'min-severity';

export const IGNORE_DURATION_DAYS = {
  days7:   7,
  days30:  30,
  forever: 0,
};

export const AFFECTED_RESOURCES_TRUNCATE_COUNT = 5;
export const MESSAGE_TRUNCATE_LENGTH = 100;

export const SEVERITY_COLORS = {
  Critical: 'bg-error',
  Error:    'bg-error',
  Warning:  'bg-warning',
  Info:     'bg-info',
  Healthy:  'bg-success',
};

export const HEALTH_SUMMARY_SEVERITY_RANK = {
  Critical: 0,
  Warning:  1,
  Healthy:  2,
};

export const COMPONENT_HEALTH_SEVERITIES = ['Error', 'Warning', 'Info'];

export function severityColor(severity) {
  return SEVERITY_COLORS[severity] || 'bg-info';
}

export function healthSummarySeverity(row) {
  if (row.errorCount > 0) {
    return 'Critical';
  }

  if (row.warningCount > 0) {
    return 'Warning';
  }

  return 'Healthy';
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

export function affectedResourceKind(row) {
  const { apiVersion, kind } = row?.affectedResources || {};

  if (!kind) {
    return '';
  }

  return apiVersion ? `${ apiVersion }, ${ kind }` : kind;
}

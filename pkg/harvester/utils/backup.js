export const DEFAULT_FS_FREEZE_DEADLINE = '1s';

/**
 * Generate filesystem freeze deadline options with i18n translations
 * @param {Function} t - i18n translation function
 * @returns {Array} Array of deadline options
 */
export function getFsFreezeDeadlineOptions(t) {
  return [
    {
      label: t('generic.duration.infinite'),
      value: '0s'
    },
    {
      label: t('generic.duration.1s'),
      value: '1s'
    },
    {
      label: t('generic.duration.5s'),
      value: '5s'
    },
    {
      label: t('generic.duration.10s'),
      value: '10s'
    },
    {
      label: t('generic.duration.30s'),
      value: '30s'
    },
    {
      label: t('generic.duration.1m'),
      value: '1m'
    },
    {
      label: t('generic.duration.3m'),
      value: '3m'
    },
    {
      label: t('generic.duration.5m'),
      value: '5m'
    }
  ];
}

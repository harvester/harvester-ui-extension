
export function isBackupTargetSettingEmpty(setting = {}) {
  let isEmpty = true;

  if (setting?.value) {
    try {
      const valueJson = JSON.parse(setting?.value);

      isEmpty = !valueJson.type;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse backup target value:', e);
    }
  }

  return isEmpty;
}

export function isBackupTargetSettingUnavailable(setting = {}) {
  const errorMessage = setting.errorMessage;
  const isEmptyValue = isBackupTargetSettingEmpty(setting);
  const canUpdate = setting.canUpdate;

  return (errorMessage || isEmptyValue) && canUpdate;
}

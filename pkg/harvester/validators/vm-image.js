import { HCI } from '@pkg/harvester/config/labels-annotations';

export const VM_IMAGE_FILE_FORMAT = ['qcow', 'qcow2', 'raw', 'img', 'iso'];

/**
 * Extracts the filename from a URL, handling query parameters and fragments
 * @param {string} url - The URL to parse
 * @returns {string} - The filename without query params or fragments
 */
function getFilenameFromUrl(url) {
  try {
    // Try to parse as a full URL
    const urlObj = new URL(url);
    // Get pathname and extract the last segment
    const pathname = urlObj.pathname;

    return pathname.split('/').pop() || '';
  } catch (e) {
    // If URL parsing fails, treat as a relative path
    // Remove query params and fragments manually
    const cleanUrl = url.split('?')[0].split('#')[0];

    return cleanUrl.split('/').pop() || '';
  }
}

/**
 * Validates image URL format
 * @param {string} url - The image URL to validate
 * @param {object} getters - Vuex getters
 * @param {array} errors - Array to collect validation errors
 * @param {any} validatorArgs - Additional validator arguments
 * @param {string} type - Type of validation ('file' or other)
 * @returns {array} - Array of validation errors
 */
export function imageUrl(url, getters, errors, validatorArgs, type) {
  const t = getters['i18n/t'];

  if (!url || url === '') {
    return errors;
  }

  // Extract filename, handling query parameters and fragments
  const filename = getFilenameFromUrl(url);

  if (!filename) {
    const tipString = type === 'file' ? 'harvester.validation.image.ruleFileTip' : 'harvester.validation.image.ruleTip';

    errors.push(t(tipString));

    return errors;
  }

  // Get file extension
  const fileSuffix = filename.split('.').pop().toLowerCase();

  if (!VM_IMAGE_FILE_FORMAT.includes(fileSuffix)) {
    const tipString = type === 'file' ? 'harvester.validation.image.ruleFileTip' : 'harvester.validation.image.ruleTip';

    errors.push(t(tipString));
  }

  return errors;
}

export function fileRequired(annotations = {}, getters, errors, validatorArgs, type) {
  const t = getters['i18n/t'];

  if (!annotations[HCI.IMAGE_NAME]) {
    errors.push(t('validation.required', { key: t('harvester.image.fileName') }));
  }

  return errors;
}

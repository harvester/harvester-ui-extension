import { INTERNAL_STORAGE_CLASS } from '../config/types';

export function isInternalStorageClass(name) {
  return name === INTERNAL_STORAGE_CLASS.VMSTATE_PERSISTENCE ||
         name === INTERNAL_STORAGE_CLASS.LONGHORN_STATIC;
}

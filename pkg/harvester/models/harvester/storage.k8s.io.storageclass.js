import { clone } from '@shell/utils/object';
import StorageClass from '@shell/models/storage.k8s.io.storageclass';
import { HCI } from '../../types';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../../config/harvester';
import { LONGHORN_DRIVER } from '@shell/config/types';
import { DATA_ENGINE_V1, DATA_ENGINE_V2 } from '../../models/harvester/persistentvolumeclaim';
import { isInternalStorageClass } from '../../utils/storage-class';

export const LVM_DRIVER = 'lvm.driver.harvesterhci.io';

export default class HciStorageClass extends StorageClass {
  get detailLocation() {
    const detailLocation = clone(this._detailLocation);

    detailLocation.params.resource = HCI.STORAGE;
    detailLocation.name = `${ HARVESTER_PRODUCT }-c-cluster-resource-id`;

    return detailLocation;
  }

  get doneOverride() {
    const detailLocation = clone(this._detailLocation);

    delete detailLocation.params.namespace;
    delete detailLocation.params.id;
    detailLocation.params.resource = HCI.STORAGE;
    detailLocation.name = `${ HARVESTER_PRODUCT }-c-cluster-resource`;

    return detailLocation;
  }

  get parentLocationOverride() {
    return this.doneOverride;
  }

  get parentNameOverride() {
    return this.$rootGetters['i18n/t'](`typeLabel."${ HCI.STORAGE }"`, { count: 1 })?.trim();
  }

  get longhornVersion() {
    if (this.provisioner === LONGHORN_DRIVER) {
      return (this.parameters || {}).dataEngine || DATA_ENGINE_V1;
    }

    return null;
  }

  get provisionerDisplay() {
    let key = '';

    if (this.provisioner === LONGHORN_DRIVER) {
      key = `harvester.storage.storageClass.longhorn.${ this.longhornVersion }.label`;
    }

    if (this.provisioner === LVM_DRIVER) {
      key = `harvester.storage.storageClass.lvm.label`;
    }

    return key ? this.$rootGetters['i18n/t'](key) : this.provisioner;
  }

  get isEncrypted() {
    return this.parameters?.encrypted === 'true';
  }

  get isLonghorn() {
    return this.provisioner === LONGHORN_DRIVER;
  }

  get isLonghornV1() {
    return this.provisioner === LONGHORN_DRIVER && this.longhornVersion === DATA_ENGINE_V1;
  }

  get isLonghornV2() {
    return this.provisioner === LONGHORN_DRIVER && this.longhornVersion === DATA_ENGINE_V2;
  }

  get longhornV2LVMSupport() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('longhornV2LVMSupport');
  }

  get volumeEncryptionFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('volumeEncryption');
  }

  get thirdPartyStorageFeatureEnabled() {
    return this.$rootGetters['harvester-common/getFeatureEnabled']('thirdPartyStorage');
  }

  isInternalStorageClass() {
    return isInternalStorageClass(this.metadata?.name);
  }

  get availableActions() {
    let out = super.availableActions || [];

    out = out.map((action) => {
      if ((action.action === 'setDefault' || action.action === 'setAsDefault' || action.action === 'promptRemove') && this.isInternalStorageClass()) {
        return { ...action, enabled: false };
      }

      return action;
    });

    return out;
  }
}

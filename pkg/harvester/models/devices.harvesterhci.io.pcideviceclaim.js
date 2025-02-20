import SteveModel from '@shell/plugins/steve/steve-class';

/**
 * Class representing PCI Device Claim resource.
 * @extends SteveModal
 */
export default class PCIDeviceClaim extends SteveModel {
  cleanForSave(data, _forNew) {
    return data;
  }
}

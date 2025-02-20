import SteveModel from '@shell/plugins/steve/steve-class';

/**
 * Class representing USB Device Claim resource.
 * @extends SteveModal
 */
export default class USBDeviceClaim extends SteveModel {
  cleanForSave(data, _forNew) {
    return data;
  }
}

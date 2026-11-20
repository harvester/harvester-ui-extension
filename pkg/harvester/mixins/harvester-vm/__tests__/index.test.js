import VM_MIXIN from '../index';
import impl from '../impl';
import { SOURCE_TYPE } from '../../../config/harvester-map';

const USER_ERROR = 'harvester.virtualMachine.cloudConfig.user.invalidYaml';
const NETWORK_ERROR = 'harvester.virtualMachine.cloudConfig.network.invalidYaml';
const CLOUD_CONFIG = '#cloud-config\npackage_update: true\npackages:\n  - qemu-guest-agent\n';
const YAML_SCRIPT = '#!/bin/bash\napt-get update\napt-get install -y nginx\n';

function validate({
  userScript, networkScript, isEdit = false, savedCloudInit = {}
}) {
  const form = {
    userScript,
    networkScript,
    isEdit,
    savedCloudInit,
    errors: [],
    t:      (key) => key,
  };

  VM_MIXIN.methods.validateCloudInit.call(form);

  return form.errors;
}

function userDataFor(userScript) {
  const form = {
    userScript,
    sshKey: [],
    $store: { getters: { 'harvester/byId': () => undefined } },
    ...impl.methods,
    ...VM_MIXIN.methods,
  };

  return form.getUserData({ osType: 'linux', installAgent: false });
}

const ISO_IMAGE = { id: 'default/image-iso', storageClassName: 'longhorn-image-iso' };

function imageVolumeClaimTemplate(row, hasCreateVolumes = []) {
  const form = { images: [ISO_IMAGE], hasCreateVolumes };

  return VM_MIXIN.methods.parseVolumeClaimTemplate.call(form, {
    source: SOURCE_TYPE.IMAGE, image: ISO_IMAGE.id, size: '20Gi', accessMode: 'ReadWriteMany', volumeMode: 'Block', ...row
  }, 'vm-cdrom-disk-abcde');
}

describe('mixin: harvester-vm', () => {
  describe('validateCloudInit', () => {
    it.each([
      ['a word after the mapping', `${ CLOUD_CONFIG }some words\n`],
      ['only words', '#cloud-config\nsome words\n'],
      ['only words and no header', 'some words\n'],
      ['a list', '#cloud-config\n- a\n- b\n'],
      ['bad indentation', '#cloud-config\nusers:\n  - name: a\n bad: b\n'],
      ['an unclosed quote', '#cloud-config\npassword: "abc\n'],
    ])('should block cloud-config user data with %s', (_, userScript) => {
      expect(validate({ userScript })).toStrictEqual([USER_ERROR]);
    });

    it.each([
      ['undefined', undefined],
      ['empty', ''],
      ['only the header', '#cloud-config\n'],
      ['a valid cloud-config', CLOUD_CONFIG],
      ['a mapping without the header', 'password: test\n'],
    ])('should allow user data that is %s', (_, userScript) => {
      expect(validate({ userScript })).toStrictEqual([]);
    });

    it.each([
      ['a script that is not valid YAML', '#!/bin/bash\napt-get update\n# start it\nsystemctl enable --now nginx\n'],
      ['a script that parses as YAML', YAML_SCRIPT],
      ['a MIME message with a cloud-config part', 'Content-Type: multipart/mixed; boundary="b"\nMIME-Version: 1.0\n\n--b\nContent-Type: text/cloud-config\n\n#cloud-config\npackages:\n  - nginx\n--b--\n'],
      ['a Jinja template', '## template: jinja\n#cloud-config\n{% if v1.region == "us" %}\npackages:\n  - a\n{% endif %}\n'],
      ['a Cloudbase-Init PowerShell script', '#ps1_sysnative\n# enable RDP\nWrite-Host "done: ok"\n'],
      ['a Cloudbase-Init batch script', 'rem cmd\nnet user admin Passw0rd /add\n'],
      ['a cloud-config archive', '#cloud-config-archive\n- type: text/x-shellscript\n  content: |\n    #!/bin/sh\n'],
    ])('should not parse user data that is %s', (_, userScript) => {
      expect(validate({ userScript })).toStrictEqual([]);
    });

    it.each([
      ['words', 'some words\n'],
      ['a list', '- a\n- b\n'],
      ['bad indentation', 'network:\n  version: 1\n bad: x\n'],
    ])('should block network data with %s', (_, networkScript) => {
      expect(validate({ networkScript })).toStrictEqual([NETWORK_ERROR]);
    });

    it.each([
      ['undefined', undefined],
      ['empty', ''],
      ['only whitespace', '  \n'],
      ['only a comment', '# nothing yet\n'],
      ['a valid config', 'network:\n  version: 1\n  config:\n    - type: physical\n      name: eth0\n'],
    ])('should allow network data that is %s', (_, networkScript) => {
      expect(validate({ networkScript })).toStrictEqual([]);
    });

    it('should report both fields when both are invalid', () => {
      const errors = validate({ userScript: '#cloud-config\nsome words\n', networkScript: 'some words\n' });

      expect(errors).toStrictEqual([USER_ERROR, NETWORK_ERROR]);
    });

    it('should save an edited VM with the cloud-init it already has', () => {
      const savedCloudInit = {
        userScript:    '#cloud-config\n#!/bin/bash\napt-get update apt-get install -y nginx\n',
        networkScript: 'some words\n',
      };

      const errors = validate({
        ...savedCloudInit, isEdit: true, savedCloudInit
      });

      expect(errors).toStrictEqual([]);
    });

    it('should check cloud-init changed while editing', () => {
      const savedCloudInit = { userScript: CLOUD_CONFIG, networkScript: '' };
      const errors = validate({
        userScript: '#cloud-config\nsome words\n', networkScript: 'some words\n', isEdit: true, savedCloudInit
      });

      expect(errors).toStrictEqual([USER_ERROR, NETWORK_ERROR]);
    });

    it('should check cloud-init a new VM takes from a template', () => {
      const savedCloudInit = { userScript: '#cloud-config\nsome words\n' };

      expect(validate({ ...savedCloudInit, savedCloudInit })).toStrictEqual([USER_ERROR]);
    });
  });

  describe('getUserData', () => {
    it.each([
      ['a script that parses as YAML', YAML_SCRIPT],
      ['a Cloudbase-Init batch script', 'rem cmd\nnet user admin Passw0rd /add\n'],
      ['a Cloudbase-Init PowerShell script', '#ps1_sysnative\nWrite-Host done\n'],
      ['a cloud-config archive', '#cloud-config-archive\n- type: text/x-shellscript\n  content: echo hi\n'],
    ])('should save %s as typed', (_, userScript) => {
      expect(userDataFor(userScript)).toStrictEqual(userScript);
    });

    it('should add the header to cloud-config typed without one', () => {
      expect(userDataFor('password: test\n')).toBe('#cloud-config\npassword: test\n');
    });
  });

  describe('parseVolumeClaimTemplate', () => {
    it('should use the image StorageClass for a template volume that does not exist yet', () => {
      const out = imageVolumeClaimTemplate({ realName: 'pvc-cdrom-disk', storageClassName: undefined });

      expect(out.spec.storageClassName).toBe(ISO_IMAGE.storageClassName);
      expect(out.metadata.annotations).toStrictEqual({ 'harvesterhci.io/imageId': ISO_IMAGE.id });
    });

    it('should use the image StorageClass for a new volume', () => {
      const out = imageVolumeClaimTemplate({ realName: '', storageClassName: '' });

      expect(out.spec.storageClassName).toBe(ISO_IMAGE.storageClassName);
    });

    it('should keep the StorageClass of an existing volume', () => {
      const out = imageVolumeClaimTemplate({ realName: 'vm-disk-0-abcde', storageClassName: 'custom-sc' }, ['vm-disk-0-abcde']);

      expect(out.spec.storageClassName).toBe('custom-sc');
    });
  });
});

import VM_MIXIN from '../index';

const USER_ERROR = 'harvester.virtualMachine.cloudConfig.user.invalidYaml';
const NETWORK_ERROR = 'harvester.virtualMachine.cloudConfig.network.invalidYaml';
const CLOUD_CONFIG = '#cloud-config\npackage_update: true\npackages:\n  - qemu-guest-agent\n';

function validate({ userScript, networkScript }) {
  const form = {
    userScript,
    networkScript,
    errors: [],
    t:      (key) => key,
  };

  VM_MIXIN.methods.validateCloudInit.call(form);

  return form.errors;
}

describe('mixin: harvester-vm', () => {
  describe('validateCloudInit', () => {
    it.each([
      ['a word after the mapping', `${ CLOUD_CONFIG }some words\n`],
      ['only words', '#cloud-config\nsome words\n'],
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
    ])('should allow user data that is %s', (_, userScript) => {
      expect(validate({ userScript })).toStrictEqual([]);
    });

    it.each([
      ['a script that is not valid YAML', '#!/bin/bash\napt-get update\n# start it\nsystemctl enable --now nginx\n'],
      ['a MIME message with a cloud-config part', 'Content-Type: multipart/mixed; boundary="b"\nMIME-Version: 1.0\n\n--b\nContent-Type: text/cloud-config\n\n#cloud-config\npackages:\n  - nginx\n--b--\n'],
      ['a Jinja template', '## template: jinja\n#cloud-config\n{% if v1.region == "us" %}\npackages:\n  - a\n{% endif %}\n'],
      ['a Cloudbase-Init PowerShell script', '#ps1_sysnative\n# enable RDP\nWrite-Host "done: ok"\n'],
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
  });
});

import { HCI } from '@pkg/harvester/types';
import VM_MIXIN from '@pkg/harvester/mixins/harvester-vm';
import HarvesterEditTemplateVersion from '../harvesterhci.io.virtualmachinetemplateversion.vue';

async function saveWith(userScript) {
  const buttonCb = jest.fn();
  const form = {
    userScript,
    errors:            [],
    t:                 (key) => key,
    parseVM:           jest.fn(),
    validateCloudInit: VM_MIXIN.methods.validateCloudInit,
    templateValue:     { metadata: {} },
    $store:            { dispatch: jest.fn().mockResolvedValue([]) },
  };

  await HarvesterEditTemplateVersion.methods.saveVMT.call(form, buttonCb);

  return { form, buttonCb };
}

describe('page: harvesterhci.io.virtualmachinetemplateversion edit', () => {
  it('should stop the save when the cloud config is invalid', async() => {
    const { form, buttonCb } = await saveWith('#cloud-config\nsome words\n');

    expect(form.errors).toStrictEqual(['harvester.virtualMachine.cloudConfig.user.invalidYaml']);
    expect(buttonCb).toHaveBeenCalledWith(false);
    expect(form.$store.dispatch).not.toHaveBeenCalled();
  });

  it('should go on with the save when the user data is a script', async() => {
    const { form } = await saveWith('#!/bin/bash\napt-get update\n# start it\nsystemctl enable --now nginx\n');

    expect(form.$store.dispatch).toHaveBeenCalledWith('harvester/findAll', { type: HCI.VM_TEMPLATE });
  });
});

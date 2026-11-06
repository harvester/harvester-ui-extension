import HarvesterEditVlanConfig from '../index.vue';

const { uplinkMode, isIsolatedUplink } = HarvesterEditVlanConfig.computed;

// The form's `this` for the uplink mode, for a network configuration with the given uplink
function form(uplink) {
  const ctx = {
    value:      { metadata: { name: 'storage-mesh' }, spec: { clusterNetwork: 'storage', uplink } },
    nicOptions: [],
    t:          (key) => key,
  };

  Object.defineProperty(ctx, 'uplinkMode', {
    get: () => uplinkMode.get.call(ctx),
    set: (v) => {
      uplinkMode.set.call(ctx, v);
    }
  });
  Object.defineProperty(ctx, 'isIsolatedUplink', { get: () => isIsolatedUplink.call(ctx) });

  return ctx;
}

describe('edit: network.harvesterhci.io.vlanconfig uplink mode', () => {
  it('should default to bond', () => {
    expect(form({ nics: ['eth1'] }).uplinkMode).toBe('bond');
    expect(form(undefined).uplinkMode).toBe('bond');
  });

  it('should read an isolated uplink', () => {
    const ctx = form({ nics: ['eth1', 'eth2'], mode: 'isolated' });

    expect(ctx.uplinkMode).toBe('isolated');
    expect(ctx.isIsolatedUplink).toBe(true);
  });

  it('should write the isolated mode to the uplink', () => {
    const ctx = form({ nics: ['eth1', 'eth2'], bondOptions: { mode: 'active-backup', miimon: -1 } });

    ctx.uplinkMode = 'isolated';

    expect(ctx.value.spec.uplink.mode).toBe('isolated');
  });

  it('should restore the default bond options when switched back to bond', () => {
    const ctx = form({ nics: ['eth1', 'eth2'], mode: 'isolated' });

    ctx.uplinkMode = 'bond';

    expect(ctx.value.spec.uplink).toStrictEqual({ nics: ['eth1', 'eth2'], bondOptions: { mode: 'active-backup', miimon: -1 } });
  });

  it('should keep bond options that are already set when switched back to bond', () => {
    const ctx = form({
      nics: ['eth1'], mode: 'isolated', bondOptions: { mode: '802.3ad', miimon: 100 }
    });

    ctx.uplinkMode = 'bond';

    expect(ctx.value.spec.uplink).toStrictEqual({ nics: ['eth1'], bondOptions: { mode: '802.3ad', miimon: 100 } });
  });

  it('should not save bond options for an isolated uplink', async() => {
    const ctx = form({
      nics: ['eth1', 'eth2'], mode: 'isolated', bondOptions: { mode: 'active-backup', miimon: -1 }
    });

    await HarvesterEditVlanConfig.methods.validate.call(ctx);

    expect(ctx.value.spec.uplink).toStrictEqual({ nics: ['eth1', 'eth2'], mode: 'isolated' });
  });

  it('should keep the bond options of a bonded uplink', async() => {
    const ctx = form({ nics: ['eth1'], bondOptions: { mode: 'active-backup', miimon: -1 } });

    await HarvesterEditVlanConfig.methods.validate.call(ctx);

    expect(ctx.value.spec.uplink.bondOptions).toStrictEqual({ mode: 'active-backup', miimon: -1 });
  });
});

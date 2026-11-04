import HarvesterSettingList from '../harvesterhci.io.setting.vue';

// The `customized` flag of a row in the settings list, for the given setting
function customized(data, row = {}) {
  const [setting] = HarvesterSettingList.computed.settings.call({ initSettings: [{ id: 'test', data, ...row }] });

  return !!setting.customized;
}

describe('list: harvesterhci.io.setting', () => {
  it('should tag a setting as modified when its value differs from the default', () => {
    expect(customized({ value: 'a', default: 'b' })).toBe(true);
  });

  it.each([
    [{ value: '', default: 'b' }],
    [{ value: 'b', default: 'b' }],
  ])('should not tag %j as modified', (data) => {
    expect(customized(data)).toBe(false);
  });

  it('should compare json settings by their content', () => {
    expect(customized({ value: '{ "a": 1 }', default: '{"a":1}' }, { kind: 'json' })).toBe(false);
    expect(customized({ value: '{"a":2}', default: '{"a":1}' }, { kind: 'json' })).toBe(true);
  });

  it('should let the setting decide when it knows what counts as modified', () => {
    expect(customized({
      value: 'a', default: 'b', hasCustomized: false
    })).toBe(false);
    expect(customized({
      value: '', default: '', hasCustomized: true
    })).toBe(true);
  });
});

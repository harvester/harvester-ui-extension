import { shallowMount } from '@vue/test-utils';
import NovncViewOptions, { VIEW_MODE } from '../NovncViewOptions.vue';

jest.mock('../ZoomableRFB', () => ({
  MINIMUM_ZOOM: 50, MAXIMUM_ZOOM: 200, ZOOM_STEP: 10
}));

const settings = {
  viewMode: VIEW_MODE.NONE, zoomPercent: 100, qualityLevel: 6, compressionLevel: 2
};

const mountOptions = (overrides = {}) => shallowMount(NovncViewOptions, { props: { settings: { ...settings, ...overrides } } });

describe('component: NovncViewOptions', () => {
  it('should emit the whole settings object with the changed value', () => {
    const wrapper = mountOptions();

    wrapper.vm.update('qualityLevel', 9);

    expect(wrapper.emitted('update')).toStrictEqual([[{ ...settings, qualityLevel: 9 }]]);
  });

  it('should step the zoom and stop at its limits', () => {
    const wrapper = mountOptions({ zoomPercent: 200 });

    wrapper.vm.stepZoom(1);
    wrapper.vm.stepZoom(-1);

    expect(wrapper.emitted('update').map(([value]) => value.zoomPercent)).toStrictEqual([200, 190]);
  });

  it('should only treat the manual mode as manual', () => {
    expect(mountOptions().vm.isManual).toBe(true);
    expect(mountOptions({ viewMode: VIEW_MODE.SCALE }).vm.isManual).toBe(false);
  });
});

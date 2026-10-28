import { mount } from '@vue/test-utils';
import { createStore } from 'vuex';
import HealthSummaryTable from '../HealthSummaryTable.vue';
import ComponentHealthSection from '../ComponentHealthSection.vue';

const store = createStore({
  getters: {
    'i18n/t': () => (k) => k, 'i18n/exists': () => () => true, 'prefs/get': () => () => false
  },
  actions: { 'growl/success': jest.fn() }
});
const opts = (props) => ({
  props,
  global: {
    plugins: [store],
    stubs:   {
      SortableTable: { props: ['rows'], template: '<div class="st">{{ rows.map(r => r.id + ":" + (r.severityRank ?? r.severity)).join(",") }}</div>' }, Tabbed: { template: '<div><slot /></div>' }, Tab: { template: '<div><slot /></div>' }
    }
  }
});

describe('health components', () => {
  it('ranks the health summary rows by severity', () => {
    const w = mount(HealthSummaryTable, opts({
      healthSummaries: [{
        id:     'a',
        status: {
          components: {
            x: { errorCount: 1 }, y: {}, z: { warningCount: 2 }
          }
        }
      }]
    }));

    expect(w.find('.st').text()).toBe('a/x:0,a/y:2,a/z:1');
  });
  it('renders a table for each component', () => {
    const w = mount(ComponentHealthSection, opts({
      componentHealths: [{
        id: 'h', metadata: { name: 'c', labels: {} }, status: { checks: { k: { severity: 'Error', message: 'm' } } }
      }],
      ignoreRules: []
    }));

    expect(w.find('.st').text()).toBe('h/k:0');
  });
  it('ranks the component health rows Error, Warning, Info', () => {
    const checks = {
      a: { severity: 'Info' }, b: { severity: 'Error' }, c: { severity: 'Warning' }
    };
    const w = mount(ComponentHealthSection, opts({
      componentHealths: [{
        id: 'h', metadata: { name: 'c', labels: {} }, status: { checks }
      }],
      ignoreRules: []
    }));

    expect(w.find('.st').text()).toBe('h/a:2,h/b:0,h/c:1');
  });
});

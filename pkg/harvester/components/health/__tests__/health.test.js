import { mount } from '@vue/test-utils';
import { createStore } from 'vuex';
import { Checkbox } from '@components/Form/Checkbox';
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
  it('expands a long message', async() => {
    const message = 'x'.repeat(150);
    const checks = { a: { severity: 'Error', message } };
    const table = { props: ['rows'], template: '<div><slot name="cell:message" :row="rows[0]" :value="rows[0].message" /></div>' };
    const w = mount(ComponentHealthSection, {
      ...opts({
        componentHealths: [{
          id: 'h', metadata: { name: 'c', labels: {} }, status: { checks }
        }],
        ignoreRules: []
      }),
      global: { ...opts({}).global, stubs: { ...opts({}).global.stubs, SortableTable: table } }
    });

    expect(w.text()).not.toContain(message);

    await w.find('button.role-link').trigger('click');

    expect(w.text()).toContain(message);
  });
  it('tells an empty filter result from a report without checks', async() => {
    const checks = { a: { severity: 'Error' } };
    const dropdown = { template: '<div><slot /><slot name="popper" /></div>' };
    const base = opts({
      componentHealths: [{
        id: 'h', metadata: { name: 'c', labels: {} }, status: { checks }
      }],
      ignoreRules: []
    });
    const w = mount(ComponentHealthSection, { ...base, global: { ...base.global, stubs: { ...base.global.stubs, 'v-dropdown': dropdown } } });

    expect(w.text()).not.toContain('noIssues');

    // the first filter is Error
    await w.findComponent(Checkbox).vm.$emit('update:value', false);

    expect(w.text()).toContain('noMatchingChecks');

    const empty = mount(ComponentHealthSection, opts({
      componentHealths: [{
        id: 'h', metadata: { name: 'c', labels: {} }, status: { checks: {} }
      }],
      ignoreRules: []
    }));

    expect(empty.text()).toContain('noIssues');
  });
});

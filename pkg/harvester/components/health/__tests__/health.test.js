import { mount as vtuMount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import { Checkbox } from '@components/Form/Checkbox';
import { HCI } from '../../../types';
import HealthSummaryTable from '../HealthSummaryTable.vue';
import ComponentHealthSection from '../ComponentHealthSection.vue';

const TYPES = {
  healthSummaries:  HCI.HEALTH_SUMMARY,
  componentHealths: HCI.COMPONENT_HEALTH,
  ignoreRules:      HCI.HEALTH_IGNORE_RULE,
};

// resources are fetched by the components themselves, so serve them from a mocked store
const opts = (props = {}) => {
  const store = createStore({
    getters: {
      'i18n/t':              () => (k) => k,
      'i18n/exists':         () => () => true,
      'prefs/get':           () => () => false,
      currentProduct:        () => ({ inStore: 'harvester' }),
      'harvester/schemaFor': () => () => ({}),
    },
    actions: {
      'growl/success':     jest.fn(),
      'harvester/findAll': (_, { type }) => {
        const key = Object.keys(TYPES).find((k) => TYPES[k] === type);

        return props[key] || [];
      },
    }
  });

  return {
    global: {
      plugins: [store],
      stubs:   {
        SortableTable: { props: ['rows'], template: '<div class="st">{{ rows.map(r => r.id + ":" + (r.severityRank ?? r.severity)).join(",") }}</div>' }, Tabbed: { template: '<div><slot /></div>' }, Tab: { template: '<div><slot /></div>' }
      }
    }
  };
};

const mount = async(component, options) => {
  const w = vtuMount(component, options);

  await flushPromises();

  return w;
};

describe('health components', () => {
  it('ranks the health summary rows by severity', async() => {
    const w = await mount(HealthSummaryTable, opts({
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
  it('renders a table for each component', async() => {
    const w = await mount(ComponentHealthSection, opts({
      componentHealths: [{
        id: 'h', metadata: { name: 'c', labels: {} }, status: { checks: { k: { severity: 'Error', message: 'm' } } }
      }],
      ignoreRules: []
    }));

    expect(w.find('.st').text()).toBe('h/k:0');
  });
  it('ranks the component health rows Error, Warning, Info', async() => {
    const checks = {
      a: { severity: 'Info' }, b: { severity: 'Error' }, c: { severity: 'Warning' }
    };
    const w = await mount(ComponentHealthSection, opts({
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
    const base = opts({
      componentHealths: [{
        id: 'h', metadata: { name: 'c', labels: {} }, status: { checks }
      }],
      ignoreRules: []
    });
    const w = await mount(ComponentHealthSection, { ...base, global: { ...base.global, stubs: { ...base.global.stubs, SortableTable: table } } });

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
    const w = await mount(ComponentHealthSection, { ...base, global: { ...base.global, stubs: { ...base.global.stubs, 'v-dropdown': dropdown } } });

    expect(w.text()).not.toContain('noIssues');

    // the first filter is Error
    await w.findComponent(Checkbox).vm.$emit('update:value', false);

    expect(w.text()).toContain('noMatchingChecks');

    const empty = await mount(ComponentHealthSection, opts({
      componentHealths: [{
        id: 'h', metadata: { name: 'c', labels: {} }, status: { checks: {} }
      }],
      ignoreRules: []
    }));

    expect(empty.text()).toContain('noIssues');
  });
});

import { mount as vtuMount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import { Checkbox } from '@components/Form/Checkbox';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import { RcModal } from '@components/RcModal';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { HCI } from '../../../types';
import HealthSummaryTable from '../HealthSummaryTable.vue';
import ComponentChecksTable from '../ComponentChecksTable.vue';
import IgnoreCheckModal from '../IgnoreCheckModal.vue';

jest.mock('focus-trap', () => ({
  createFocusTrap: jest.fn(() => ({
    activate:   jest.fn(),
    deactivate: jest.fn(),
  })),
}));

const TYPES = {
  healthSummaries:  HCI.HEALTH_SUMMARY,
  componentHealths: HCI.COMPONENT_HEALTH,
  ignoreRules:      HCI.HEALTH_IGNORE_RULE,
};

const saveRule = jest.fn();
const createRule = jest.fn(() => ({ save: saveRule }));
let store;

// resources are fetched by the components themselves, so serve them from a mocked store
const opts = (props = {}) => {
  store = createStore({
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
      'harvester/create': createRule,
    }
  });

  return { global: { plugins: [store], stubs: { teleport: true } } };
};

const toggleExpand = jest.fn();

// renders the summary rows with every sub-row open, and the checks of each sub-row
const summaryTable = {
  props: ['rows'],
  data() {
    return { searchQuery: '' };
  },
  computed: {
    filteredRows() {
      return this.rows.filter((row) => row.checksFilterText.includes(this.searchQuery));
    }
  },
  methods:  { toggleExpand, isExpanded: () => false },
  template: `<div>
    <slot name="header-left" />
    <div class="summary">{{ rows.map(r => r.id + ":" + r.severityRank).join(",") }}</div>
    <div v-for="row in rows" :key="row.id" class="name"><slot name="cell:component" :row="row" /></div>
    <div v-for="row in rows" :key="row.id" :class="'sub-' + row.component"><slot name="sub-row" :row="row" :fullColspan="1" /></div>
  </div>`,
};

const checksTable = { props: ['rows'], template: '<div class="checks">{{ rows.map(r => r.id + ":" + r.severityRank).join(",") }}</div>' };

const mountSummary = async(props) => {
  const base = opts(props);
  const w = vtuMount(HealthSummaryTable, { ...base, global: { ...base.global, stubs: { ...base.global.stubs, SortableTable: summaryTable } } });

  await flushPromises();

  return w;
};

const mountChecks = (props, stubs = {}) => {
  const base = opts();

  return vtuMount(ComponentChecksTable, {
    ...base,
    props,
    global: {
      ...base.global,
      stubs: {
        ...base.global.stubs, SortableTable: checksTable, ...stubs
      }
    },
  });
};

const summaryOf = (components) => ({ id: 's', status: { components } });
const healthOf = (id, component, checks) => ({
  id, metadata: { name: id, labels: { 'health.harvesterhci.io/component': component } }, status: { checks }
});

const CHECK_TO_IGNORE = {
  id:                  'h/a',
  componentHealthName: 'h',
  checkName:           'a',
  affectedResources:   { kind: 'VirtualMachine', names: { one: {}, two: {} } },
};

const mountIgnoreModal = (save = () => {}) => {
  createRule.mockClear();
  saveRule.mockReset().mockImplementation(save);

  const onClose = jest.fn();
  const w = vtuMount(IgnoreCheckModal, {
    ...opts(),
    props: { row: CHECK_TO_IGNORE, modal: { show: true, onClose } },
  });

  return {
    w,
    onClose,
    confirm: () => w.find('[data-testid="component-health-ignore-confirm"]'),
    created: () => createRule.mock.calls[0][1],
  };
};

describe('health components', () => {
  it('ranks the health summary rows by severity', async() => {
    const w = await mountSummary({
      healthSummaries: [{
        id:     'a',
        status: {
          components: {
            x: { errorCount: 1 }, y: {}, z: { warningCount: 2 }
          }
        }
      }]
    });

    expect(w.find('.summary').text()).toBe('a/x:0,a/y:2,a/z:1');
  });
  it('opens a row from the component name, which takes the keyboard focus', async() => {
    toggleExpand.mockClear();

    const w = await mountSummary({ healthSummaries: [summaryOf({ x: {} })] });
    const name = w.find('.name button');

    expect(name.text()).toBe('x');
    expect(name.attributes('aria-expanded')).toBe('false');

    await name.trigger('click');

    expect(toggleExpand.mock.calls.map(([row]) => row.component)).toStrictEqual(['x']);
  });
  it('shows the checks of a component in its sub-row', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { errorCount: 1 }, y: { warningCount: 1 } })],
      componentHealths: [
        healthOf('h1', 'x', { a: { severity: 'Error' } }),
        healthOf('h2', 'y', { b: { severity: 'Warning' } }),
        healthOf('h3', 'x', { c: { severity: 'Error' } }),
      ],
    });
    const rowsOf = (component) => w.findAllComponents(ComponentChecksTable).find((c) => c.element.closest(`.sub-${ component }`)).props('rows').map((r) => r.id);

    expect(rowsOf('x')).toStrictEqual(['h1/a', 'h3/c']);
    expect(rowsOf('y')).toStrictEqual(['h2/b']);
  });
  it('ranks the checks Error, Warning, Info', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { errorCount: 1 } })],
      componentHealths: [healthOf('h', 'x', {
        a: { severity: 'Info' }, b: { severity: 'Error' }, c: { severity: 'Warning' }
      })],
    });

    expect(w.findComponent(ComponentChecksTable).props('rows').map((r) => `${ r.id }:${ r.severityRank }`)).toStrictEqual(['h/a:2', 'h/b:0', 'h/c:1']);
  });
  it('only shows the checks the table filter found', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { errorCount: 1 }, y: { errorCount: 1, warningCount: 1 } })],
      componentHealths: [
        healthOf('h1', 'x', { a: { severity: 'Error' } }),
        healthOf('h2', 'y', { b: { severity: 'Error', message: 'Disk is full' }, c: { severity: 'Warning', message: 'Disk is slow' } }),
      ],
    });
    const filterBy = (searchQuery) => w.findComponent(summaryTable).setData({ searchQuery });
    const rowsOf = (component) => w.findAllComponents(ComponentChecksTable).find((c) => c.element.closest(`.sub-${ component }`)).props('rows').map((r) => r.id);

    await filterBy('  WARN ');
    expect(rowsOf('y')).toStrictEqual(['h2/c']);

    await filterBy('disk, full');
    expect(rowsOf('y')).toStrictEqual(['h2/b']);

    await filterBy('');
    expect(rowsOf('y')).toStrictEqual(['h2/b', 'h2/c']);
  });
  it('keeps all the checks of a row the table filter found by its own columns', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { errorCount: 1 } })],
      componentHealths: [healthOf('h', 'x', { a: { severity: 'Error' }, b: { severity: 'Warning' } })],
    });

    await w.findComponent(summaryTable).setData({ searchQuery: 'critical' });

    expect(w.findComponent(ComponentChecksTable).props('rows').map((r) => r.id)).toStrictEqual(['h/a', 'h/b']);
    expect(w.findComponent(summaryTable).props('rows')[0].severity).toBe('Critical');
  });
  it('gives the table filter what a sub-row shows', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { warningCount: 1 } })],
      componentHealths: [healthOf('h', 'x', {
        a: {
          severity:          'Warning',
          message:           'Some Message',
          affectedResources: { kind: 'VirtualMachine', names: { 'vm-shown': {}, 'vm-hidden': { ignored: true } } },
        }
      })],
    });
    const filterText = () => w.findComponent(summaryTable).props('rows')[0].checksFilterText;

    ['x', 'warning', 'a', 'some message', 'virtualmachine', 'vm-shown'].forEach((text) => expect(filterText()).toContain(text));
    expect(filterText()).not.toContain('vm-hidden');

    await w.findComponent(Checkbox).vm.$emit('update:value', true);

    expect(filterText()).toContain('vm-hidden');
  });
  it('opens the rows the table filter found', async() => {
    toggleExpand.mockClear();

    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { errorCount: 1 }, y: { warningCount: 1 } })],
      componentHealths: [healthOf('h1', 'x', { a: { severity: 'Error' } }), healthOf('h2', 'y', { b: { severity: 'Warning' } })],
    });

    expect(toggleExpand).not.toHaveBeenCalled();

    await w.findComponent(summaryTable).setData({ searchQuery: 'warning' });

    expect(toggleExpand.mock.calls.map(([row]) => row.component)).toStrictEqual(['y']);

    toggleExpand.mockClear();
    await w.findComponent(summaryTable).setData({ searchQuery: '' });

    expect(toggleExpand).not.toHaveBeenCalled();
  });
  it('only offers the ignored checks when there are some', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { warningCount: 1 } })],
      componentHealths: [healthOf('h', 'x', { a: { severity: 'Error', ignored: true }, b: { severity: 'Warning' } })],
    });
    const shownRows = () => w.findComponent(ComponentChecksTable).props('rows').map((r) => r.id);

    expect(shownRows()).toStrictEqual(['h/b']);
    expect(w.text()).toContain('showIgnored');

    await w.findComponent(Checkbox).vm.$emit('update:value', true);

    expect(shownRows()).toStrictEqual(['h/a', 'h/b']);

    const clean = await mountSummary({
      healthSummaries:  [summaryOf({ x: { warningCount: 1 } })],
      componentHealths: [healthOf('h', 'x', { b: { severity: 'Warning' } })],
    });

    expect(clean.text()).not.toContain('showIgnored');
  });
  it('expands a long message', async() => {
    const message = 'x'.repeat(150);
    const table = { props: ['rows'], template: '<div><slot name="cell:message" :row="rows[0]" :value="rows[0].message" /></div>' };
    const w = mountChecks({ rows: [{ id: 'a', message }] }, { SortableTable: table });

    expect(w.text()).not.toContain(message);

    await w.find('button.variant-link').trigger('click');

    expect(w.text()).toContain(message);
  });
  it('tells when a component has no checks', () => {
    expect(mountChecks({ rows: [] }).text()).toContain('noIssues');
  });

  describe('ignoring a check', () => {
    it('asks to ignore a check from its row', async() => {
      const table = { props: ['rows'], template: '<div><slot name="cell:actions" :row="rows[0]" /></div>' };
      const w = mountChecks({ rows: [CHECK_TO_IGNORE] }, { SortableTable: table });

      await w.find('button').trigger('click');

      expect(w.emitted('ignore')).toStrictEqual([[CHECK_TO_IGNORE]]);
    });
    it('starts the modal over each time it opens', async() => {
      const w = await mountSummary({
        healthSummaries:  [summaryOf({ x: { errorCount: 1 } })],
        componentHealths: [healthOf('h', 'x', { a: { severity: 'Error' } })],
      });
      const open = async() => {
        await w.findComponent(ComponentChecksTable).vm.$emit('ignore', CHECK_TO_IGNORE);
        await flushPromises();
      };

      expect(w.findComponent(RcModal).exists()).toBe(false);

      await open();
      await w.findComponent(LabeledInput).vm.$emit('update:value', 'known issue');
      await flushPromises();

      expect(w.findComponent(LabeledInput).props('value')).toBe('known issue');

      await w.findComponent(RcModal).vm.$emit('close');
      await flushPromises();

      expect(w.findComponent(RcModal).exists()).toBe(false);

      await open();

      expect(w.findComponent(LabeledInput).props('value')).toBe('');
    });
    it('ignores the selected resources for the chosen time', async() => {
      const {
        w, onClose, confirm, created
      } = mountIgnoreModal();

      await w.findComponent(LabeledSelect).vm.$emit('update:value', ['two']);
      await w.findComponent(LabeledInput).vm.$emit('update:value', 'known issue');
      await flushPromises();
      await confirm().trigger('click');
      await flushPromises();

      expect(created().spec).toStrictEqual({
        componentHealth: 'h',
        checkKey:        'a',
        resources:       ['two'],
        expiresAt:       expect.any(String),
        reason:          'known issue',
      });
      expect(saveRule).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    it('ignores the entire check forever without listing its resources', async() => {
      const { w, confirm, created } = mountIgnoreModal();
      const [scope, duration] = w.findAllComponents(RadioGroup);

      await scope.vm.$emit('update:value', 'check');
      await duration.vm.$emit('update:value', 'forever');
      await flushPromises();
      await confirm().trigger('click');
      await flushPromises();

      expect(created().spec).toStrictEqual({ componentHealth: 'h', checkKey: 'a' });
    });
    it('can not ignore without a resource selected', async() => {
      const { w, confirm } = mountIgnoreModal();

      expect(confirm().attributes('disabled')).toBeUndefined();

      await w.findComponent(LabeledSelect).vm.$emit('update:value', []);
      await flushPromises();

      expect(confirm().attributes('disabled')).toBeDefined();
    });
    it('stays open and shows the error when saving fails', async() => {
      const { w, onClose, confirm } = mountIgnoreModal(() => Promise.reject(new Error('forbidden')));

      await confirm().trigger('click');
      await flushPromises();

      expect(w.text()).toContain('forbidden');
      expect(onClose).not.toHaveBeenCalled();
      expect(confirm().attributes('disabled')).toBeUndefined();
    });
    it('does not close while the rule is saved', async() => {
      let finishSaving;

      const { w, onClose, confirm } = mountIgnoreModal(() => new Promise((resolve) => {
        finishSaving = resolve;
      }));

      await confirm().trigger('click');
      await flushPromises();

      expect(confirm().attributes('disabled')).toBeDefined();

      await w.findComponent(RcModal).vm.$emit('close');

      expect(onClose).not.toHaveBeenCalled();

      finishSaving();
      await flushPromises();

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

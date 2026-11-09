import { mount as vtuMount, flushPromises } from '@vue/test-utils';
import { createStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { BadgeState } from '@components/BadgeState';
import { Checkbox } from '@components/Form/Checkbox';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import { RcCounterBadge, RcTag } from '@components/Pill';
import { RcModal } from '@components/RcModal';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { HCI } from '../../../types';
import { affectedResourceLabel, ignoreRuleName, ignoredCounts, totalErrorCount } from '../../../utils/component-health';
import HealthSummaryTable from '../HealthSummaryTable.vue';
import ComponentChecksTable from '../ComponentChecksTable.vue';
import IgnoreRuleModal from '../IgnoreRuleModal.vue';

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
const newRule = { save: saveRule };
const editedRule = { save: saveRule };
const createRule = jest.fn(() => newRule);
const cloneRule = jest.fn(() => editedRule);
let store;

// resources are fetched by the components themselves, so serve them from a mocked store
const opts = (props = {}) => {
  store = createStore({
    getters: {
      'i18n/t':              () => (k) => k,
      'i18n/exists':         () => () => true,
      'prefs/get':           () => () => false,
      currentProduct:        () => ({ inStore: 'harvester' }),
      'harvester/schemaFor': () => (type) => (props.noSchemaFor === type ? null : { collectionMethods: props.collectionMethods || ['GET', 'POST'] }),
      'type-map/labelFor':   () => (schema, count) => `label of ${ count }`,
    },
    actions: {
      'growl/success':     jest.fn(),
      'harvester/findAll': (_, { type }) => {
        const key = Object.keys(TYPES).find((k) => TYPES[k] === type);

        props.onFindAll?.(type);

        return props.failing === key ? Promise.reject(new Error('failed')) : props[key] || [];
      },
      'harvester/create': createRule,
      'harvester/clone':  cloneRule,
    }
  });

  return { global: { plugins: [store], stubs: { teleport: true } } };
};

const toggleExpand = jest.fn();

// renders the summary rows with every sub-row open, and the checks of each sub-row
const summaryTable = {
  props: ['rows', 'headers'],
  data() {
    return { searchQuery: '', expanded: {} };
  },
  methods:  { toggleExpand, isExpanded: () => false },
  template: `<div>
    <slot name="header-left" />
    <slot name="header-right" />
    <div class="summary">{{ rows.map(r => r.id + ":" + r.severityRank).join(",") }}</div>
    <div v-for="row in rows" :key="row.id" class="name"><slot name="cell:component" :row="row" /></div>
    <div v-for="row in rows" :key="row.id" :class="'sub-' + row.component"><slot name="sub-row" :row="row" :fullColspan="1" /></div>
  </div>`,
};

const checksTable = {
  props: ['rows', 'headers', 'rowActions'],
  data() {
    return { searchQuery: '' };
  },
  template: '<div class="checks">{{ rows.map(r => r.id + ":" + r.severityRank).join(",") }}</div>',
};

const mountSummary = async(props) => {
  const base = opts(props);
  const w = vtuMount(HealthSummaryTable, { ...base, global: { ...base.global, stubs: { ...base.global.stubs, SortableTable: summaryTable } } });

  await flushPromises();

  return w;
};

const mountChecks = (props, stubs = {}, storeProps = {}) => {
  const base = opts(storeProps);

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

const CHECK = {
  id:                  'h/a',
  component:           'x',
  componentHealthName: 'h',
  checkName:           'a',
  affectedResources:   { kind: 'VirtualMachine', names: { one: {}, two: {} } },
};

const IN_A_WEEK = new Date(Date.now() + (7 * 24 * 3600 * 1000)).toISOString();
const LAST_WEEK = new Date(Date.now() - (7 * 24 * 3600 * 1000)).toISOString();

// named the way the UI names the rule of a check, unless `extra` says otherwise
const ruleOf = (spec = {}, extra = {}) => {
  const fullSpec = {
    componentHealth: 'h', checkKey: 'a', ...spec
  };

  return {
    metadata:     { name: ignoreRuleName(fullSpec.componentHealth, fullSpec.checkKey) },
    spec:         fullSpec,
    canUpdate:    true,
    canDelete:    true,
    promptRemove: jest.fn(),
    ...extra,
  };
};

const actionsOf = (props = {}, storeProps = {}) => {
  const w = mountChecks({ rows: [CHECK], ...props }, {}, storeProps);
  const actions = w.findComponent(checksTable).props('rows')[0].availableActions;

  return {
    w,
    actions,
    keys:   actions.map((action) => (action.divider ? '-' : action.action)),
    invoke: (key) => actions.find((action) => action.action === key).invoke(),
  };
};

const mountRuleModal = ({ rule, mode, save = () => {} } = {}) => {
  createRule.mockClear();
  cloneRule.mockClear();
  saveRule.mockReset().mockImplementation(save);
  delete newRule.spec;
  delete editedRule.spec;

  const onClose = jest.fn();
  const w = vtuMount(IgnoreRuleModal, {
    ...opts(),
    props: {
      row: CHECK, rule, mode, modal: { show: true, onClose }
    },
  });

  return {
    w,
    onClose,
    confirm:       () => w.find('[data-testid="component-health-ignore-confirm"]'),
    duration:      () => w.findAllComponents(RadioGroup).find((group) => group.props('name') === 'ignore-duration'),
    currentExpiry: () => w.find('[data-testid="component-health-ignore-current-expiry"]'),
    newExpiry:     () => w.find('[data-testid="component-health-ignore-new-expiry"]'),
    warning:       () => w.findAllComponents(Banner).find((banner) => banner.props('color') === 'warning'),
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
  it('gives what was typed in the outer table to the table of checks', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { errorCount: 1 } })],
      componentHealths: [healthOf('h', 'x', { a: { severity: 'Error' } })],
    });

    await w.findComponent(summaryTable).setData({ searchQuery: 'warn' });

    expect(w.findComponent(ComponentChecksTable).props('filterText')).toBe('warn');
  });
  it('lets the table of checks filter its own rows', async() => {
    const w = mountChecks({ rows: [CHECK], filterText: 'warn' });
    const table = w.findComponent(checksTable);

    await flushPromises();

    expect(table.vm.searchQuery).toBe('warn');

    await w.setProps({ filterText: 'error' });

    expect(table.vm.searchQuery).toBe('error');
    expect(table.props('headers').filter((header) => header.search !== false).map((header) => header.search)).toStrictEqual(['filterText']);
  });
  it('calls a row with errors Error, and only its errors match that word', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { errorCount: 1 } })],
      componentHealths: [healthOf('h', 'x', { a: { severity: 'Error' }, b: { severity: 'Warning' } })],
    });
    const checks = w.findComponent(ComponentChecksTable).props('rows');

    expect(w.findComponent(summaryTable).props('rows')[0].severity).toBe('Error');
    expect(checks.map((r) => r.filterText.includes('error'))).toStrictEqual([true, false]);
  });
  it('does not search the count columns', async() => {
    const w = await mountSummary({ healthSummaries: [summaryOf({ x: {} })] });
    const { headers } = w.findComponent(summaryTable).props();

    expect(headers.filter((header) => header.search !== false).map((header) => header.name)).toStrictEqual(['severity', 'component']);
  });
  it('gives the table filter what a sub-row shows', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { warningCount: 1 } })],
      componentHealths: [healthOf('h', 'x', {
        a: {
          severity:          'Warning',
          message:           'Some Message',
          affectedResources: {
            apiVersion: 'kubevirt.io/v1', kind: 'VirtualMachine', names: { 'vm-shown': {}, 'vm-hidden': { ignored: true } }
          },
        }
      })],
    });
    const filterText = () => w.findComponent(summaryTable).props('rows')[0].checksFilterText;

    ['x', 'warning', 'a', 'some message', 'kubevirt.io/v1', 'virtualmachine', 'label of', 'vm-shown'].forEach((text) => expect(filterText()).toContain(text));
    expect(filterText()).not.toContain('vm-hidden');

    await w.findComponent(Checkbox).vm.$emit('update:value', true);

    expect(filterText()).toContain('vm-hidden');
  });
  it('leaves the rows as they are when filtering', async() => {
    toggleExpand.mockClear();

    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { errorCount: 1 }, y: { warningCount: 1 } })],
      componentHealths: [healthOf('h1', 'x', { a: { severity: 'Error' } }), healthOf('h2', 'y', { b: { severity: 'Warning' } })],
    });
    const table = w.findComponent(summaryTable);

    await table.setData({ searchQuery: 'warning' });
    await table.setData({ searchQuery: '' });

    expect(toggleExpand).not.toHaveBeenCalled();
    expect(table.vm.expanded).toStrictEqual({});
  });
  it('expands and collapses all the rows', async() => {
    const w = await mountSummary({ healthSummaries: [summaryOf({ x: {}, y: {} })] });
    const table = w.findComponent(summaryTable);
    const [expand, collapse] = w.findAll('.expand-actions button');

    await expand.trigger('click');

    expect(table.vm.expanded).toStrictEqual({ 's/x': true, 's/y': true });

    await collapse.trigger('click');

    expect(table.vm.expanded).toStrictEqual({});
  });
  it('only offers to expand and collapse when there are rows', async() => {
    const w = await mountSummary({});

    expect(w.find('.expand-actions').exists()).toBe(false);
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
    const w = mountChecks({ rows: [{ ...CHECK, message }] }, { SortableTable: table });

    expect(w.text()).not.toContain(message);

    expect(w.text()).toContain('generic.showMore');

    await w.find('button.variant-link').trigger('click');

    expect(w.text()).toContain(message);
    expect(w.text()).toContain('generic.showLess');
  });
  it('shows the resources as chips, under what the UI calls them and their full count', () => {
    const table = { props: ['rows'], template: '<div><slot name="cell:affectedCount" :row="rows[0]" :value="rows[0].affectedCount" /></div>' };
    const row = {
      ...CHECK,
      affectedCount:     7,
      affectedResources: {
        apiVersion: 'longhorn.io/v1beta2', kind: 'Volume', names: { one: { ignored: true, ignoredBy: 'r' }, two: {} }
      }
    };
    const w = mountChecks({ rows: [row] }, { SortableTable: table });

    expect(w.find('.affected-title .text-label').text()).toBe('label of 7');
    expect(w.find('.affected-title .api-version').text()).toBe('longhorn.io/v1beta2');
    expect(w.findComponent(RcCounterBadge).props('count')).toBe(7);
    expect(w.findAllComponents(RcTag).map((tag) => tag.text())).toStrictEqual(['two']);
  });
  it('keeps the full count and says how many ignored resources it leaves out', () => {
    const table = { props: ['rows'], template: '<div><slot name="cell:affectedCount" :row="rows[0]" :value="rows[0].affectedCount" /></div>' };
    const row = {
      ...CHECK, affectedCount: 2, affectedResources: { kind: 'Volume', names: { one: { ignored: true, ignoredBy: 'r' }, two: {} } }
    };
    const hidden = mountChecks({ rows: [row] }, { SortableTable: table });
    const shown = mountChecks({ rows: [row], showIgnored: true }, { SortableTable: table });

    expect(hidden.findComponent(RcCounterBadge).props('count')).toBe(2);
    expect(hidden.find('.hidden-ignored').text()).toContain('ignore.plusIgnored');
    expect(shown.findComponent(RcCounterBadge).props('count')).toBe(2);
    expect(shown.find('.hidden-ignored').exists()).toBe(false);
  });
  it('counts what "Show ignored" brings back, each thing once', () => {
    const check = (ignored, names) => ({ ignored, affectedResources: { names } });

    expect(ignoredCounts([
      check(true, { a: { ignored: true }, b: { ignored: true } }),
      check(false, { c: { ignored: true }, d: {} }),
      check(false, {
        e: { ignored: true }, f: { ignored: true }, g: {}
      }),
      check(false, { h: {} }),
    ])).toStrictEqual({ checks: 1, resources: 3 });
    expect(ignoredCounts(undefined)).toStrictEqual({ checks: 0, resources: 0 });
  });
  it('names the rule of a check after it', () => {
    expect(ignoreRuleName('harvester-controller-vmimage', 'ImageRetryLimitExceeded')).toBe('harvester-controller-vmimage.imageretrylimitexceeded');
  });
  it('tells the ignored resources apart, and all of them when the check is ignored', () => {
    const table = { props: ['rows'], template: '<div><slot name="cell:severity" :row="rows[0]" /><slot name="cell:affectedCount" :row="rows[0]" :value="2" /></div>' };
    const row = {
      ...CHECK, severity: 'Error', affectedResources: { kind: 'Volume', names: { one: { ignored: true, ignoredBy: 'r' }, two: {} } }
    };
    const wholeRow = {
      ...row, ignored: true, affectedResources: { kind: 'Volume', names: { one: {}, two: {} } }
    };
    const tags = (w) => w.findAllComponents(RcTag).map((tag) => ({
      ignored: tag.classes().includes('ignored'), disabled: tag.props('disabled'), says: tag.text().includes('ignore.ignored')
    }));
    const partly = mountChecks({ rows: [row], showIgnored: true }, { SortableTable: table });
    const whole = mountChecks({ rows: [wholeRow], showIgnored: true }, { SortableTable: table });

    expect(tags(partly)).toStrictEqual([
      {
        ignored: true, disabled: true, says: true
      },
      {
        ignored: false, disabled: false, says: false
      },
    ]);
    expect(partly.findComponent(BadgeState).props('color')).toBe('bg-error');
    expect(tags(whole)).toStrictEqual([
      {
        ignored: true, disabled: true, says: false
      },
      {
        ignored: true, disabled: true, says: false
      },
    ]);
    expect(whole.findComponent(BadgeState).props('color')).toBe('bg-error');
  });
  it('keeps the resources past the first ones behind a link', async() => {
    const table = { props: ['rows'], template: '<div><slot name="cell:affectedCount" :row="rows[0]" :value="rows[0].affectedCount" /></div>' };
    const names = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => [name, {}]));
    const row = {
      ...CHECK, affectedCount: 7, affectedResources: { kind: 'VirtualMachine', names }
    };
    const w = mountChecks({ rows: [row] }, { SortableTable: table });

    expect(w.findAllComponents(RcTag)).toHaveLength(3);
    expect(w.find('button.variant-link').text()).toContain('generic.plusMore');

    await w.find('button.variant-link').trigger('click');

    expect(w.findAllComponents(RcTag)).toHaveLength(7);
    expect(w.find('button.variant-link').text()).toContain('generic.showLess');
  });
  it('adds up the errors of all the components, for the alert on the tab', () => {
    const components = {
      x: { errorCount: 2, warningCount: 5 }, y: { errorCount: 1 }, z: {}
    };

    expect(totalErrorCount([summaryOf(components)])).toBe(3);
    expect(totalErrorCount([summaryOf({ x: { warningCount: 5 } })])).toBe(0);
    expect(totalErrorCount([{ id: 'empty' }])).toBe(0);
    expect(totalErrorCount(undefined)).toBe(0);
  });
  it('names the resources by their schema, or by their kind without one', () => {
    const store = {
      getters: {
        'harvester/schemaFor': (id) => (['longhorn.io.volume', 'node'].includes(id) ? { id } : null),
        'type-map/labelFor':   (schema, count) => `${ schema.id } ${ count }`,
      }
    };
    const label = (apiVersion, kind) => affectedResourceLabel({ affectedCount: 6, affectedResources: { apiVersion, kind } }, store);

    expect(label('longhorn.io/v1beta2', 'Volume')).toBe('longhorn.io.volume 6');
    expect(label('v1', 'Node')).toBe('node 6');
    expect(label('harvesterhci.io/v1beta1', 'Upgrade')).toBe('Upgrade');
  });
  it('tells when a component has no checks, unless they could not be loaded', () => {
    expect(mountChecks({ rows: [] }).text()).toContain('noIssues');
    expect(mountChecks({ rows: [], loadFailed: true }).text()).toContain('checksNotLoaded');
  });
  it('still shows the checks when the rules can not be loaded, and says so', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { errorCount: 1 } })],
      componentHealths: [healthOf('h', 'x', { a: { severity: 'Error' } })],
      failing:          'ignoreRules',
    });
    const checks = w.findComponent(ComponentChecksTable);

    expect(checks.props('rows').map((r) => r.id)).toStrictEqual(['h/a']);
    expect(checks.props('loadFailed')).toBe(false);
    expect(w.findAllComponents(Banner).map((banner) => banner.props('label'))).toStrictEqual(['%harvester.dashboard.sections.componentHealth.loadFailed.ignoreRules%']);
  });
  it('does not call a component without issues when its checks can not be loaded', async() => {
    const w = await mountSummary({
      healthSummaries: [summaryOf({ x: { errorCount: 1 } })],
      failing:         'componentHealths',
    });

    expect(w.findComponent(ComponentChecksTable).props('loadFailed')).toBe(true);
    expect(w.findAllComponents(Banner).map((banner) => banner.props('label'))).toStrictEqual(['%harvester.dashboard.sections.componentHealth.loadFailed.componentHealths%']);
  });
  it('does not ask for the rules without their schema', async() => {
    const onFindAll = jest.fn();

    await mountSummary({ noSchemaFor: HCI.HEALTH_IGNORE_RULE, onFindAll });

    expect(onFindAll.mock.calls.map(([type]) => type)).toStrictEqual([HCI.HEALTH_SUMMARY, HCI.COMPONENT_HEALTH]);
  });
  it('marks a check and the resources that are ignored', () => {
    const table = {
      props:    ['rows'],
      template: '<div><slot name="cell:checkName" :row="rows[0]" :value="rows[0].checkName" /><slot name="cell:affectedCount" :row="rows[0]" :value="2" /></div>',
    };
    const row = { ...CHECK, affectedResources: { kind: 'VirtualMachine', names: { one: { ignored: true, ignoredBy: 'r' }, two: {} } } };
    const textOf = (props) => mountChecks({ showIgnored: true, ...props }, { SortableTable: table }).text().replace(/\s+/g, ' ');

    expect(textOf({ rows: [row] })).toMatch(/one ?\(%harvester\.dashboard\.sections\.componentHealth\.ignore\.ignored%\) ?two/);
    expect(textOf({ rows: [row] })).not.toContain('a (%harvester');
    expect(textOf({ rows: [{ ...row, ignored: true }] })).toContain('a (%harvester.dashboard.sections.componentHealth.ignore.ignored%)');
  });

  describe('the actions of a check', () => {
    it('offers to create a rule when the check has none from the UI', () => {
      const elsewhere = ruleOf({}, { metadata: { name: 'ignore-x7k2p' } });
      const { w, keys, invoke } = actionsOf({ ignoreRules: [ruleOf({ checkKey: 'b' }), ruleOf({ componentHealth: 'other' }), elsewhere] });

      expect(keys).toStrictEqual(['create']);

      invoke('create');

      expect(w.emitted('open-rule')).toStrictEqual([[{
        row: CHECK, rule: undefined, mode: 'create'
      }]]);
    });
    it('offers to view, edit and delete the rule of the check, and only that one', () => {
      const rule = ruleOf();
      const elsewhere = ruleOf({}, { metadata: { name: 'ignore-x7k2p' } });
      const { w, keys, invoke } = actionsOf({ ignoreRules: [elsewhere, ruleOf({ checkKey: 'b' }), rule] });

      expect(keys).toStrictEqual(['view', 'edit', '-', 'delete']);

      invoke('view');
      invoke('edit');
      invoke('delete');

      expect(w.emitted('open-rule')).toStrictEqual([
        [{
          row: CHECK, rule, mode: 'view'
        }],
        [{
          row: CHECK, rule, mode: 'edit'
        }],
      ]);
      expect(rule.promptRemove).toHaveBeenCalledTimes(1);
      expect(elsewhere.promptRemove).not.toHaveBeenCalled();
    });
    it('only offers what the user is allowed to do', () => {
      const keysFor = (extra) => actionsOf({ ignoreRules: [ruleOf({}, extra)] }).keys;

      expect(keysFor({ canDelete: false })).toStrictEqual(['view', 'edit']);
      expect(keysFor({ canUpdate: false })).toStrictEqual(['view', '-', 'delete']);
      expect(keysFor({ canUpdate: false, canDelete: false })).toStrictEqual(['view']);
      expect(actionsOf({}, { collectionMethods: ['GET'] }).keys).toStrictEqual([]);
      expect(actionsOf({}, { noSchemaFor: HCI.HEALTH_IGNORE_RULE }).keys).toStrictEqual([]);
    });
    it('leaves out the menu when no check has anything in it', () => {
      const rowActions = (props, storeProps) => actionsOf(props, storeProps).w.findComponent(checksTable).props('rowActions');

      expect(rowActions({}, { collectionMethods: ['GET'] })).toBe(false);
      expect(rowActions({ ignoreRules: [ruleOf()] }, { collectionMethods: ['GET'] })).toBe(true);
      expect(rowActions({})).toBe(true);
    });
  });

  describe('creating a rule', () => {
    it('starts the modal over each time it opens', async() => {
      const w = await mountSummary({
        healthSummaries:  [summaryOf({ x: { errorCount: 1 } })],
        componentHealths: [healthOf('h', 'x', { a: { severity: 'Error' } })],
      });
      const open = async() => {
        await w.findComponent(ComponentChecksTable).vm.$emit('open-rule', { row: CHECK, mode: 'create' });
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
      const { w, onClose, confirm } = mountRuleModal();

      await w.findComponent(LabeledSelect).vm.$emit('update:value', ['two']);
      await w.findComponent(LabeledInput).vm.$emit('update:value', 'known issue');
      await flushPromises();
      await confirm().trigger('click');
      await flushPromises();

      expect(cloneRule).not.toHaveBeenCalled();
      expect(newRule.spec).toStrictEqual({
        componentHealth: 'h',
        checkKey:        'a',
        resources:       ['two'],
        expiresAt:       expect.any(String),
        reason:          'known issue',
      });
      expect(saveRule).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    it('names the rule after its check, so a second one for it is refused', async() => {
      const { confirm } = mountRuleModal();

      await confirm().trigger('click');
      await flushPromises();

      expect(createRule.mock.calls[0][1].metadata).toStrictEqual({ name: 'h.a', labels: { 'health.harvesterhci.io/source': 'user' } });
    });
    it('says when the rule will expire, from 7 days on', async() => {
      const {
        confirm, duration, currentExpiry, newExpiry
      } = mountRuleModal();

      expect(currentExpiry().exists()).toBe(false);
      expect(duration().props('value')).toBe('days7');
      expect(newExpiry().text()).toContain('ignore.willExpireOn');

      await duration().vm.$emit('update:value', 'forever');
      await flushPromises();

      expect(newExpiry().text()).toContain('ignore.willNeverExpire');
      expect(confirm().attributes('disabled')).toBeUndefined();
    });
    it('ignores the entire check forever without listing its resources', async() => {
      const { w, confirm } = mountRuleModal();
      const [scope, duration] = w.findAllComponents(RadioGroup);

      await scope.vm.$emit('update:value', 'check');
      await duration.vm.$emit('update:value', 'forever');
      await flushPromises();
      await confirm().trigger('click');
      await flushPromises();

      expect(newRule.spec).toStrictEqual({ componentHealth: 'h', checkKey: 'a' });
    });
    it('only offers the entire check when the check lists no resources', () => {
      const w = vtuMount(IgnoreRuleModal, {
        ...opts(),
        props: { row: { ...CHECK, affectedResources: undefined }, modal: { show: true, onClose: jest.fn() } },
      });

      expect(w.findAllComponents(RadioGroup)).toHaveLength(1);
      expect(w.findComponent(LabeledSelect).exists()).toBe(false);
    });
    it('can not ignore without a resource selected', async() => {
      const { w, confirm } = mountRuleModal();

      expect(confirm().attributes('disabled')).toBeUndefined();

      await w.findComponent(LabeledSelect).vm.$emit('update:value', []);
      await flushPromises();

      expect(confirm().attributes('disabled')).toBeDefined();
    });
    it('stays open and shows the error when saving fails', async() => {
      const { w, onClose, confirm } = mountRuleModal({ save: () => Promise.reject(new Error('forbidden')) });

      await confirm().trigger('click');
      await flushPromises();

      expect(w.text()).toContain('forbidden');
      expect(onClose).not.toHaveBeenCalled();
      expect(confirm().attributes('disabled')).toBeUndefined();
    });
    it('does not close while the rule is saved', async() => {
      let finishSaving;

      const { w, onClose, confirm } = mountRuleModal({
        save: () => new Promise((resolve) => {
          finishSaving = resolve;
        })
      });

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

  describe('editing a rule', () => {
    it('starts from what the rule has, with no new duration chosen', () => {
      const rule = ruleOf({
        resources: ['two'], expiresAt: IN_A_WEEK, reason: 'known issue'
      });
      const {
        w, duration, currentExpiry, newExpiry
      } = mountRuleModal({ rule, mode: 'edit' });
      const [scope] = w.findAllComponents(RadioGroup);

      expect(scope.props('value')).toBe('resources');
      expect(w.findComponent(LabeledSelect).props('value')).toStrictEqual(['two']);
      expect(currentExpiry().text()).toContain('ignore.expiresOn');
      expect(duration().props('value')).toBeNull();
      expect(duration().props('options').map((option) => option.value)).toStrictEqual(['days7', 'days30', 'forever']);
      expect(newExpiry().exists()).toBe(false);
      expect(w.findComponent(LabeledInput).props('value')).toBe('known issue');
    });
    it('can not save until something changes', async() => {
      const { w, confirm, duration } = mountRuleModal({ rule: ruleOf(), mode: 'edit' });
      const reason = (value) => w.findComponent(LabeledInput).vm.$emit('update:value', value);

      expect(confirm().attributes('disabled')).toBeDefined();

      await reason('known issue');
      await flushPromises();

      expect(confirm().attributes('disabled')).toBeUndefined();

      await reason('');
      await duration().vm.$emit('update:value', 'forever');
      await flushPromises();

      expect(confirm().attributes('disabled')).toBeDefined();

      await duration().vm.$emit('update:value', 'days7');
      await flushPromises();

      expect(confirm().attributes('disabled')).toBeUndefined();
    });
    it('saves on a copy of the rule, with the expiry it has', async() => {
      const rule = ruleOf({
        resources: ['two'], expiresAt: IN_A_WEEK, reason: 'known issue'
      });
      const { w, onClose, confirm } = mountRuleModal({ rule, mode: 'edit' });

      await w.findComponent(LabeledInput).vm.$emit('update:value', 'still known');
      await flushPromises();
      await confirm().trigger('click');
      await flushPromises();

      expect(createRule).not.toHaveBeenCalled();
      expect(cloneRule.mock.calls[0][1]).toStrictEqual({ resource: rule });
      expect(editedRule.spec).toStrictEqual({ ...rule.spec, reason: 'still known' });
      expect(saveRule).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    it('takes the resources, the expiry and the reason off the rule', async() => {
      const { w, confirm, duration } = mountRuleModal({
        rule: ruleOf({
          resources: ['two'], expiresAt: IN_A_WEEK, reason: 'known issue'
        }),
        mode: 'edit'
      });
      const [scope] = w.findAllComponents(RadioGroup);

      await scope.vm.$emit('update:value', 'check');
      await duration().vm.$emit('update:value', 'forever');
      await w.findComponent(LabeledInput).vm.$emit('update:value', '');
      await flushPromises();
      await confirm().trigger('click');
      await flushPromises();

      expect(editedRule.spec).toStrictEqual({ componentHealth: 'h', checkKey: 'a' });
    });
    it('renews an expired rule with the duration chosen', async() => {
      const {
        confirm, duration, currentExpiry, newExpiry
      } = mountRuleModal({ rule: ruleOf({ expiresAt: LAST_WEEK }), mode: 'edit' });

      expect(currentExpiry().text()).toContain('ignore.expiredOn');

      await duration().vm.$emit('update:value', 'days30');
      await flushPromises();

      expect(newExpiry().text()).toContain('ignore.willExpireOn');

      await confirm().trigger('click');
      await flushPromises();

      expect(new Date(editedRule.spec.expiresAt).getTime()).toBeGreaterThan(new Date(IN_A_WEEK).getTime());
    });
    it('warns that an expired rule stays expired when only something else changes', async() => {
      const { w, duration, warning } = mountRuleModal({ rule: ruleOf({ expiresAt: LAST_WEEK }), mode: 'edit' });

      expect(warning()).toBeUndefined();

      await w.findComponent(LabeledInput).vm.$emit('update:value', 'known issue');
      await flushPromises();

      expect(warning().props('label')).toContain('ignore.staysExpired');

      await duration().vm.$emit('update:value', 'days7');
      await flushPromises();

      expect(warning()).toBeUndefined();
    });
    it('does not warn about a rule that has not expired', async() => {
      const { w, warning } = mountRuleModal({ rule: ruleOf({ expiresAt: IN_A_WEEK }), mode: 'edit' });

      await w.findComponent(LabeledInput).vm.$emit('update:value', 'known issue');
      await flushPromises();

      expect(warning()).toBeUndefined();
    });
    it('opens a rule without resources on the entire check, and selects them all when asked', async() => {
      const {
        w, confirm, duration, currentExpiry
      } = mountRuleModal({ rule: ruleOf(), mode: 'edit' });
      const [scope] = w.findAllComponents(RadioGroup);

      expect(scope.props('value')).toBe('check');
      expect(currentExpiry().text()).toContain('ignore.neverExpires');
      expect(duration().props('value')).toBeNull();
      expect(w.findComponent(LabeledSelect).exists()).toBe(false);

      await scope.vm.$emit('update:value', 'resources');
      await flushPromises();

      expect(w.findComponent(LabeledSelect).props('value')).toStrictEqual(['one', 'two']);

      await confirm().trigger('click');
      await flushPromises();

      expect(editedRule.spec.resources).toStrictEqual(['one', 'two']);
    });
    it('keeps a resource of the rule that is no longer affected', async() => {
      const { w, confirm } = mountRuleModal({ rule: ruleOf({ resources: ['gone', 'two'] }), mode: 'edit' });
      const select = w.findComponent(LabeledSelect);

      expect(select.props('options')).toStrictEqual(['one', 'two', 'gone']);
      expect(select.props('value')).toStrictEqual(['two', 'gone']);

      await w.findComponent(LabeledInput).vm.$emit('update:value', 'known issue');
      await flushPromises();
      await confirm().trigger('click');
      await flushPromises();

      expect(editedRule.spec.resources).toStrictEqual(['two', 'gone']);
    });
  });

  describe('viewing a rule', () => {
    it('shows what the rule has without letting it change', async() => {
      const {
        w, onClose, confirm, duration, currentExpiry
      } = mountRuleModal({
        rule: ruleOf({
          resources: ['two'], expiresAt: IN_A_WEEK, reason: 'known issue'
        }),
        mode: 'view'
      });

      [...w.findAllComponents(RadioGroup), w.findComponent(LabeledSelect), w.findComponent(LabeledInput)].forEach((field) => {
        expect(field.props('mode')).toBe('view');
      });
      expect(currentExpiry().text()).toContain('ignore.expiresOn');
      expect(duration()).toBeUndefined();
      expect(w.findComponent(LabeledInput).props('value')).toBe('known issue');
      expect(confirm().exists()).toBe(false);
      expect(w.find('[data-testid="rc-modal-cancel"]').exists()).toBe(false);

      await w.find('[data-testid="component-health-ignore-close"]').trigger('click');

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(cloneRule).not.toHaveBeenCalled();
      expect(saveRule).not.toHaveBeenCalled();
    });
  });
});

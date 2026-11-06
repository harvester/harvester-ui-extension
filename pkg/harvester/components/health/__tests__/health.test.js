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
import DeleteIgnoreRuleModal from '../DeleteIgnoreRuleModal.vue';
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

const ruleOf = (spec = {}, extra = {}) => ({
  spec: {
    componentHealth: 'h', checkKey: 'a', ...spec
  },
  canUpdate: true,
  canDelete: true,
  ...extra,
});

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
    confirm: () => w.find('[data-testid="component-health-ignore-confirm"]'),
  };
};

const mountDeleteModal = (remove = () => {}) => {
  const onClose = jest.fn();
  const rule = ruleOf({}, { remove: jest.fn(remove) });
  const w = vtuMount(DeleteIgnoreRuleModal, {
    ...opts(),
    props: {
      row: CHECK, rule, modal: { show: true, onClose }
    },
  });

  return {
    w,
    rule,
    onClose,
    confirm: () => w.find('[data-testid="component-health-delete-rule-confirm"]'),
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
  it('still shows the checks when the rules can not be loaded', async() => {
    const w = await mountSummary({
      healthSummaries:  [summaryOf({ x: { errorCount: 1 } })],
      componentHealths: [healthOf('h', 'x', { a: { severity: 'Error' } })],
      failing:          'ignoreRules',
    });

    expect(w.findComponent(ComponentChecksTable).props('rows').map((r) => r.id)).toStrictEqual(['h/a']);
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

    expect(textOf({ rows: [row] })).toContain('one (%harvester.dashboard.sections.componentHealth.ignore.ignored%) two');
    expect(textOf({ rows: [row] })).not.toContain('a (%harvester');
    expect(textOf({ rows: [{ ...row, ignored: true }] })).toContain('a (%harvester.dashboard.sections.componentHealth.ignore.ignored%)');
  });

  describe('the actions of a check', () => {
    it('offers to create a rule when the check has none', () => {
      const { w, keys, invoke } = actionsOf({ ignoreRules: [ruleOf({ checkKey: 'b' }), ruleOf({ componentHealth: 'other' })] });

      expect(keys).toStrictEqual(['create']);

      invoke('create');

      expect(w.emitted('open-rule')).toStrictEqual([[{
        row: CHECK, rule: undefined, mode: 'create'
      }]]);
    });
    it('offers to view, edit and delete the rule of the check', () => {
      const rule = ruleOf();
      const { w, keys, invoke } = actionsOf({ ignoreRules: [ruleOf({ checkKey: 'b' }), rule] });

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
      expect(w.emitted('delete-rule')).toStrictEqual([[{ row: CHECK, rule }]]);
    });
    it('only offers what the user is allowed to do', () => {
      const keysFor = (extra) => actionsOf({ ignoreRules: [ruleOf({}, extra)] }).keys;

      expect(keysFor({ canDelete: false })).toStrictEqual(['view', 'edit']);
      expect(keysFor({ canUpdate: false })).toStrictEqual(['view', '-', 'delete']);
      expect(keysFor({ canUpdate: false, canDelete: false })).toStrictEqual(['view']);
      expect(actionsOf({}, { collectionMethods: ['GET'] }).keys).toStrictEqual([]);
      expect(actionsOf({}, { noSchemaFor: HCI.HEALTH_IGNORE_RULE }).keys).toStrictEqual([]);
    });
    it('opens the delete modal apart from the others', async() => {
      const w = await mountSummary({
        healthSummaries:  [summaryOf({ x: { errorCount: 1 } })],
        componentHealths: [healthOf('h', 'x', { a: { severity: 'Error' } })],
      });
      const checks = w.findComponent(ComponentChecksTable);

      await checks.vm.$emit('delete-rule', { row: CHECK, rule: ruleOf() });
      await flushPromises();

      expect(w.findComponent(DeleteIgnoreRuleModal).exists()).toBe(true);
      expect(w.findComponent(IgnoreRuleModal).exists()).toBe(false);

      await w.findComponent(RcModal).vm.$emit('close');
      await checks.vm.$emit('open-rule', {
        row: CHECK, rule: ruleOf(), mode: 'view'
      });
      await flushPromises();

      expect(w.findComponent(DeleteIgnoreRuleModal).exists()).toBe(false);
      expect(w.findComponent(IgnoreRuleModal).props('mode')).toBe('view');
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
    it('starts from what the rule has', () => {
      const rule = ruleOf({
        resources: ['two'], expiresAt: IN_A_WEEK, reason: 'known issue'
      });
      const { w } = mountRuleModal({ rule, mode: 'edit' });
      const [scope, duration] = w.findAllComponents(RadioGroup);

      expect(scope.props('value')).toBe('resources');
      expect(w.findComponent(LabeledSelect).props('value')).toStrictEqual(['two']);
      expect(duration.props('value')).toBe('keep');
      expect(duration.props('options')[0].label).toContain('ignore.until');
      expect(w.findComponent(LabeledInput).props('value')).toBe('known issue');
    });
    it('saves on a copy of the rule, with the expiry it has', async() => {
      const rule = ruleOf({
        resources: ['two'], expiresAt: IN_A_WEEK, reason: 'known issue'
      });
      const { onClose, confirm } = mountRuleModal({ rule, mode: 'edit' });

      await confirm().trigger('click');
      await flushPromises();

      expect(createRule).not.toHaveBeenCalled();
      expect(cloneRule.mock.calls[0][1]).toStrictEqual({ resource: rule });
      expect(editedRule.spec).toStrictEqual(rule.spec);
      expect(saveRule).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    it('takes the resources, the expiry and the reason off the rule', async() => {
      const { w, confirm } = mountRuleModal({
        rule: ruleOf({
          resources: ['two'], expiresAt: IN_A_WEEK, reason: 'known issue'
        }),
        mode: 'edit'
      });
      const [scope, duration] = w.findAllComponents(RadioGroup);

      await scope.vm.$emit('update:value', 'check');
      await duration.vm.$emit('update:value', 'forever');
      await w.findComponent(LabeledInput).vm.$emit('update:value', '');
      await flushPromises();
      await confirm().trigger('click');
      await flushPromises();

      expect(editedRule.spec).toStrictEqual({ componentHealth: 'h', checkKey: 'a' });
    });
    it('sets a new expiry when another duration is chosen', async() => {
      const { w, confirm } = mountRuleModal({ rule: ruleOf({ expiresAt: LAST_WEEK }), mode: 'edit' });
      const duration = w.findAllComponents(RadioGroup)[1];

      expect(duration.props('options')[0].label).toContain('ignore.expiredOn');

      await duration.vm.$emit('update:value', 'days30');
      await flushPromises();
      await confirm().trigger('click');
      await flushPromises();

      expect(new Date(editedRule.spec.expiresAt).getTime()).toBeGreaterThan(new Date(IN_A_WEEK).getTime());
    });
    it('opens a rule without resources on the entire check, and selects them all when asked', async() => {
      const { w, confirm } = mountRuleModal({ rule: ruleOf(), mode: 'edit' });
      const [scope, duration] = w.findAllComponents(RadioGroup);

      expect(scope.props('value')).toBe('check');
      expect(duration.props('value')).toBe('forever');
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

      await confirm().trigger('click');
      await flushPromises();

      expect(editedRule.spec.resources).toStrictEqual(['two', 'gone']);
    });
  });

  describe('viewing a rule', () => {
    it('shows what the rule has without letting it change', async() => {
      const { w, onClose, confirm } = mountRuleModal({
        rule: ruleOf({
          resources: ['two'], expiresAt: IN_A_WEEK, reason: 'known issue'
        }),
        mode: 'view'
      });

      [...w.findAllComponents(RadioGroup), w.findComponent(LabeledSelect), w.findComponent(LabeledInput)].forEach((field) => {
        expect(field.props('mode')).toBe('view');
      });
      expect(w.findComponent(LabeledInput).props('value')).toBe('known issue');
      expect(confirm().exists()).toBe(false);
      expect(w.find('[data-testid="rc-modal-cancel"]').exists()).toBe(false);

      await w.find('[data-testid="component-health-ignore-close"]').trigger('click');

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(cloneRule).not.toHaveBeenCalled();
      expect(saveRule).not.toHaveBeenCalled();
    });
  });

  describe('deleting a rule', () => {
    it('deletes the rule once confirmed', async() => {
      const {
        w, rule, onClose, confirm
      } = mountDeleteModal();

      expect(w.text()).toContain('a');
      expect(rule.remove).not.toHaveBeenCalled();

      await confirm().trigger('click');
      await flushPromises();

      expect(rule.remove).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    it('keeps the rule when cancelled', async() => {
      const { w, rule, onClose } = mountDeleteModal();

      await w.find('[data-testid="rc-modal-cancel"]').trigger('click');

      expect(rule.remove).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    it('stays open and shows the error when deleting fails', async() => {
      const { w, onClose, confirm } = mountDeleteModal(() => Promise.reject(new Error('forbidden')));

      await confirm().trigger('click');
      await flushPromises();

      expect(w.text()).toContain('forbidden');
      expect(onClose).not.toHaveBeenCalled();
      expect(confirm().attributes('disabled')).toBeUndefined();
    });
    it('does not close while the rule is deleted', async() => {
      let finishDeleting;

      const { w, onClose, confirm } = mountDeleteModal(() => new Promise((resolve) => {
        finishDeleting = resolve;
      }));

      await confirm().trigger('click');
      await flushPromises();

      expect(confirm().attributes('disabled')).toBeDefined();

      await w.findComponent(RcModal).vm.$emit('close');

      expect(onClose).not.toHaveBeenCalled();

      finishDeleting();
      await flushPromises();

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

import PagePo from '@rancher/cypress/e2e/po/pages/page.po';
import { BaseDetailPagePo } from '@rancher/cypress/e2e/po/pages/base/base-detail-page.po';
import TabbedPo from '@rancher/cypress/e2e/po/components/tabbed.po';
import NameNsDescription from '@rancher/cypress/e2e/po/components/name-ns-description.po';
import LabeledInputPo from '@rancher/cypress/e2e/po/components/labeled-input.po';
import LabeledSelectPo from '@rancher/cypress/e2e/po/components/labeled-select.po';
import HarvesterListPagePo, { harvesterPath, harvesterCluster } from '@/cypress/e2e/po/pages/harvester-list-page.po';

const VM = 'kubevirt.io.virtualmachine';

export class VirtualMachinesListPagePo extends HarvesterListPagePo {
  constructor(clusterId = harvesterCluster()) {
    super(VM, clusterId);
  }

  /**
   * The row of a VM, matched on its whole name (`andy` must not match `andytest-01`)
   */
  vmRow(name: string) {
    return this.rows().filter((_, row) => Cypress.$(row).find('td.col-link-detail a').text().trim() === name);
  }

  state(name: string) {
    return this.vmRow(name).find('td.col-badge-state-formatter');
  }

  goToVm(name: string) {
    return this.vmRow(name).find('td.col-link-detail a').click();
  }
}

export class VirtualMachineDetailPagePo extends BaseDetailPagePo {
  constructor(namespace: string, name: string, clusterId = harvesterCluster()) {
    super(harvesterPath(`${ VM }/${ namespace }/${ name }`, clusterId));
  }

  name() {
    return this.self().find('.masthead-resource-title');
  }

  state() {
    return this.self().find('h1 .badge-state');
  }

  tabs() {
    return new TabbedPo();
  }

  tabPanel(name: string) {
    return this.self().find(`[data-testid="tab-panel-${ name }"]`);
  }
}

/**
 * The VM form: VM create and edit, and VM template versions
 */
class VirtualMachineFormPagePo extends PagePo {
  nameNsDescription() {
    return new NameNsDescription(this.self());
  }

  tabs() {
    return new TabbedPo();
  }

  tabPanel(name: string) {
    return this.self().find(`[data-testid="tab-panel-${ name }"]`);
  }

  form() {
    return this.self().find('[data-testid="cru-form"]');
  }

  cpu() {
    return LabeledInputPo.byLabel(this.form(), 'CPU');
  }

  memory() {
    return LabeledInputPo.byLabel(this.form(), 'Memory');
  }

  namespace() {
    return this.self().find('[data-testid="name-ns-description-namespace"] .vs__selected');
  }

  /**
   * The name inputs of a section's items, e.g. the volumes of `Volume`
   */
  nameInputs(section: string) {
    return this.tabPanel(section).find('[data-testid$="-name"] input');
  }

  /**
   * The image of the first volume of a new VM
   */
  image() {
    return new LabeledSelectPo('[data-testid="input-hevi-image"] .labeled-select');
  }

  save() {
    return this.self().find('[data-testid="form-save"]').click();
  }
}

export class VirtualMachineCreatePagePo extends VirtualMachineFormPagePo {
  constructor(clusterId = harvesterCluster()) {
    super(harvesterPath(`${ VM }/create`, clusterId));
  }
}

export class VirtualMachineEditPagePo extends VirtualMachineFormPagePo {
  constructor(namespace: string, name: string, clusterId = harvesterCluster()) {
    super(harvesterPath(`${ VM }/${ namespace }/${ name }`, clusterId));
  }

  goTo() {
    return super.goTo('mode=edit');
  }

  waitForPage() {
    return super.waitForPage('mode=edit');
  }
}

export class TemplateVersionEditPagePo extends VirtualMachineFormPagePo {
  constructor(namespace: string, name: string, clusterId = harvesterCluster()) {
    super(harvesterPath(`harvesterhci.io.virtualmachinetemplateversion/${ namespace }/${ name }`, clusterId));
  }

  goTo() {
    return super.goTo('mode=edit');
  }

  waitForPage() {
    return super.waitForPage('mode=edit');
  }
}

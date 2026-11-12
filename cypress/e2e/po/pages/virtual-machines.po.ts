import PagePo from '@rancher/cypress/e2e/po/pages/page.po';
import { BaseDetailPagePo } from '@rancher/cypress/e2e/po/pages/base/base-detail-page.po';
import TabbedPo from '@rancher/cypress/e2e/po/components/tabbed.po';
import NameNsDescription from '@rancher/cypress/e2e/po/components/name-ns-description.po';
import LabeledInputPo from '@rancher/cypress/e2e/po/components/labeled-input.po';
import HarvesterListPagePo, { harvesterPath, HARVESTER_CLUSTER } from '@/cypress/e2e/po/pages/harvester-list-page.po';

const VM = 'kubevirt.io.virtualmachine';

export class VirtualMachinesListPagePo extends HarvesterListPagePo {
  constructor(clusterId = HARVESTER_CLUSTER) {
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
  constructor(namespace: string, name: string, clusterId = HARVESTER_CLUSTER) {
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
}

export class VirtualMachineCreatePagePo extends PagePo {
  constructor(clusterId = HARVESTER_CLUSTER) {
    super(harvesterPath(`${ VM }/create`, clusterId));
  }

  nameNsDescription() {
    return new NameNsDescription(this.self());
  }

  tabs() {
    return new TabbedPo();
  }

  tabPanel(name: string) {
    return this.self().find(`[data-testid="tab-panel-${ name }"]`);
  }

  cpu() {
    return LabeledInputPo.byLabel(this.tabPanel('basics'), 'CPU');
  }

  memory() {
    return LabeledInputPo.byLabel(this.tabPanel('basics'), 'Memory');
  }
}

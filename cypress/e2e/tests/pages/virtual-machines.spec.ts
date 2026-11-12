import { VirtualMachinesListPagePo, VirtualMachineDetailPagePo, VirtualMachineCreatePagePo } from '@/cypress/e2e/po/pages/virtual-machines.po';

// Data comes from cypress/recordings/harvester.har: 12 VMs, and `default/andy` is the one whose detail page was recorded
describe('Virtual machines', { tags: ['@virtualMachines'] }, () => {
  describe('List', () => {
    const list = new VirtualMachinesListPagePo();

    beforeEach(() => {
      list.goTo();
      list.waitForPage();
    });

    it('shows every VM with its state', () => {
      list.title().should('contain', 'Virtual Machines');
      list.rows().should('have.length', 12);
      list.state('vm123').should('contain.text', 'Running');
      list.state('forklift-vm-small').should('contain.text', 'Off');
    });

    it('filters the VMs by name', () => {
      list.sortableTable().filter('forklift-vm');
      list.rows().should('have.length', 5);
    });

    it('opens the detail page of a VM', () => {
      const detail = new VirtualMachineDetailPagePo('default', 'andy');

      list.goToVm('andy');
      detail.waitForPage();
      detail.name().should('have.text', 'andy');
    });
  });

  describe('Detail', () => {
    const detail = new VirtualMachineDetailPagePo('default', 'andy');

    beforeEach(() => {
      detail.goTo();
      detail.waitForPage();
    });

    it('shows the name, state and tabs of a running VM', () => {
      detail.name().should('have.text', 'andy');
      detail.state().should('contain.text', 'Running');
      detail.tabs().tabNames().should('include.members', ['Basics', 'Volumes', 'Networks', 'Events']);
    });
  });

  describe('Create', () => {
    const create = new VirtualMachineCreatePagePo();

    beforeEach(() => {
      create.goTo();
      create.waitForPage();
    });

    it('shows the form with its basic fields', () => {
      create.nameNsDescription().name().checkVisible();
      create.cpu().checkVisible();
      create.memory().checkVisible();
    });

    it('switches between the form sections', () => {
      create.tabs().clickTabWithName('Volume');
      create.tabPanel('Volume').should('be.visible');
      create.tabPanel('basics').should('not.be.visible');
    });
  });
});

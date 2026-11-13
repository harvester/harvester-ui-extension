import { VirtualMachinesListPagePo, VirtualMachineDetailPagePo, VirtualMachineCreatePagePo } from '@/cypress/e2e/po/pages/virtual-machines.po';
import { recorded, recordedVms, settledRowCount } from '@/cypress/support/recorded';

describe('Virtual machines', { tags: ['@virtualMachines'] }, () => {
  describe('List', () => {
    const list = new VirtualMachinesListPagePo();

    beforeEach(() => {
      list.goTo();
      list.waitForPage();
    });

    it('shows every VM with its state', () => {
      list.title().should('contain', 'Virtual Machines');
      list.rows().should('have.length.greaterThan', 0);
      recorded('vmListRows', () => settledRowCount(() => list.rows())).then((rows) => {
        list.rows().should('have.length', rows);
      });
      recordedVms().then(({ running, stopped }) => {
        list.state(running.name).should('contain.text', 'Running');

        if (stopped) {
          list.state(stopped.name).should('contain.text', 'Off');
        }
      });
    });

    it('filters the VMs by name', () => {
      recordedVms().then(({ running }) => {
        list.sortableTable().filter(running.name);
        list.vmRow(running.name).should('have.length', 1);
        list.rows().should(($rows) => {
          $rows.each((_, row) => {
            expect(row.innerText).to.contain(running.name);
          });
        });
      });
    });

    it('opens the detail page of a VM', () => {
      recordedVms().then(({ running }) => {
        const detail = new VirtualMachineDetailPagePo(running.namespace, running.name);

        list.goToVm(running.name);
        detail.waitForPage();
        detail.name().should('have.text', running.name);
      });
    });
  });

  describe('Detail', () => {
    it('shows the name, state and tabs of a running VM', () => {
      recordedVms().then(({ running }) => {
        const detail = new VirtualMachineDetailPagePo(running.namespace, running.name);

        detail.goTo();
        detail.waitForPage();
        detail.name().should('have.text', running.name);
        detail.state().should('contain.text', 'Running');
        detail.tabs().tabNames().should('include.members', ['Basics', 'Volumes', 'Networks', 'Events']);
      });
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

import HarvesterDashboardPagePo from '@/cypress/e2e/po/pages/harvester-dashboard.po';
import HarvesterListPagePo from '@/cypress/e2e/po/pages/harvester-list-page.po';
import { VirtualMachinesListPagePo, VirtualMachineDetailPagePo, VirtualMachineCreatePagePo } from '@/cypress/e2e/po/pages/virtual-machines.po';

// Only runs with TEST_A11Y=true, which loads the accessibility plugin of @rancher/cypress. Violations
// are recorded in cypress/accessibility/, they never fail a test.
//
// Keep the config object on a single line, like rancher/dashboard's accessibility specs
// eslint-disable-next-line object-curly-newline
describe('Harvester a11y testing', { tags: ['@accessibility'], viewportWidth: 1920, viewportHeight: 1080 }, () => {
  it('Dashboard', () => {
    const dashboard = new HarvesterDashboardPagePo();

    dashboard.goTo();
    dashboard.waitForPage();
    dashboard.resourceGauges().should('have.length.greaterThan', 0);
    cy.injectAxe();
    cy.checkPageAccessibility();
  });

  it('Virtual machines list', () => {
    const list = new VirtualMachinesListPagePo();

    list.goTo();
    list.waitForPage();
    list.rows().should('have.length.greaterThan', 0);
    cy.injectAxe();
    cy.checkPageAccessibility();
  });

  it('Virtual machine detail', () => {
    const detail = new VirtualMachineDetailPagePo('default', 'andy');

    detail.goTo();
    detail.waitForPage();
    detail.name().should('have.text', 'andy');
    cy.injectAxe();
    cy.checkPageAccessibility();
  });

  it('Virtual machine create', () => {
    const create = new VirtualMachineCreatePagePo();

    create.goTo();
    create.waitForPage();
    create.cpu().checkVisible();
    cy.injectAxe();
    cy.checkPageAccessibility();
  });

  [
    { resource: 'harvesterhci.io.volume', name: 'Volumes list' },
    { resource: 'harvesterhci.io.virtualmachineimage', name: 'Images list' },
    { resource: 'harvesterhci.io.host', name: 'Hosts list' },
  ].forEach(({ resource, name }) => {
    it(name, () => {
      const page = new HarvesterListPagePo(resource);

      page.goTo();
      page.waitForPage();
      page.rows().should('have.length.greaterThan', 0);
      cy.injectAxe();
      cy.checkPageAccessibility();
    });
  });
});

import HarvesterDashboardPagePo from '@/cypress/e2e/po/pages/harvester-dashboard.po';
import HarvesterListPagePo from '@/cypress/e2e/po/pages/harvester-list-page.po';

// Row counts are those of cypress/recordings/harvester.har
const LIST_PAGES = [
  {
    resource: 'harvesterhci.io.volume', title: 'Volumes', rows: 21
  },
  {
    resource: 'harvesterhci.io.virtualmachineimage', title: 'Images', rows: 4
  },
  {
    resource: 'harvesterhci.io.host', title: 'Hosts', rows: 1
  },
];

describe('Harvester pages', { tags: ['@navigation'] }, () => {
  it('shows the cluster dashboard', () => {
    const dashboard = new HarvesterDashboardPagePo();

    dashboard.goTo();
    dashboard.waitForPage();
    dashboard.title().should('contain.text', 'Harvester Cluster');
    dashboard.resourceGauges().should('have.length.greaterThan', 0);
  });

  LIST_PAGES.forEach(({ resource, title, rows }) => {
    it(`lists the ${ title.toLowerCase() }`, () => {
      const page = new HarvesterListPagePo(resource);

      page.goTo();
      page.waitForPage();
      page.title().should('contain', title);
      page.rows().should('have.length', rows);
    });
  });
});

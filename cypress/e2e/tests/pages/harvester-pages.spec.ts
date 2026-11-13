import HarvesterDashboardPagePo from '@/cypress/e2e/po/pages/harvester-dashboard.po';
import HarvesterListPagePo from '@/cypress/e2e/po/pages/harvester-list-page.po';
import { recorded, settledRowCount } from '@/cypress/support/recorded';

const LIST_PAGES = [
  { resource: 'harvesterhci.io.volume', title: 'Volumes' },
  { resource: 'harvesterhci.io.virtualmachineimage', title: 'Images' },
  { resource: 'harvesterhci.io.host', title: 'Hosts' },
];

describe('Harvester pages', { tags: ['@navigation'] }, () => {
  it('shows the cluster dashboard', () => {
    const dashboard = new HarvesterDashboardPagePo();

    dashboard.goTo();
    dashboard.waitForPage();
    dashboard.title().should('contain.text', 'Harvester Cluster');
    dashboard.resourceGauges().should('have.length.greaterThan', 0);
  });

  LIST_PAGES.forEach(({ resource, title }) => {
    it(`lists the ${ title.toLowerCase() }`, () => {
      const page = new HarvesterListPagePo(resource);

      page.goTo();
      page.waitForPage();
      page.title().should('contain', title);
      page.rows().should('have.length.greaterThan', 0);
      recorded(`${ resource }Rows`, () => settledRowCount(() => page.rows())).then((rows) => {
        page.rows().should('have.length', rows);
      });
    });
  });
});

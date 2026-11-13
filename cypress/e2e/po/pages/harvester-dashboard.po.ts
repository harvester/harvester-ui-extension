import PagePo from '@rancher/cypress/e2e/po/pages/page.po';
import { harvesterPath, harvesterCluster } from '@/cypress/e2e/po/pages/harvester-list-page.po';

export default class HarvesterDashboardPagePo extends PagePo {
  constructor(clusterId = harvesterCluster()) {
    super(harvesterPath('harvesterhci.io.dashboard', clusterId));
  }

  title() {
    return this.self().find('h1');
  }

  resourceGauges() {
    return this.self().find('[data-testid="simple-box-container"]');
  }
}

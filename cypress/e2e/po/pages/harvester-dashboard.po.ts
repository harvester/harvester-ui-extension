import PagePo from '@rancher/cypress/e2e/po/pages/page.po';
import { harvesterPath, HARVESTER_CLUSTER } from '@/cypress/e2e/po/pages/harvester-list-page.po';

export default class HarvesterDashboardPagePo extends PagePo {
  constructor(clusterId = HARVESTER_CLUSTER) {
    super(harvesterPath('harvesterhci.io.dashboard', clusterId));
  }

  title() {
    return this.self().find('h1');
  }

  resourceGauges() {
    return this.self().find('[data-testid="simple-box-container"]');
  }
}

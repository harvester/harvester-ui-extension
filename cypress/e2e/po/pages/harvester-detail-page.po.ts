import { BaseDetailPagePo } from '@rancher/cypress/e2e/po/pages/base/base-detail-page.po';
import { harvesterPath, harvesterCluster } from '@/cypress/e2e/po/pages/harvester-list-page.po';

/**
 * A resource's detail page in Harvester
 */
export default class HarvesterDetailPagePo extends BaseDetailPagePo {
  constructor(resource: string, namespace: string, name: string, clusterId = harvesterCluster()) {
    super(harvesterPath(`${ resource }/${ namespace }/${ name }`, clusterId));
  }

  name() {
    return this.self().find('.masthead-resource-title');
  }
}

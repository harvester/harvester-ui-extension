import { BaseListPagePo } from '@rancher/cypress/e2e/po/pages/base/base-list-page.po';

export const HARVESTER_CLUSTER = 'local';

/**
 * Path of a page in the standalone Harvester UI, e.g. /harvester/c/local/harvesterhci.io.volume
 */
export function harvesterPath(path: string, clusterId = HARVESTER_CLUSTER): string {
  return `/harvester/c/${ clusterId }/${ path }`;
}

/**
 * A resource list page of the standalone Harvester UI
 */
export default class HarvesterListPagePo extends BaseListPagePo {
  constructor(resource: string, clusterId = HARVESTER_CLUSTER) {
    super(harvesterPath(resource, clusterId));
  }

  title() {
    return this.baseResourceList().masthead().title();
  }

  sortableTable() {
    return this.list().resourceTable().sortableTable();
  }

  rows() {
    return this.sortableTable().rowElements();
  }
}

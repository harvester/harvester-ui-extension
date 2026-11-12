import { BaseListPagePo } from '@rancher/cypress/e2e/po/pages/base/base-list-page.po';

/**
 * The Harvester cluster the specs run on: `local` standalone, its cluster id in Rancher
 */
export function harvesterCluster(): string {
  return Cypress.env('harvesterCluster');
}

/**
 * Path of a Harvester page, e.g. /harvester/c/local/harvesterhci.io.volume
 */
export function harvesterPath(path: string, clusterId = harvesterCluster()): string {
  return `/harvester/c/${ clusterId }/${ path }`;
}

/**
 * A resource list page of Harvester
 */
export default class HarvesterListPagePo extends BaseListPagePo {
  constructor(resource: string, clusterId = harvesterCluster()) {
    super(harvesterPath(resource, clusterId));
  }

  title() {
    return this.baseResourceList().masthead().title();
  }

  sortableTable() {
    return this.list().resourceTable().sortableTable();
  }

  /**
   * The resource rows, without the "There are no rows to show" row an empty or still loading list has
   */
  rows() {
    return this.sortableTable().rowElements().filter(':not(.no-rows):not(.no-results)');
  }
}

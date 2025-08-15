import { HCI } from '../types';

// Some harvester CRD type is not equal to model file name, define the mapping here
const HARVESTER_CRD_MAP = {
  node:                                     HCI.HOST,
  configmap:                                HCI.CLOUD_TEMPLATE,
  persistentvolumeclaim:                    HCI.VOLUME,
  'snapshot.storage.k8s.io.volumesnapshot': HCI.SNAPSHOT,
  // specific groupable table detail page
  'network.harvesterhci.io.vlanconfig':     HCI.CLUSTER_NETWORK,
  'kubeovn.io.subnet':                      HCI.VPC
};

export function getHarvesterResource(type) {
  return HARVESTER_CRD_MAP[type] || type;
}

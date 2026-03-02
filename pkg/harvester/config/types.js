export const BACKUP_TYPE = {
  BACKUP:   'backup',
  SNAPSHOT: 'snapshot'
};

export const NETWORK_TYPE = {
  L2VLAN:       'L2VlanNetwork',
  UNTAGGED:     'UntaggedNetwork',
  OVERLAY:      'OverlayNetwork',
  L2TRUNK_VLAN: 'L2VlanTrunkNetwork',
};

export const VOLUME_MODE = {
  BLOCK:       'Block',
  FILE_SYSTEM: 'Filesystem'
};

export const NETWORK_PROTOCOL = {
  IPv4: 'IPv4',
  IPv6: 'IPv6',
};

export const INTERNAL_STORAGE_CLASS = {
  VMSTATE_PERSISTENCE: 'vmstate-persistence',
  LONGHORN_STATIC:     'longhorn-static',
};

export const L2VLAN_MODE = {
  ACCESS: 'access',
  TRUNK:  'trunk',
};

export const VMIMPORT_SOURCE_PROVIDER = {
  VMWARE:    'vmware',
  OPENSTACK: 'openstack',
  KVM:       'kvm',
  OVA:       'ova',
};

export const VMIMPORT_SOURCE_KINDS = {
  VMWARE:    'VmwareSource',
  OPENSTACK: 'OpenstackSource',
  KVM:       'KVMSource',
  OVA:       'OvaSource',
};

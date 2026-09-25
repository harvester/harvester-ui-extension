// VM Catalog helpers — framework-free so they can be unit-tested with plain Node.
//
// Flow: buildCatalogVm() -> PUT expand-vm-spec (KubeVirt resolves instancetype +
// preference server-side) -> harvesterShim() -> create.
// The shim only exists because Harvester's webhooks assume inline cpu/memory
// (memory validator + maxSockets JSON-patch "replace"). Drop it once fixed upstream.

export const CLUSTER_INSTANCETYPE = 'instancetype.kubevirt.io.virtualmachineclusterinstancetype';
export const CLUSTER_PREFERENCE = 'instancetype.kubevirt.io.virtualmachineclusterpreference';

// Same keys KubeVirt uses on PVCs/DataSources for inference, applied here to
// Harvester VirtualMachineImages as the catalog's own convention.
export const LABEL_DEFAULT_PREFERENCE = 'instancetype.kubevirt.io/default-preference';
export const LABEL_DEFAULT_INSTANCETYPE = 'instancetype.kubevirt.io/default-instancetype';

// Provenance, so a catalog VM can be traced back after expansion removed the refs.
export const CATALOG_ANNOTATIONS = {
  INSTANCETYPE: 'catalog.harvesterhci.io/instancetype',
  PREFERENCE:   'catalog.harvesterhci.io/preference',
  IMAGE:        'catalog.harvesterhci.io/image',
};

const HCI_OS_TYPE = 'harvesterhci.io/os-type';
const HCI_IMAGE_TYPE = 'harvesterhci.io/image-type';
const HCI_CLUSTER_NETWORK = 'network.harvesterhci.io/clusternetwork';

export const MANAGEMENT_NETWORK = '__management__';
export const FEATURED_SIZES = ['small', 'medium', 'large', 'xlarge'];
export const DEFAULT_INSTANCETYPE = 'u1.medium';

export const SERIES_LABELS = {
  u1:  'General purpose',
  o1:  'Overcommitted',
  cx1: 'Compute',
  m1:  'Memory',
  n1:  'Network',
  rt1: 'Realtime',
  gn1: 'GPU',
};

// Harvester image OS label (see OS list in mixins/harvester-vm) -> preference name prefixes.
const OS_TYPE_TO_PREFIXES = {
  SLEs:       ['sles'],
  openSUSE:   ['opensuse'],
  ubuntu:     ['ubuntu'],
  debian:     ['debian'],
  fedora:     ['fedora'],
  redhat:     ['rhel'],
  oracle:     ['oraclelinux', 'oracle'],
  windows:    ['windows'],
  linux:      ['linux'],
  otherLinux: ['centos', 'linux'],
  gentoo:     ['linux'],
};

// Image display-name tokens -> preference name prefixes (when the image has no OS label).
const NAME_HINTS = [
  [/sle[s-]?|suse-linux-enterprise|sl-micro/i, ['sles']],
  [/leap/i, ['opensuse.leap']],
  [/tumbleweed/i, ['opensuse.tumbleweed']],
  [/opensuse/i, ['opensuse']],
  [/ubuntu|jammy|noble/i, ['ubuntu']],
  [/debian|bookworm|trixie/i, ['debian']],
  [/fedora/i, ['fedora']],
  [/rhel|red.?hat/i, ['rhel']],
  [/centos/i, ['centos']],
  [/alpine/i, ['alpine']],
  [/cirros/i, ['cirros']],
  [/oracle/i, ['oraclelinux', 'oracle']],
  [/win(dows)?/i, ['windows']],
];

const KNOWN_DISPLAY = {
  sles:                  'SUSE Linux Enterprise',
  'opensuse.leap':       'openSUSE Leap',
  'opensuse.tumbleweed': 'openSUSE Tumbleweed',
  ubuntu:                'Ubuntu',
  debian:                'Debian',
  fedora:                'Fedora',
  alpine:                'Alpine Linux',
  cirros:                'CirrOS',
  linux:                 'Generic Linux',
  legacy:                'Legacy',
};

export function preferenceDisplayName(pref) {
  const name = pref?.metadata?.name || '';
  const annotated = pref?.metadata?.annotations?.['openshift.io/display-name'];

  if (annotated) {
    return annotated;
  }
  if (KNOWN_DISPLAY[name]) {
    return KNOWN_DISPLAY[name];
  }

  const [base, ver = ''] = name.split(/\.(.+)/);
  const bases = {
    rhel: 'Red Hat Enterprise Linux', centos: 'CentOS', windows: 'Windows', oraclelinux: 'Oracle Linux'
  };
  const v = ver
    .replace(/^stream/, 'Stream ')
    .replace(/^2k(\d\d)/, 'Server 20$1')
    .replace(/\.virtio$/, ' (virtio)')
    .replace(/\./g, ' ');

  return `${ bases[base] || base.charAt(0).toUpperCase() + base.slice(1) } ${ v }`.trim();
}

// Among candidate preferences, prefer one whose version token appears in the
// image name (e.g. "rhel-9.4" -> rhel.9), else the highest version.
function pickPreference(prefNames, prefixes, hint = '') {
  const candidates = prefNames.filter((n) => prefixes.some((p) => n === p || n.startsWith(`${ p }.`)));

  if (!candidates.length) {
    return null;
  }

  const h = hint.toLowerCase();
  const sorted = [...candidates].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const byHint = sorted.find((n) => {
    const ver = n.split('.').slice(1).join('.');

    if (!ver) {
      return false;
    }

    return [ver, ver.replace(/^2k/, '20'), ver.replace(/^stream/, '')].some((v) => h.includes(v));
  });

  if (byHint) {
    return byHint;
  }

  // Prefer plain (non ".virtio"/"-efi") variants, then highest version.
  return [...candidates].sort((a, b) => {
    const plain = (n) => (/virtio|efi/.test(n) ? 1 : 0);

    return plain(a) - plain(b) || b.localeCompare(a, undefined, { numeric: true });
  })[0];
}

export function resolvePreferenceName(image, prefNames) {
  const labels = image?.metadata?.labels || {};
  const explicit = labels[LABEL_DEFAULT_PREFERENCE];

  if (explicit && prefNames.includes(explicit)) {
    return explicit;
  }

  const hint = `${ image?.spec?.displayName || '' } ${ image?.metadata?.name || '' }`;
  const osType = labels[HCI_OS_TYPE];

  if (osType && OS_TYPE_TO_PREFIXES[osType]) {
    // openSUSE needs the name to tell Leap from Tumbleweed.
    const fromName = NAME_HINTS.find(([re]) => re.test(hint));
    const prefixes = osType === 'openSUSE' && fromName ? fromName[1] : OS_TYPE_TO_PREFIXES[osType];
    const picked = pickPreference(prefNames, prefixes, hint);

    if (picked) {
      return picked;
    }
  }

  for (const [re, prefixes] of NAME_HINTS) {
    if (re.test(hint)) {
      const picked = pickPreference(prefNames, prefixes, hint);

      if (picked) {
        return picked;
      }
    }
  }

  return null;
}

export function isCatalogImage(image) {
  const labels = image?.metadata?.labels || {};

  return !!image?.status?.storageClassName &&
    labels[HCI_IMAGE_TYPE] !== 'iso' &&
    image?.metadata?.annotations?.['harvesterhci.io/os-upgrade-image'] !== 'True' &&
    (image?.status?.conditions || []).some((c) => c.type === 'Imported' && c.status === 'True');
}

// ---------------------------------------------------------------------------
// Sizes

export function parseQuantity(q) {
  if (q === undefined || q === null || q === '') {
    return 0;
  }
  const m = String(q).match(/^([0-9.]+)\s*([KMGTP]i?)?$/);

  if (!m) {
    return Number(q) || 0;
  }
  const pow = {
    K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40, Pi: 2 ** 50
  };

  return parseFloat(m[1]) * (m[2] ? pow[m[2]] : 1);
}

export function formatGi(bytes) {
  const gi = bytes / 2 ** 30;

  return `${ Number.isInteger(gi) ? gi : gi.toFixed(1) } GiB`;
}

export function sizeOf(instancetype) {
  const spec = instancetype?.spec || {};
  const name = instancetype?.metadata?.name || '';
  const [series, tier = name] = name.split(/\.(.+)/);

  return {
    name,
    series,
    tier,
    cpu:    spec.cpu?.guest || 0,
    memory: parseQuantity(spec.memory?.guest),
  };
}

// ---------------------------------------------------------------------------
// Name suggestion

const NAME_WORDS = [
  'amber', 'aspen', 'basalt', 'birch', 'breeze', 'cedar', 'comet', 'coral', 'delta', 'ember',
  'falcon', 'fern', 'fjord', 'flint', 'glacier', 'harbor', 'heron', 'iris', 'juniper', 'kestrel',
  'lagoon', 'larch', 'lynx', 'maple', 'meadow', 'nova', 'onyx', 'orbit', 'otter', 'pebble',
  'pine', 'quartz', 'raven', 'ridge', 'river', 'saffron', 'sparrow', 'summit', 'tundra', 'willow',
];

// "opensuse.tumbleweed" -> "tumbleweed", "rhel.9" -> "rhel9", "windows.2k25.virtio" -> "win2k25"
export function namePrefix(preferenceName, fallback = 'vm') {
  if (!preferenceName) {
    return fallback;
  }
  const [base, ver = ''] = preferenceName.split(/\.(.+)/);
  const short = {
    opensuse: '', windows: 'win', oraclelinux: 'ol'
  };
  const head = base in short ? short[base] : base;
  const tail = ver.replace(/\.?virtio$/, '').replace(/^stream/, '').replace(/[^a-z0-9]/gi, '');
  const prefix = `${ head }${ head && tail && /^[a-z]/i.test(tail) ? '-' : '' }${ tail }`.toLowerCase();

  return prefix || fallback;
}

export function suggestName(preferenceName) {
  const word = NAME_WORDS[Math.floor(Math.random() * NAME_WORDS.length)];

  return `${ namePrefix(preferenceName) }-${ word }-${ randomSuffix(3) }`;
}

// ---------------------------------------------------------------------------
// VM construction

function randomSuffix(len = 5) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function cloudInit({ password, sshKeys }) {
  const lines = ['#cloud-config'];

  if (password) {
    lines.push(`password: ${ JSON.stringify(password) }`, 'chpasswd: { expire: false }', 'ssh_pwauth: true');
  }
  if (sshKeys.length) {
    lines.push('ssh_authorized_keys:', ...sshKeys.map((k) => `  - ${ k.spec.publicKey.trim() }`));
  }

  return `${ lines.join('\n') }\n`;
}

/**
 * Build a VM that references an instancetype and preference.
 * Deliberately leaves out cpu/memory/disk bus/interface model/firmware:
 * those come from the instancetype and preference during expansion.
 */
export function buildCatalogVm({
  name, namespace, image, instancetype, preference, diskGi, network, sshKeys = [], password = '', start = true
}) {
  const imageId = `${ image.metadata.namespace }/${ image.metadata.name }`;
  const claimName = `${ name }-disk-0-${ randomSuffix() }`;
  const osType = image.metadata?.labels?.[HCI_OS_TYPE];

  const volumeClaimTemplates = [{
    metadata: { name: claimName, annotations: { 'harvesterhci.io/imageId': imageId } },
    spec:     {
      accessModes:      ['ReadWriteMany'],
      resources:        { requests: { storage: `${ diskGi }Gi` } },
      volumeMode:       'Block',
      storageClassName: image.status.storageClassName,
    },
  }];

  const isManagement = !network || network === MANAGEMENT_NETWORK;
  const networks = isManagement ? [{ name: 'default', pod: {} }] : [{ name: 'default', multus: { networkName: `${ network.metadata.namespace }/${ network.metadata.name }` } }];
  const iface = isManagement ? { name: 'default', masquerade: {} } : { name: 'default', bridge: {} };
  const clusterNetwork = !isManagement && network.metadata?.labels?.[HCI_CLUSTER_NETWORK];
  const affinity = clusterNetwork ? {
    nodeAffinity: {
      requiredDuringSchedulingIgnoredDuringExecution: {
        nodeSelectorTerms: [{
          matchExpressions: [{
            key: `network.harvesterhci.io/${ clusterNetwork }`, operator: 'In', values: ['true']
          }]
        }]
      }
    }
  } : undefined;

  const vm = {
    apiVersion: 'kubevirt.io/v1',
    kind:       'VirtualMachine',
    metadata:   {
      name,
      namespace,
      labels: {
        'harvesterhci.io/creator': 'harvester',
        ...(osType ? { 'harvesterhci.io/os': osType } : {}),
      },
      annotations: {
        'harvesterhci.io/vmRunStrategy':        'RerunOnFailure',
        'harvesterhci.io/volumeClaimTemplates': JSON.stringify(volumeClaimTemplates),
        'harvesterhci.io/sshNames':             JSON.stringify(sshKeys.map((k) => `${ k.metadata.namespace }/${ k.metadata.name }`)),
        [CATALOG_ANNOTATIONS.INSTANCETYPE]:     instancetype,
        [CATALOG_ANNOTATIONS.IMAGE]:            imageId,
        ...(preference ? { [CATALOG_ANNOTATIONS.PREFERENCE]: preference } : {}),
      },
    },
    spec: {
      // Harvester keeps the "running" strategy in the annotation and uses Halted
      // for stopped VMs, so Start restores RerunOnFailure.
      runStrategy:  start ? 'RerunOnFailure' : 'Halted',
      instancetype: { kind: 'VirtualMachineClusterInstancetype', name: instancetype },
      ...(preference ? { preference: { kind: 'VirtualMachineClusterPreference', name: preference } } : {}),
      template:     {
        metadata: { labels: { 'harvesterhci.io/vmName': name } },
        spec:     {
          ...(affinity ? { affinity } : {}),
          domain: {
            devices: {
              disks: [
                {
                  name: 'disk-0', bootOrder: 1, disk: {}
                },
                { name: 'cloudinitdisk', disk: {} },
              ],
              interfaces: [iface],
              inputs:     [{
                bus: 'usb', name: 'tablet', type: 'tablet'
              }],
            },
          },
          evictionStrategy:              'LiveMigrateIfPossible',
          hostname:                      name,
          networks,
          terminationGracePeriodSeconds: 120,
          volumes:                       [
            { name: 'disk-0', persistentVolumeClaim: { claimName } },
            { name: 'cloudinitdisk', cloudInitNoCloud: { userData: cloudInit({ password, sshKeys }) } },
          ],
        },
      },
    },
  };

  return vm;
}

// ---------------------------------------------------------------------------
// Expansion + Harvester shim

export function expandPath(namespace) {
  return `apis/subresources.kubevirt.io/v1/namespaces/${ encodeURIComponent(namespace) }/expand-vm-spec`;
}

// The shell's request action decorates responses (_status, _headers, ...).
export function cleanExpanded(resp) {
  const src = resp?.data?.kind ? resp.data : resp;
  const {
    apiVersion, kind, metadata, spec
  } = src || {};

  if (kind !== 'VirtualMachine' || !spec?.template) {
    throw new Error('expand-vm-spec returned an unexpected payload');
  }

  return JSON.parse(JSON.stringify({
    apiVersion, kind, metadata, spec
  }));
}

/**
 * Bridge between an expanded spec and what Harvester's webhooks/UI expect:
 * - cpu.maxSockets must exist (mutator does a JSON-patch "replace" on it)
 * - resources.limits drive overcommit requests and the memory column in the UI
 */
export function harvesterShim(vm) {
  const out = JSON.parse(JSON.stringify(vm));
  const domain = out.spec.template.spec.domain;
  const cpu = domain.cpu || {};
  const sockets = cpu.sockets || 1;
  const vcpus = sockets * (cpu.cores || 1) * (cpu.threads || 1);

  domain.cpu = {
    ...cpu, sockets, maxSockets: sockets
  };
  domain.resources = {
    ...(domain.resources || {}),
    limits: {
      ...(domain.resources?.limits || {}),
      cpu:    String(vcpus),
      memory: domain.memory?.guest,
    },
  };

  delete out.spec.instancetype;
  delete out.spec.preference;
  delete out.status;

  return out;
}

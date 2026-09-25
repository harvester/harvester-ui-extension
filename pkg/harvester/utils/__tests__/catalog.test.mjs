import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseQuantity,
  formatGi,
  sizeOf,
  namePrefix,
  suggestName,
  preferenceDisplayName,
  resolvePreferenceName,
  isCatalogImage,
  buildCatalogVm,
  expandPath,
  cleanExpanded,
  harvesterShim,
  CATALOG_ANNOTATIONS,
  MANAGEMENT_NETWORK,
} from '../catalog.js';

describe('catalog.js unit tests', () => {
  describe('parseQuantity & formatGi', () => {
    it('parses empty / undefined / null quantities to 0', () => {
      assert.equal(parseQuantity(null), 0);
      assert.equal(parseQuantity(undefined), 0);
      assert.equal(parseQuantity(''), 0);
    });

    it('parses binary memory suffixes (Ki, Mi, Gi, Ti)', () => {
      assert.equal(parseQuantity('1024Ki'), 1024 * 1024);
      assert.equal(parseQuantity('512Mi'), 512 * 1024 * 1024);
      assert.equal(parseQuantity('4Gi'), 4 * 1024 * 1024 * 1024);
      assert.equal(parseQuantity('1Ti'), 1024 * 1024 * 1024 * 1024);
    });

    it('parses decimal memory suffixes (K, M, G, T)', () => {
      assert.equal(parseQuantity('1000K'), 1e6);
      assert.equal(parseQuantity('500M'), 500e6);
      assert.equal(parseQuantity('2G'), 2e9);
    });

    it('formats bytes to human-readable GiB', () => {
      assert.equal(formatGi(2 * 1024 * 1024 * 1024), '2 GiB');
      assert.equal(formatGi(1.5 * 1024 * 1024 * 1024), '1.5 GiB');
    });
  });

  describe('sizeOf', () => {
    it('parses series, tier, cpu, and memory from a cluster instancetype', () => {
      const instancetype = {
        metadata: { name: 'u1.medium' },
        spec:     {
          cpu:    { guest: 2 },
          memory: { guest: '4Gi' },
        },
      };

      const size = sizeOf(instancetype);
      assert.equal(size.name, 'u1.medium');
      assert.equal(size.series, 'u1');
      assert.equal(size.tier, 'medium');
      assert.equal(size.cpu, 2);
      assert.equal(size.memory, 4 * 1024 * 1024 * 1024);
    });

    it('handles instancetypes with non-standard names gracefully', () => {
      const it = { metadata: { name: 'custom' } };
      const s = sizeOf(it);
      assert.equal(s.series, 'custom');
      assert.equal(s.tier, 'custom');
      assert.equal(s.cpu, 0);
      assert.equal(s.memory, 0);
    });
  });

  describe('namePrefix & suggestName', () => {
    it('generates expected prefixes from preference names', () => {
      assert.equal(namePrefix('opensuse.tumbleweed'), 'tumbleweed');
      assert.equal(namePrefix('opensuse.leap.15.6'), 'leap156');
      assert.equal(namePrefix('rhel.9'), 'rhel9');
      assert.equal(namePrefix('windows.2k25.virtio'), 'win2k25');
      assert.equal(namePrefix('ubuntu'), 'ubuntu');
      assert.equal(namePrefix(null, 'default-vm'), 'default-vm');
    });

    it('suggests a valid RFC 1123 compliant VM name', () => {
      const name = suggestName('opensuse.leap');
      assert.match(name, /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);
      assert.match(name, /^leap/);
    });
  });

  describe('preferenceDisplayName', () => {
    it('uses known display names when available', () => {
      assert.equal(preferenceDisplayName({ metadata: { name: 'opensuse.leap' } }), 'openSUSE Leap');
      assert.equal(preferenceDisplayName({ metadata: { name: 'ubuntu' } }), 'Ubuntu');
      assert.equal(preferenceDisplayName({ metadata: { name: 'debian' } }), 'Debian');
    });

    it('prefers openshift.io/display-name annotation when present and cleans it up', () => {
      const pref = {
        metadata: {
          name:        'windows.2k25',
          annotations: { 'openshift.io/display-name': 'Microsoft Windows Server 2025 (amd64)' },
        },
      };
      assert.equal(preferenceDisplayName(pref), 'Windows Server 2025');
    });
  });

  describe('resolvePreferenceName', () => {
    const prefNames = [
      'sles.15.5', 'sles.15.6', 'sles.15.6.virtio',
      'opensuse.leap.15.5', 'opensuse.tumbleweed',
      'ubuntu', 'debian.12', 'fedora', 'windows.2k25', 'windows.2k25.efi',
    ];

    it('uses explicit instancetype.kubevirt.io/default-preference label if present and valid', () => {
      const img = {
        metadata: { labels: { 'instancetype.kubevirt.io/default-preference': 'ubuntu' } },
        spec:     { displayName: 'Custom Image' },
      };
      assert.equal(resolvePreferenceName(img, prefNames), 'ubuntu');
    });

    it('resolves openSUSE images using name hints (Leap vs Tumbleweed)', () => {
      const leap = {
        metadata: { labels: { 'harvesterhci.io/os-type': 'openSUSE' } },
        spec:     { displayName: 'openSUSE-Leap-15.5.qcow2' },
      };
      assert.equal(resolvePreferenceName(leap, prefNames), 'opensuse.leap.15.5');

      const tw = {
        metadata: { labels: { 'harvesterhci.io/os-type': 'openSUSE' } },
        spec:     { displayName: 'openSUSE-Tumbleweed-Minimal-VM.qcow2' },
      };
      assert.equal(resolvePreferenceName(tw, prefNames), 'opensuse.tumbleweed');
    });

    it('resolves EFI variants when UEFI/EFI is requested in the image hint', () => {
      const winEfi = {
        spec: { displayName: 'Windows-Server-2025-EFI.qcow2' },
      };
      assert.equal(resolvePreferenceName(winEfi, prefNames), 'windows.2k25.efi');
    });
  });

  describe('isCatalogImage', () => {
    it('returns true for ready, non-ISO, non-upgrade images with storageClass', () => {
      const valid = {
        status: {
          storageClassName: 'longhorn',
          conditions:       [{ type: 'Imported', status: 'True' }],
        },
        metadata: { labels: { 'harvesterhci.io/image-type': 'qcow2' } },
      };
      assert.equal(isCatalogImage(valid), true);
    });

    it('filters out ISO images', () => {
      const iso = {
        status:   { storageClassName: 'longhorn', conditions: [{ type: 'Imported', status: 'True' }] },
        metadata: { labels: { 'harvesterhci.io/image-type': 'iso' } },
      };
      assert.equal(isCatalogImage(iso), false);
    });

    it('filters out OS upgrade images', () => {
      const upgrade = {
        status:   { storageClassName: 'longhorn', conditions: [{ type: 'Imported', status: 'True' }] },
        metadata: { annotations: { 'harvesterhci.io/os-upgrade-image': 'True' } },
      };
      assert.equal(isCatalogImage(upgrade), false);
    });
  });

  describe('buildCatalogVm', () => {
    it('builds a valid VirtualMachine referencing instancetype and preference with cloud-init', () => {
      const vm = buildCatalogVm({
        name:         'test-vm',
        namespace:    'default',
        image:        { metadata: { namespace: 'default', name: 'img-1' }, status: { storageClassName: 'longhorn' } },
        instancetype: 'u1.medium',
        preference:   'opensuse.leap',
        diskGi:       20,
        network:      MANAGEMENT_NETWORK,
        sshKeys:      [{ metadata: { namespace: 'default', name: 'key1' }, spec: { publicKey: 'ssh-ed25519 AAAAC3... user@host\n' } }],
        password:     'secret123',
        start:        true,
      });

      assert.equal(vm.metadata.name, 'test-vm');
      assert.equal(vm.metadata.namespace, 'default');
      assert.equal(vm.metadata.annotations[CATALOG_ANNOTATIONS.INSTANCETYPE], 'u1.medium');
      assert.equal(vm.metadata.annotations[CATALOG_ANNOTATIONS.PREFERENCE], 'opensuse.leap');
      assert.equal(vm.spec.instancetype.name, 'u1.medium');
      assert.equal(vm.spec.preference.name, 'opensuse.leap');
      assert.equal(vm.spec.runStrategy, 'RerunOnFailure');

      // Verify sanitized cloud-init user-data
      const cloudInitVol = vm.spec.template.spec.volumes.find((v) => v.name === 'cloudinitdisk');
      assert.ok(cloudInitVol?.cloudInitNoCloud?.userData);
      const ud = cloudInitVol.cloudInitNoCloud.userData;
      assert.match(ud, /ssh-ed25519 AAAAC3\.\.\. user@host/);
      assert.match(ud, /password: "secret123"/);
    });
  });

  describe('expandPath & cleanExpanded', () => {
    it('generates the correct URI for expand-vm-spec API', () => {
      assert.equal(expandPath('default'), 'apis/subresources.kubevirt.io/v1/namespaces/default/expand-vm-spec');
    });

    it('cleans shell decoration wrappers from response', () => {
      const raw = {
        data: {
          apiVersion: 'kubevirt.io/v1',
          kind:       'VirtualMachine',
          metadata:   { name: 'vm1' },
          spec:       { template: { spec: {} } },
          _status:    200,
        },
      };
      const cleaned = cleanExpanded(raw);
      assert.equal(cleaned.apiVersion, 'kubevirt.io/v1');
      assert.equal(cleaned.metadata.name, 'vm1');
      assert.equal(cleaned._status, undefined);
    });
  });

  describe('harvesterShim', () => {
    it('pins maxSockets to sockets and injects resources.limits for Harvester overcommit', () => {
      const expandedVm = {
        spec: {
          instancetype: { name: 'u1.medium' },
          preference:   { name: 'opensuse.leap' },
          template:     {
            spec: {
              domain: {
                cpu:       { sockets: 1, cores: 2, threads: 1 },
                memory:    { guest: '4Gi' },
                resources: {},
              },
            },
          },
        },
      };

      const shimmed = harvesterShim(expandedVm);
      const domain = shimmed.spec.template.spec.domain;

      // Verification of webhooks requirements
      assert.equal(domain.cpu.sockets, 1);
      assert.equal(domain.cpu.maxSockets, 1);
      assert.equal(domain.resources.limits.cpu, '2');
      assert.equal(domain.resources.limits.memory, '4Gi');

      // References removed so Harvester webhooks don't conflict
      assert.equal(shimmed.spec.instancetype, undefined);
      assert.equal(shimmed.spec.preference, undefined);
    });

    it('falls back to domain.resources.requests.memory if domain.memory.guest is absent', () => {
      const expandedVm = {
        spec: {
          template: {
            spec: {
              domain: {
                cpu:       { sockets: 2, cores: 1, threads: 1 },
                resources: { requests: { memory: '8Gi' } },
              },
            },
          },
        },
      };

      const shimmed = harvesterShim(expandedVm);
      assert.equal(shimmed.spec.template.spec.domain.resources.limits.memory, '8Gi');
    });
  });
});

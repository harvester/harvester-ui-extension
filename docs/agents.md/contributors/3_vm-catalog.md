## VM Catalog (fork feature, demo/prototype)

An OpenShift-style "Catalog" entry in the left nav: pick an OS tile, pick a size tile, fill a short form, create the VM. It is driven by the **upstream KubeVirt instancetype API**; do not invent Harvester-specific size or OS objects.

- Fork: `https://github.com/coulof/harvester-ui-extension`, branch `feat/vm-catalog`, based on upstream `release-harvester-v1.9` (not `main`: the UI gates features on server version).
- Status: prototype for a demo. The target audience is customers and SUSE colleagues, not an upstream PR yet.

### Target environment (verified facts, do not re-derive)

| Item | Value |
|---|---|
| Harvester | v1.9.0 |
| KubeVirt | 1.8.4-9.1 (SUSE build) |
| Instancetype API | `instancetype.kubevirt.io/v1beta1` only (no `v1` served) |
| Rancher | `https://10.144.98.13.sslip.io` |

virt-operator already deploys the **common-instancetypes** bundle, so no install is needed:

- **Cluster instancetypes:** the `u1.*` series is `nano`, `micro`, `small`, `medium`, `2xmedium`, `large`, `xlarge`, `2xlarge`, `4xlarge`, `8xlarge`. Other series (`cx1`, `m1`, `n1`, `o1`…) may exist.
- **Cluster preferences:** about 54 of them, including `sles`, `opensuse.leap`, `opensuse.tumbleweed`, `ubuntu`, `debian`, `fedora`, `rhel.*`, `centos.stream*`, `windows.*`, `alpine`, `cirros`, `linux`, `legacy`.
  - Each carries an `iconClass` annotation (`icon-sles`, `icon-ubuntu`, `icon-windows`, …) and a `vm.kubevirt.io/os` annotation (`linux` | `windows` | `legacy`).

### Architecture decision: expand, don't reference

A VM that *references* an instancetype (`spec.instancetype` / `spec.preference`) is **rejected by Harvester's admission webhooks**. KubeVirt itself accepts it. The two errors observed:

1. `spec.template.spec.domain: either memory.guest or resources.limits.memory must be set` (Harvester validator).
2. `replace operation does not apply: doc is missing path: /spec/template/spec/domain/cpu/maxSockets` (Harvester mutator uses a JSON-patch `replace` on a path that only exists when `domain.cpu` is inline).

Therefore the flow is:

```
buildCatalogVm()            VM with instancetype + preference refs, no cpu/memory/bus/model/firmware
  -> PUT expand-vm-spec     KubeVirt resolves refs server-side, returns a plain VM, refs removed
  -> cleanExpanded()        strip shell response decorations (_status, _headers, ...)
  -> harvesterShim()        cpu.maxSockets = cpu.sockets; resources.limits = {cpu: vCPUs, memory: memory.guest}
  -> harvester/create + save
```

Rules that follow from this:

- **Never reimplement instancetype/preference merge logic in JS.** Always call `expand-vm-spec`.
- **`expand-vm-spec` is `PUT`, body = VM JSON, `Content-Type: application/json` is mandatory.**
  - Without the header the API returns 415; POST returns 405.
  - `kubectl replace --raw` cannot set the header. From the CLI use `virtctl expand -n <ns> -f vm.json -o json`.
  - Endpoint: `apis/subresources.kubevirt.io/v1/namespaces/<ns>/expand-vm-spec`.
- **The shim is required, not cosmetic.**
  - Without `maxSockets` the mutator fails.
  - Without `limits`, Harvester's overcommit is not applied: the pod requests the full guest memory.
  - Also without `limits`, the Harvester UI shows no memory (it reads `resources.limits.memory`, not `memory.guest`).
  - Keep the shim isolated in `harvesterShim()` so it can be deleted once upstream fixes the webhooks.
- **KubeVirt defaults hotplug headroom** (`maxSockets` = 4×, `maxGuest` = 4×) on instancetype VMs. The shim pins `maxSockets` to `sockets`, matching what the Harvester form produces.
- **Run strategy:** The "Start after creation" toggle controls `spec.runStrategy: start ? 'RerunOnFailure' : 'Halted'`. Harvester saves the running strategy in annotations and uses `Halted` for stopped VMs, so `RerunOnFailure` ensures clean startup.
- **Validated manually end to end:** expanded and shimmed VMs apply, boot and live-migrate.

### Files

| File | Role |
|---|---|
| `pkg/harvester/utils/catalog.js` | Framework-free logic: preference resolution, size parsing, name suggestion (`suggestName`, `namePrefix`), `buildCatalogVm`, `expandPath`, `cleanExpanded`, `harvesterShim`. **Keep it free of Vue/store imports** so it stays testable with plain Node. |
| `pkg/harvester/utils/catalog-icons.js` | SVG paths keyed by preference `iconClass`. Unknown classes fall back to a monogram. |
| `pkg/harvester/pages/c/_cluster/catalog/index.vue` | The page (Options API): three steps, sticky footer, "Preview spec" showing the refs vs the expanded domain. |
| `pkg/harvester/routing/harvester-routing.js` | Route `${PRODUCT_NAME}-c-cluster-catalog` at `/:product/c/:cluster/catalog`. |
| `pkg/harvester/config/harvester-map.js` | Added `VM_CATALOG: 'vm-catalog'` to `ADD_ONS`. |
| `pkg/harvester/config/harvester-cluster.js` | `virtualType` `vm-catalog`, group `root`, weight `498.5`. Gated by `ADD_ONS.VM_CATALOG` via `registerAddonSideNav()`. |
| `pkg/harvester/l10n/en-us.yaml` | `harvester.catalog.label` and `harvester.addons.descriptions` for `vm-catalog`. |
| `chart/vm-catalog` | Minimal Helm chart for the VM Catalog addon, creating RBAC for `expand-vm-spec`. |

### How images map to OS tiles (`resolvePreferenceName`)

The first match wins:

1. The image label `instancetype.kubevirt.io/default-preference: <pref>`. This reuses the key KubeVirt applies to PVCs/DataSources, here as the catalog's own convention on `VirtualMachineImage`.
2. Harvester's existing image label `harvesterhci.io/os-type` (values from the `OS` list in `mixins/harvester-vm/index.js`: `SLEs`, `openSUSE`, `ubuntu`, `redhat`, `windows`, …), mapped to preference name prefixes.
3. Regex hints on the image display name (leap vs tumbleweed, rhel-9, win2k22, …).
4. Otherwise the image goes to the "Other" tile, with no preference.

Among candidate preferences, the version token matching the image name wins; otherwise the highest version wins, preferring plain variants over `.virtio`/`efi` ones. The image label `instancetype.kubevirt.io/default-instancetype` preselects the size; the fallback is `u1.medium`.

Images are listed only if they:
- are imported,
- have `status.storageClassName`,
- are not ISO (`harvesterhci.io/image-type != iso`),
- are not OS-upgrade images.

### Conventions specific to this extension

- **Cluster URLs:** build them with `this.$store.getters['harvester-common/getHarvesterClusterUrl'](path)`. It adds `/k8s/clusters/<id>/` in Rancher mode and nothing in standalone mode. Never hardcode `/k8s/clusters`. The page must work in both modes.
- **Raw requests:** use `this.$store.dispatch('harvester/request', { url, method, headers, data })`.
- **Loading lists:** use `this.$store.dispatch('harvester/findAll', { type })`. Instancetype type ids are defined in `catalog.js` (`CLUSTER_INSTANCETYPE`, `CLUSTER_PREFERENCE`).
- **Creating resources:** use `this.$store.dispatch('harvester/create', { ...obj, type: HCI.VM })`, then `await model.save()`.
- **Routing:** use `currentRouter()` / `currentRoute()` from `pkg/harvester/utils/router`. `useRouter()` does not work in extension mode.
- **Components:** use the shell components already used across the repo: `LabeledInput` (`@components/Form/LabeledInput`), `LabeledSelect` (`@shell/components/form/LabeledSelect`), `Checkbox` (`@components/Form/Checkbox`), `AsyncButton`, `Banner`, `Loading`.
- **Styling:** use shell CSS variables only (`--border`, `--primary`, `--info`, `--muted`, `--body-bg`, `--body-text`) so light and dark themes both work. Do not add a CSS framework.
- **Provenance annotations:** use `catalog.harvesterhci.io/{instancetype,preference,image}`. Never write provenance into KubeVirt-reserved keys (`kubevirt.io/*`, `instancetype.kubevirt.io/*`) on the VM, because controllers act on those.
- **Scope:** do not modify the existing VM create/edit form (`edit/kubevirt.io.virtualmachine`) for this feature.

### Verifying changes

```bash
yarn lint:fix && yarn lint          # zero warnings required
RANCHER_ENV=harvester VUE_APP_SERVER_VERSION=v1.9.0 API=https://<harvester-vip> yarn dev   # standalone
API=https://10.144.98.13.sslip.io yarn dev                                                # Rancher mode, test both
```

Cluster-side checks after creating a VM from the catalog:

```bash
kubectl get vm <name> -n <ns> -o jsonpath='{.metadata.annotations}'                        # catalog.harvesterhci.io/* present
kubectl get vm <name> -n <ns> -o jsonpath='{.spec.template.spec.domain.cpu}{"\n"}{.spec.template.spec.domain.resources}{"\n"}'
kubectl get pod -n <ns> -l vm.kubevirt.io/name=<name> \
  -o jsonpath='{.items[0].spec.containers[?(@.name=="compute")].resources}'               # overcommit applied (e.g. cpu request 200m for 2 vCPU)
virtctl migrate <name> -n <ns>                                                            # live migration still works
```

There is no unit-test script in `package.json`. Test `catalog.js` with a throwaway Node ESM script (copy it to `.mjs`) rather than adding test tooling; adding dependencies requires asking first.

### Known gaps / backlog (in priority order)

1. **RBAC.** Non-admin users need `create` on `virtualmachines/expand-vm-spec` in the `subresources.kubevirt.io` API group, plus read access to the cluster instancetype and preference objects. Check with a namespace-scoped user.
2. **Firmware.** The catalog leaves firmware to the preference. If an image needs UEFI and its preference doesn't set it, it will fail to boot. Either set `firmware.bootloader.efi` when an image label asks for it, or rely on the `*.efi` preference variants.
3. **CDI-backed images.** The root disk template hardcodes `ReadWriteMany` + `Block`, which is correct for Longhorn backing images only. Derive the access mode and volume mode from the image's StorageClass or backend.
4. **"Customize" handoff** to the full VM form, prefilled. The existing form cannot represent instancetype refs, so the handoff must pass the *expanded* spec.
5. **i18n.** Page strings are hardcoded English. Upstream would require `l10n/en-us.yaml` keys.
6. **Icons.** The brand logos are trademarks; they need a legal check before any upstream contribution.
7. **Upstream issue (not filed yet).** Harvester should (a) accept instancetype-backed VMs in the memory validator, (b) make the `maxSockets` mutator use `add` or check that the path exists, and (c) show memory from `memory.guest` when limits are absent. Once fixed, switch to reference mode and delete `harvesterShim()`.

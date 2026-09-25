<script>
import Loading from '@shell/components/Loading';
import AsyncButton from '@shell/components/AsyncButton';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import { Checkbox } from '@components/Form/Checkbox';
import { Banner } from '@components/Banner';
import { NAMESPACE, NETWORK_ATTACHMENT } from '@shell/config/types';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI } from '../../../../types';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { ADD_ONS } from '../../../../config/harvester-map';
import { currentRouter, currentRoute } from '../../../../utils/router';
import { catalogIcon } from '../../../../utils/catalog-icons';
import {
  CLUSTER_INSTANCETYPE,
  CLUSTER_PREFERENCE,
  LABEL_DEFAULT_INSTANCETYPE,
  DEFAULT_INSTANCETYPE,
  FEATURED_SIZES,
  SERIES_LABELS,
  MANAGEMENT_NETWORK,
  isCatalogImage,
  resolvePreferenceName,
  preferenceDisplayName,
  sizeOf,
  formatGi,
  buildCatalogVm,
  expandPath,
  cleanExpanded,
  harvesterShim,
  suggestName,
} from '../../../../utils/catalog';

const NO_PREFERENCE = '__none__';
const SYSTEM_NS = /^(kube-|cattle-|fleet-|harvester-system|longhorn-system|local$|p-)/;
const DNS_1123 = /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/;

export default {
  name: 'HarvesterVmCatalog',

  components: {
    Loading, AsyncButton, LabeledSelect, LabeledInput, Checkbox, Banner
  },

  data() {
    return {
      loading:       true,
      addonEnabled:  true,
      loadErrors:    [],
      errors:        [],
      images:        [],
      preferences:   [],
      instancetypes: [],
      networks:      [],
      sshKeys:       [],
      namespaces:    [],

      distroKey:     null,
      imageId:       null,
      series:        'u1',
      showAllSizes:  false,
      instancetype:  null,
      name:          '',
      suggestedName: '',
      start:         true,
      namespace:     'default',
      network:       MANAGEMENT_NETWORK,
      sshKeyIds:     [],
      password:      '',
      diskGi:        null,
      preview:       null,
    };
  },

  async created() {
    const inStore = 'harvester';
    const load = (type) => this.$store.dispatch(`${ inStore }/findAll`, { type }).catch((err) => {
      this.loadErrors.push(`${ type }: ${ err?.message || err }`);

      return [];
    });

    const [images, prefs, types, nads, keys, ns, addons] = await Promise.all([
      load(HCI.IMAGE), load(CLUSTER_PREFERENCE), load(CLUSTER_INSTANCETYPE),
      load(NETWORK_ATTACHMENT), load(HCI.SSH), load(NAMESPACE), load(HCI.ADD_ONS),
    ]);

    const catalogAddon = (addons || []).find((a) => a.metadata?.name === ADD_ONS.VM_CATALOG);

    this.addonEnabled = catalogAddon?.spec?.enabled === true;
    this.images = images.filter(isCatalogImage);
    this.preferences = prefs;
    this.instancetypes = types;
    this.networks = nads.filter((n) => n.metadata?.labels?.['network.harvesterhci.io/type']);
    this.sshKeys = keys;
    this.namespaces = ns.map((n) => n.metadata.name).filter((n) => !SYSTEM_NS.test(n));
    this.loading = false;
  },

  computed: {
    prefByName() {
      return Object.fromEntries(this.preferences.map((p) => [p.metadata.name, p]));
    },

    // One tile per resolved preference, each holding the images that map to it.
    distros() {
      const names = Object.keys(this.prefByName);
      const groups = {};

      for (const image of this.images) {
        const pref = resolvePreferenceName(image, names) || NO_PREFERENCE;

        (groups[pref] = groups[pref] || []).push(image);
      }

      return Object.entries(groups).map(([key, images]) => {
        const pref = this.prefByName[key];
        const label = pref ? preferenceDisplayName(pref) : 'Other';

        return {
          key,
          label,
          preference: pref ? key : null,
          icon:       catalogIcon(pref?.metadata?.annotations?.iconClass),
          monogram:   label.replace(/[^A-Za-z]/g, '').slice(0, 2),
          images:     images.sort((a, b) => (a.spec.displayName || '').localeCompare(b.spec.displayName || '')),
        };
      }).sort((a, b) => (a.key === NO_PREFERENCE) - (b.key === NO_PREFERENCE) || a.label.localeCompare(b.label));
    },

    distro() {
      return this.distros.find((d) => d.key === this.distroKey) || null;
    },

    image() {
      return this.distro?.images.find((i) => i.id === this.imageId) || null;
    },

    imageOptions() {
      return (this.distro?.images || []).map((i) => ({ label: `${ i.spec.displayName } (${ i.metadata.namespace })`, value: i.id }));
    },

    minDiskGi() {
      const bytes = this.image?.status?.virtualSize || 0;

      return Math.max(1, Math.ceil(bytes / 2 ** 30));
    },

    seriesOptions() {
      const present = [...new Set(this.instancetypes.map((t) => sizeOf(t).series))];

      return present
        .sort((a, b) => (Object.keys(SERIES_LABELS).indexOf(a) + 1 || 99) - (Object.keys(SERIES_LABELS).indexOf(b) + 1 || 99))
        .map((s) => ({ value: s, label: SERIES_LABELS[s] || s }));
    },

    sizes() {
      const all = this.instancetypes.map(sizeOf).filter((s) => s.series === this.series).sort((a, b) => a.cpu - b.cpu || a.memory - b.memory);
      const featured = all.filter((s) => FEATURED_SIZES.includes(s.tier));
      const shown = this.showAllSizes || featured.length < 2 ? all : featured;
      const maxCpu = Math.max(1, ...shown.map((s) => s.cpu));
      const maxMem = Math.max(1, ...shown.map((s) => s.memory));

      // Linear scale against the largest size currently shown, so 2 vCPU is
      // exactly half of 4 vCPU. Floor at 3% so the smallest sizes stay visible.
      const pct = (v, max) => Math.max(3, Math.round((100 * v) / max));

      return shown.map((s) => ({
        ...s,
        cpuPct:   pct(s.cpu, maxCpu),
        memPct:   pct(s.memory, maxMem),
        memLabel: formatGi(s.memory),
      }));
    },

    hiddenSizeCount() {
      return this.instancetypes.map(sizeOf).filter((s) => s.series === this.series).length - this.sizes.length;
    },

    selectedSize() {
      return this.instancetypes.map(sizeOf).find((s) => s.name === this.instancetype) || null;
    },

    networkOptions() {
      return [
        { label: 'Management network', value: MANAGEMENT_NETWORK },
        ...this.networks.map((n) => ({ label: `${ n.metadata.namespace }/${ n.metadata.name }`, value: n.id })),
      ];
    },

    sshKeyOptions() {
      return this.sshKeys.map((k) => ({ label: `${ k.metadata.namespace }/${ k.metadata.name }`, value: k.id }));
    },

    nameError() {
      if (!this.name) {
        return null;
      }

      return DNS_1123.test(this.name) ? null : 'Lowercase letters, digits and dashes; must start and end with a letter or digit.';
    },

    diskError() {
      return this.diskGi && this.diskGi < this.minDiskGi ? `At least ${ this.minDiskGi } GiB (the image's virtual size).` : null;
    },

    canCreate() {
      return !!(this.image && this.instancetype && this.name && !this.nameError && this.namespace && this.diskGi && !this.diskError);
    },

    summary() {
      const parts = [];

      if (this.distro) {
        parts.push(this.distro.label);
      }
      if (this.selectedSize) {
        parts.push(`${ this.selectedSize.name } (${ this.selectedSize.cpu } vCPU, ${ formatGi(this.selectedSize.memory) })`);
      }
      if (this.diskGi) {
        parts.push(`${ this.diskGi } GiB disk`);
      }
      if (this.selectedSize) {
        parts.push(this.start ? 'starts on create' : 'stays stopped');
      }

      return parts.join(', ');
    },

    addonsLocation() {
      return {
        name:   `${ PRODUCT_NAME }-c-cluster-resource`,
        params: {
          product:  PRODUCT_NAME,
          cluster:  currentRoute().params.cluster,
          resource: HCI.ADD_ONS,
        },
      };
    },
  },

  watch: {
    distroKey() {
      const first = this.distro?.images[0];

      this.imageId = first?.id || null;

      // Only overwrite the name while it is still our own suggestion.
      if (!this.name || this.name === this.suggestedName) {
        this.suggestedName = suggestName(this.distro?.preference);
        this.name = this.suggestedName;
      }
    },

    image(image) {
      if (!image) {
        return;
      }
      this.diskGi = Math.max(this.minDiskGi, 10);

      const wanted = image.metadata?.labels?.[LABEL_DEFAULT_INSTANCETYPE];
      const exists = (n) => this.instancetypes.some((t) => t.metadata.name === n);

      if (wanted && exists(wanted)) {
        this.selectSize(wanted);
      } else if (!this.instancetype && exists(DEFAULT_INSTANCETYPE)) {
        this.selectSize(DEFAULT_INSTANCETYPE);
      }
    },

    series() {
      this.showAllSizes = false;
    },
  },

  methods: {
    selectSize(name) {
      this.instancetype = name;
      this.series = sizeOf({ metadata: { name } }).series;
      if (!FEATURED_SIZES.includes(sizeOf({ metadata: { name } }).tier)) {
        this.$nextTick(() => {
          this.showAllSizes = true;
        });
      }
    },

    buildVm() {
      const byId = (list, id) => list.find((x) => x.id === id);

      return buildCatalogVm({
        name:         this.name,
        namespace:    this.namespace,
        image:        this.image,
        instancetype: this.instancetype,
        preference:   this.distro?.preference,
        diskGi:       Number(this.diskGi),
        network:      this.network === MANAGEMENT_NETWORK ? MANAGEMENT_NETWORK : byId(this.networks, this.network),
        sshKeys:      this.sshKeyIds.map((id) => byId(this.sshKeys, id)).filter(Boolean),
        password:     this.password,
        start:        this.start,
      });
    },

    // KubeVirt does the instancetype/preference merge server-side; we never reimplement it.
    async expand(vm) {
      const path = expandPath(vm.metadata.namespace);
      const clusterUrl = this.$store.getters['harvester-common/getHarvesterClusterUrl'](path);
      const url = clusterUrl.startsWith('/') ? clusterUrl : `/${ clusterUrl }`;
      const resp = await this.$store.dispatch('harvester/request', {
        url,
        method:  'PUT',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        data:    vm,
      });

      return harvesterShim(cleanExpanded(resp));
    },

    async showPreview() {
      this.errors = [];
      try {
        const requested = this.buildVm();
        const expanded = await this.expand(requested);

        this.preview = {
          domain: JSON.stringify(expanded.spec.template.spec.domain, null, 2),
          refs:   JSON.stringify({ instancetype: requested.spec.instancetype, preference: requested.spec.preference }, null, 2),
        };
      } catch (err) {
        this.errors = exceptionToErrorsArray(err?.data || err);
      }
    },

    async create(buttonCb) {
      this.errors = [];
      try {
        const expanded = await this.expand(this.buildVm());
        const vm = await this.$store.dispatch('harvester/create', { ...expanded, type: HCI.VM });

        await vm.save();

        this.$store.dispatch('growl/success', {
          title:   'Virtual machine created',
          message: `${ this.namespace }/${ this.name } from ${ this.instancetype }`,
        });
        buttonCb(true);

        currentRouter().push({
          name:   `${ PRODUCT_NAME }-c-cluster-resource-namespace-id`,
          params: {
            product: PRODUCT_NAME, cluster: currentRoute().params.cluster, resource: HCI.VM, namespace: this.namespace, id: this.name
          },
        });
      } catch (err) {
        this.errors = exceptionToErrorsArray(err?.data || err);
        buttonCb(false);
      }
    },
  },
};
</script>

<template>
  <Loading v-if="loading" />
  <div
    v-else-if="!addonEnabled"
    class="vm-catalog"
  >
    <header class="vm-catalog__header">
      <h1>Catalog</h1>
    </header>

    <Banner color="warning">
      The VM Catalog add-on is disabled. Enable it under
      <router-link :to="addonsLocation">
        Advanced &gt; Addons
      </router-link>.
    </Banner>
  </div>
  <div
    v-else
    class="vm-catalog"
  >
    <header class="vm-catalog__header">
      <h1>Catalog</h1>
      <p class="text-muted">
        Pick an operating system and a size, then fill in the details. Sizes and OS defaults come from the cluster's KubeVirt instance types and preferences.
      </p>
    </header>

    <Banner
      v-for="(e, i) in loadErrors"
      :key="`load-${i}`"
      color="warning"
      :label="`Could not load ${e}`"
    />

    <!-- 1. Operating system -->
    <section class="vm-catalog__step">
      <h2><span class="vm-catalog__num">1</span>Operating system</h2>

      <p
        v-if="!distros.length"
        class="text-muted"
      >
        No bootable disk images yet. Upload a qcow2 or raw image under Images and it will show up here.
      </p>

      <div
        class="distro-grid"
        role="radiogroup"
        aria-label="Operating system"
      >
        <button
          v-for="d in distros"
          :key="d.key"
          type="button"
          role="radio"
          class="distro"
          :class="{ 'is-selected': d.key === distroKey }"
          :aria-checked="d.key === distroKey"
          @click="distroKey = d.key"
        >
          <svg
            v-if="d.icon"
            class="distro__glyph"
            viewBox="0 0 24 24"
            aria-hidden="true"
            :style="{ color: d.icon.color || 'var(--body-text)' }"
          ><path
            :d="d.icon.path"
            fill="currentColor"
          /></svg>
          <span
            v-else
            class="distro__monogram"
            aria-hidden="true"
          >{{ d.monogram }}</span>
          <span class="distro__name">{{ d.label }}</span>
          <span class="distro__meta">{{ d.images.length }} {{ d.images.length === 1 ? 'image' : 'images' }}<template v-if="d.preference">, preference {{ d.preference }}</template></span>
        </button>
      </div>

      <div
        v-if="distro && distro.images.length > 1"
        class="vm-catalog__narrow mt-15"
      >
        <LabeledSelect
          v-model:value="imageId"
          label="Image"
          :options="imageOptions"
        />
      </div>
    </section>

    <!-- 2. Size -->
    <section
      class="vm-catalog__step"
      :class="{ 'is-waiting': !image }"
    >
      <h2><span class="vm-catalog__num">2</span>Size</h2>

      <div
        class="series"
        role="tablist"
        aria-label="Instance type series"
      >
        <button
          v-for="s in seriesOptions"
          :key="s.value"
          type="button"
          role="tab"
          class="series__tab"
          :class="{ 'is-selected': s.value === series }"
          :aria-selected="s.value === series"
          @click="series = s.value"
        >
          <span>{{ s.label }}</span>
          <span
            v-if="s.label !== s.value"
            class="series__code"
          >{{ s.value }}</span>
        </button>
      </div>

      <div
        class="size-grid"
        role="radiogroup"
        aria-label="Size"
      >
        <button
          v-for="s in sizes"
          :key="s.name"
          type="button"
          role="radio"
          class="size"
          :class="{ 'is-selected': s.name === instancetype }"
          :aria-checked="s.name === instancetype"
          @click="selectSize(s.name)"
        >
          <span class="size__tier">{{ s.tier }}</span>
          <span class="size__row">
            <span class="size__value">{{ s.cpu }}</span><span class="size__unit">vCPU</span>
            <span class="size__bar"><span :style="{ width: `${s.cpuPct}%` }" /></span>
          </span>
          <span class="size__row">
            <span class="size__value">{{ s.memLabel.replace(' GiB', '') }}</span><span class="size__unit">GiB</span>
            <span class="size__bar size__bar--mem"><span :style="{ width: `${s.memPct}%` }" /></span>
          </span>
          <span class="size__name">{{ s.name }}</span>
        </button>
      </div>

      <button
        v-if="hiddenSizeCount > 0 || showAllSizes"
        type="button"
        class="btn btn-sm role-link mt-10"
        @click="showAllSizes = !showAllSizes"
      >
        {{ showAllSizes ? 'Show common sizes' : `Show all sizes (${hiddenSizeCount} more)` }}
      </button>
    </section>

    <!-- 3. Details -->
    <section
      class="vm-catalog__step"
      :class="{ 'is-waiting': !image || !instancetype }"
    >
      <h2><span class="vm-catalog__num">3</span>Details</h2>
      <div class="details">
        <LabeledInput
          v-model:value="name"
          label="Name"
          required
          :status="nameError ? 'error' : null"
          :sub-label="nameError"
        />
        <LabeledSelect
          v-model:value="namespace"
          label="Namespace"
          :options="namespaces"
          :taggable="true"
          :searchable="true"
        />
        <LabeledSelect
          v-model:value="network"
          label="Network"
          :options="networkOptions"
        />
        <LabeledInput
          v-model:value.number="diskGi"
          label="Root disk"
          type="number"
          suffix="GiB"
          :min="minDiskGi"
          :status="diskError ? 'error' : null"
          :sub-label="diskError"
        />
        <LabeledSelect
          v-model:value="sshKeyIds"
          label="SSH keys"
          :options="sshKeyOptions"
          :multiple="true"
        />
        <LabeledInput
          v-model:value="password"
          label="Console password"
          type="password"
          sub-label="Optional. Set through cloud-init."
        />
        <Checkbox
          v-model:value="start"
          label="Start after creation"
          class="details__full"
        />
      </div>
    </section>

    <Banner
      v-for="(e, i) in errors"
      :key="`err-${i}`"
      color="error"
      :label="e"
    />

    <section
      v-if="preview"
      class="preview"
    >
      <div>
        <h3>You ask for</h3>
        <pre>{{ preview.refs }}</pre>
      </div>
      <div>
        <h3>KubeVirt expands to</h3>
        <pre>{{ preview.domain }}</pre>
      </div>
    </section>

    <footer class="vm-catalog__footer">
      <span class="vm-catalog__summary">{{ summary || 'Nothing selected yet' }}</span>
      <button
        type="button"
        class="btn role-secondary"
        :disabled="!canCreate"
        @click="showPreview"
      >
        Preview spec
      </button>
      <AsyncButton
        mode="create"
        :disabled="!canCreate"
        @click="create"
      />
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.vm-catalog {
  max-width: 1200px;
  padding-bottom: 80px;

  &__header p { max-width: 70ch; }

  &__step {
    margin-top: 32px;
    transition: opacity 0.2s;

    &.is-waiting { opacity: 0.5; }

    h2 {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
  }

  &__num {
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid var(--border);
    font-size: 14px;
  }

  &__narrow { max-width: 480px; }

  &__footer {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 32px;
    padding: 12px 0;
    background: var(--body-bg);
    border-top: 1px solid var(--border);
  }

  &__summary {
    flex: 1;
    color: var(--muted);
  }
}

// Shell global <button> styles center content, force nowrap and a fixed
// line-height; tiles need the opposite, so reset them explicitly.
button.distro,
button.size,
button.series__tab {
  appearance: none;
  height: auto;
  min-height: 0;
  margin: 0;
  font: inherit;
  line-height: 1.3;
  color: inherit;
  text-align: left;
  white-space: normal;
  justify-content: flex-start;
  background: var(--body-bg);
  border: 1px solid var(--border);
  cursor: pointer;

  &:hover { border-color: var(--primary); }
  &:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

  &.is-selected {
    border-color: var(--primary);
    box-shadow: inset 0 0 0 1px var(--primary);
  }
}

.distro-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 12px;
}

.distro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  padding: 18px 16px 14px;
  border-radius: 6px;

  &__glyph,
  &__monogram {
    width: 40px;
    height: 40px;
    margin-bottom: 6px;
  }

  &__monogram {
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: var(--border);
    font-weight: 600;
  }

  &__name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__meta { font-size: 12px; color: var(--muted); }
}

.series {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;

  &__tab {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 16px;
  }

  &__code {
    font-size: 12px;
    color: var(--muted);
  }
}

.size-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}

.size {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  min-width: 0;
  padding: 16px;
  border-radius: 6px;

  &__tier {
    font-size: 20px;
    font-weight: 600;
    text-transform: capitalize;
  }

  // Fixed value/unit columns so both bars start at the same x in every tile;
  // otherwise "16 GiB" and "4 vCPU" shift the bar start and fake the proportions.
  &__row {
    display: grid;
    grid-template-columns: 2.6em 3em 1fr;
    align-items: baseline;
    gap: 6px;
  }

  &__value {
    font-size: 18px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  &__unit { font-size: 12px; color: var(--muted); }

  &__bar {
    align-self: center;
    height: 6px;
    border-radius: 3px;
    background: var(--border);
    overflow: hidden;

    span {
      display: block;
      height: 100%;
      background: var(--primary);
    }

    &--mem span { background: var(--info); }
  }

  &__name { font-size: 12px; color: var(--muted); }
}

.details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 20px;
  max-width: 900px;

  &__full { grid-column: 1 / -1; }

  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

.preview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 16px;
  margin-top: 24px;

  pre {
    max-height: 360px;
    overflow: auto;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
  }

  @media (max-width: 700px) { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .vm-catalog__step { transition: none; }
}
</style>

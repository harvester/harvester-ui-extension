import { FORKLIFT_API_VERSION } from '../config/harvester-map';

/**
 * Shared mixin for Forklift edit pages that need to select
 * source and destination providers from available Provider CRs.
 *
 * Components using this mixin must load providers in their own fetch():
 *   this.allProviders = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PROVIDER });
 */
export default {
  data() {
    return { allProviders: [] };
  },

  computed: {
    providerOptions() {
      return this.allProviders.map((p) => ({
        label: `${ p.metadata.name } (${ p.spec?.type || 'unknown' })`,
        value: p.metadata.name,
      }));
    },
  },

  methods: {
    /**
     * Build a Forklift object reference for a Provider.
     */
    buildProviderRef(name) {
      const provider = this.allProviders.find((p) => p.metadata.name === name);

      return {
        apiVersion: FORKLIFT_API_VERSION,
        kind:       'Provider',
        name,
        namespace:  provider?.metadata?.namespace || this.value.metadata.namespace || 'default',
      };
    },

    updateSourceProvider(val) {
      this.value.spec.provider.source = this.buildProviderRef(val);
    },

    updateDestProvider(val) {
      this.value.spec.provider.destination = this.buildProviderRef(val);
    },
  },
};

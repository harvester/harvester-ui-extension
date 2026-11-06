import { LONGHORN } from '@shell/config/types';

/**
 * Lazily loads the Longhorn resources needed for VM clone progress.
 *
 * Longhorn volumes are only fetched once a VM has volumes populated by a Longhorn clone, and engines
 * (whose status changes frequently) only while a clone copy or replica rebuild is in progress. Both are
 * then kept up to date by the Steve websocket, so progress moves without any polling and pages
 * with no clone in flight don't watch either type.
 *
 * Components using this mixin must provide a `cloneProgressVMs` computed returning the VMs to track.
 */
export default {
  data() {
    return {
      cloneProgressLoaded: {
        [LONGHORN.VOLUMES]: false,
        [LONGHORN.ENGINES]: false,
      }
    };
  },

  computed: {
    needLonghornVolumesForClone() {
      return (this.cloneProgressVMs || []).some((vm) => vm.hasPendingLonghornClone);
    },

    needLonghornEnginesForClone() {
      return (this.cloneProgressVMs || []).some((vm) => vm.isCloningVolumes);
    },
  },

  watch: {
    needLonghornVolumesForClone: {
      handler(neu) {
        if (neu) {
          this.loadCloneProgressType(LONGHORN.VOLUMES);
        }
      },
      immediate: true,
    },

    needLonghornEnginesForClone: {
      handler(neu) {
        if (neu) {
          this.loadCloneProgressType(LONGHORN.ENGINES);
        }
      },
      immediate: true,
    },
  },

  methods: {
    loadCloneProgressType(type) {
      const inStore = this.$store.getters['currentProduct'].inStore;

      if (this.cloneProgressLoaded[type] || !this.$store.getters[`${ inStore }/schemaFor`](type)) {
        return;
      }

      this.cloneProgressLoaded[type] = true;
      this.$store.dispatch(`${ inStore }/findAll`, { type }).catch(() => {
        this.cloneProgressLoaded[type] = false;
      });
    },
  },
};

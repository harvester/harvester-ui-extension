<script>
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { HCI } from '../../types';
import { DOC } from '../../config/doc-links';

export const hugepagesTHPEnabledMode = [{
  label: 'Always',
  value: 'always',
}, {
  label: 'Madvise',
  value: 'madvise',
}, {
  label: 'Never',
  value: 'never',
}];

export const hugepagesTHPShmemEnabledMode = [{
  label: 'Always',
  value: 'always',
}, {
  label: 'Within Size',
  value: 'within_size',
}, {
  label: 'Advise',
  value: 'advise',
}, {
  label: 'Never',
  value: 'never',
}, {
  label: 'Deny',
  value: 'deny',
}, {
  label: 'Force',
  value: 'force',
}];

export const hugepagesTHPDefragMode = [{
  label: 'Always',
  value: 'always',
}, {
  label: 'Defer',
  value: 'defer',
}, {
  label: 'Defer+Madvise',
  value: 'defer+madvise',
}, {
  label: 'Madvise',
  value: 'madvise',
}, {
  label: 'Never',
  value: 'never'
}];

export default {
  name:       'HarvesterHugepages',
  components: { LabeledSelect },

  props: {
    node: {
      type:     Object,
      required: true,
    },

    registerBeforeHook: {
      type:     Function,
      required: true,
    },
  },

  computed: {
    docsTransparentHugepagesLink() {
      return DOC.TRANSPARENT_HUGEPAGES;
    },
  },

  methods: {
    async saveHugepages() {
      this.hugepages['spec'] = this.spec;

      await this.hugepages.save().catch((reason) => {
        if (reason?.type === 'error') {
          this.$store.dispatch('growl/error', {
            title:   this.t('harvester.notification.title.error'),
            message: reason?.message,
          }, { root: true });

          return Promise.reject(new Error('saveHugepages error'));
        }
      });
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    const hash = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.HUGEPAGES });

    this.hugepages = hash.find((node) => {
      return node.id === this.node.id;
    });
    this.spec = this.hugepages.spec;
  },

  data() {
    return {
      hugepages: {},
      spec:      { transparent: {} },
      hugepagesTHPEnabledMode,
      hugepagesTHPShmemEnabledMode,
      hugepagesTHPDefragMode,
    };
  },

  created() {
    this.registerBeforeHook(this.saveHugepages, 'saveHugepages');
  },
};
</script>

<template>
  <div>
    <div>
      <hr class="divider" />
      <h3>
        <t
          k="harvester.host.hugepages.transparent.title"
          :raw="true"
          :url="docsTransparentHugepagesLink"
        />
      </h3>

      <div class="row mb-20">
        <div class="col span-4">
          <LabeledSelect
            v-model:value="spec.transparent.enabled"
            :label="t('harvester.host.hugepages.transparent.enabled')"
            :options="hugepagesTHPEnabledMode"
          />
        </div>
        <div class="col span-4">
          <LabeledSelect
            v-model:value="spec.transparent.shmemEnabled"
            :label="t('harvester.host.hugepages.transparent.shmemEnabled')"
            :options="hugepagesTHPShmemEnabledMode"
          />
        </div>
        <div class="col span-4">
          <LabeledSelect
            v-model:value="spec.transparent.defrag"
            :label="t('harvester.host.hugepages.transparent.defrag')"
            :options="hugepagesTHPDefragMode"
          />
        </div>
      </div>
    </div>
  </div>
</template>

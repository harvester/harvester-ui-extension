<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import { LOGGING, SCHEMA } from '@shell/config/types';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import Labels from '@shell/components/form/Labels';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { Banner } from '@components/Banner';
import { PROVIDERS } from '@shell/models/logging.banzaicloud.io.output';
import { _VIEW } from '@shell/config/query-params';
import { clone, set } from '@shell/utils/object';
import isEqual from 'lodash/isEqual';
import isEmpty from 'lodash/isEmpty';
import jsyaml from 'js-yaml';
import { createYaml } from '@shell/utils/create-yaml';
import YamlEditor, { EDITOR_MODES } from '@shell/components/YamlEditor';
import { FLOW_TYPE } from '../config/harvester-map';

const LOGGING_EVENT = 'Logging/Event';
const AUDIT_ONLY = 'Audit Only';
const OUTPUT_TYPE = [LOGGING_EVENT, AUDIT_ONLY];

export default {
  emits: ['update:value'],

  components: {
    Banner, CruResource, Labels, LabeledSelect, NameNsDescription, Tab, Tabbed, YamlEditor
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  async fetch() {
    const schemas = this.$store.getters['harvester/all'](SCHEMA);

    const resourceSchema = this.$store.getters['harvester/byId'](SCHEMA, LOGGING.OUTPUT);

    const schemaDefinition = await resourceSchema.fetchResourceFields();

    let bufferYaml = '';

    if ( !isEmpty(this.value.spec[this.selectedProvider]?.buffer) ) {
      bufferYaml = jsyaml.dump(this.value.spec[this.selectedProvider].buffer);
    } else if (schemaDefinition) {
      bufferYaml = createYaml(
        schemas,
        `io.banzaicloud.logging.v1beta1.Output.spec.${ this.selectedProvider }.buffer`,
        {},
        true,
        1,
        '',
        LOGGING.OUTPUT
      );

      // createYaml doesn't support passing reference types (array, map) as the first type. As such
      // I'm manipulating the output since I'm not sure it's something we want to actually support
      // seeing as it's really createResourceYaml and this here is a gray area between spoofed types
      // and just a field within a spec.
      bufferYaml = bufferYaml.substring(bufferYaml.indexOf('\n') + 1).replace(/# {2}/g, '#');
    }

    if (bufferYaml.length) {
      this.bufferYaml = bufferYaml;
      this.initialBufferYaml = bufferYaml;

      this.$refs.yaml.updateValue(this.bufferYaml);
    }
  },

  data() {
    if (this.isCreate) {
      this.value.metadata.namespace = 'default';
    }
    set(this.value, 'spec', this.value.spec || {});

    const providers = PROVIDERS.map((provider) => ({
      ...provider,
      value: provider.name,
      label: this.t(provider.labelKey)
    }));

    const selectedProviders = providers.filter((provider) => {
      const specProvider = this.value.spec[provider.name];
      const correctedSpecProvider = provider.name === 'forward' ? specProvider?.servers?.[0] || {} : specProvider;

      return !isEmpty(correctedSpecProvider) && !isEqual(correctedSpecProvider, provider.default);
    });

    const selectedProvider = selectedProviders?.[0]?.value || providers[0].value; // selected provider name
    const selectedProviderDefault = providers.find((p) => p.name === selectedProvider)?.default || providers[0].default;

    if (this.mode !== _VIEW) {
      set(this.value.spec, selectedProvider, this.value.spec[selectedProvider] || clone(selectedProviderDefault));
    }

    return {
      bufferYaml:                   '',
      initialBufferYaml:            '',
      providers,
      selectedProvider,
      hasMultipleProvidersSelected: selectedProviders.length > 1,
      selectedProviders,
      LOGGING,
      loggingType:                  this.value.loggingType !== FLOW_TYPE.AUDIT ? LOGGING_EVENT : AUDIT_ONLY
    };
  },

  computed: {
    EDITOR_MODES() {
      return EDITOR_MODES;
    },
    enabledProviders() {
      return this.providers.filter((p) => p.enabled);
    },
    cruMode() {
      if (this.selectedProviders.length > 1 || !this.value.allProvidersSupported) {
        return _VIEW;
      }

      return this.mode;
    },
    outputTypeOptions() {
      return OUTPUT_TYPE;
    },
    outputProvider: {
      get() {
        return this.selectedProvider;
      },

      set(newProvider) {
        this.selectedProvider = newProvider;
        const providerDefaultSpec = this.providers.find((p) => p.name === newProvider)?.default || {};

        this.value.spec = { [newProvider]: this.value.spec[newProvider] || clone(providerDefaultSpec) };
      }
    },
  },

  created() {
    this.registerBeforeHook(this.willSave, 'willSave');
  },
  methods: {
    getComponent(name) {
      return require(`@shell/edit/logging.banzaicloud.io.output/providers/${ name }`).default;
    },
    launch(provider) {
      this.$refs.tabbed.select(provider.name);
    },
    willSave() {
      const bufferJson = jsyaml.load(this.bufferYaml);

      if (!isEmpty(bufferJson)) {
        this.value.spec[this.selectedProvider].buffer = bufferJson;
      } else {
        delete this.value.spec[this.selectedProvider]['buffer'];
      }

      if (this.loggingType === AUDIT_ONLY) {
        this.value.spec['loggingRef'] = 'harvester-kube-audit-log-ref';
      }
    },
    tabChanged({ tab }) {
      if ( tab.name === 'buffer' ) {
        this.$nextTick(() => {
          if ( this.$refs.yaml ) {
            this.$refs.yaml.refresh();
            this.$refs.yaml.focus();
          }
        });
      }
    },
    onYamlEditorReady(cm) {
      cm.getMode().fold = 'yamlcomments';
      cm.execCommand('foldAll');
      cm.execCommand('unfold');
    },
  }
};
</script>

<template>
  <div class="output">
    <CruResource
      :done-route="doneRoute"
      :mode="cruMode"
      :resource="value"
      :subtypes="[]"
      :validation-passed="true"
      :errors="errors"
      :can-yaml="true"
      @error="e=>errors=e"
      @finish="save"
      @cancel="done"
    >
      <NameNsDescription
        v-if="!isView"
        :value="value"
        :mode="mode"
        label="generic.name"
        :register-before-hook="registerBeforeHook"
        :namespaced="value.type !== LOGGING.CLUSTER_OUTPUT"
        @update:value="$emit('update:value', $event)"
      />
      <Banner
        v-if="selectedProviders.length > 1"
        color="info"
      >
        {{ t('logging.output.tips.singleProvider') }}
      </Banner>
      <Banner
        v-else-if="!value.allProvidersSupported"
        color="info"
      >
        {{ t('logging.output.tips.multipleProviders') }}
      </Banner>
      <Tabbed
        v-else
        ref="tabbed"
        :side-tabs="true"
        @changed="tabChanged($event)"
      >
        <Tab
          name="Output"
          label="Output"
          :weight="2"
        >
          <div class="row">
            <div class="col span-6">
              <LabeledSelect
                v-model:value="loggingType"
                class="mb-20"
                :options="outputTypeOptions"
                :disabled="!isCreate"
                :mode="mode"
                :label="t('generic.type')"
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-6">
              <LabeledSelect
                v-model:value="outputProvider"
                label="Output"
                :options="providers"
                :mode="mode"
              />
            </div>
          </div>
          <div class="spacer"></div>
          <component
            :is="getComponent(selectedProvider)"
            :value="value.spec[selectedProvider]"
            :namespace="value.namespace"
            :mode="mode"
          />
        </Tab>
        <Tab
          name="buffer"
          :label="t('logging.output.buffer.label')"
          :weight="1"
        >
          <YamlEditor
            ref="yaml"
            v-model:value="bufferYaml"
            :scrolling="false"
            :initial-yaml-values="initialBufferYaml"
            :editor-mode="isView ? EDITOR_MODES.VIEW_CODE : EDITOR_MODES.EDIT_CODE"
            @onReady="onYamlEditorReady"
          />
        </Tab>
        <Tab
          v-if="!isView"
          name="labels-and-annotations"
          label-key="generic.labelsAndAnnotations"
          :weight="0"
        >
          <Labels
            default-container-class="labels-and-annotations-container"
            :value="value"
            :mode="mode"
            :display-side-by-side="false"
          />
        </Tab>
      </Tabbed>
    </CruResource>
  </div>
</template>

<style lang="scss">
  $chart: 110px;
  $side: 15px;
  $margin: 10px;
  $logo: 60px;

.output {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  .provider {
    h1 {
      display: inline-block;
    }
  }

  .box-container {
    display: flex;
    justify-content: flex-start;
    flex-wrap: wrap;
    margin: 0 -1*$margin;

    @media only screen and (min-width: map-get($breakpoints, '--viewport-4')) {
      .toggle-gradient-box {
        width: 100%;
      }
    }
    @media only screen and (min-width: map-get($breakpoints, '--viewport-7')) {
      .toggle-gradient-box {
        width: calc(50% - 2 * #{$margin});
      }
    }
    @media only screen and (min-width: map-get($breakpoints, '--viewport-9')) {
      .toggle-gradient-box {
        width: calc(33.33333% - 2 * #{$margin});
      }
    }
    @media only screen and (min-width: map-get($breakpoints, '--viewport-12')) {
      .toggle-gradient-box {
        width: calc(25% - 2 * #{$margin});
      }
    }

    .toggle-gradient-box {
      margin: $margin;
      padding: $margin;
      position: relative;
      border-radius: calc( 1.5 * var(--border-radius));

      &:hover {
        box-shadow: 0 0 30px var(--shadow);
        transition: box-shadow 0.1s ease-in-out;
        cursor: pointer;
      }

      .side-label {
        transform: rotate(180deg);
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        min-width: calc(1.5 * var(--border-radius));
        width: $side;
        border-top-right-radius: calc( 1.5 * var(--border-radius));
        border-bottom-right-radius: calc( 1.5 * var(--border-radius));

        label {
          text-align: center;
          writing-mode: tb;
          height: 100%;
          padding: 0 2px;
          display: block;
          white-space: no-wrap;
          text-overflow: ellipsis;
        }
      }

      .logo {
        text-align: center;
        width: $logo;
        height: $logo;
        border-radius: calc(2 * var(--border-radius));
        overflow: hidden;
        background-color: white;
        display: inline-block;
        vertical-align: middle;

        img {
          width: $logo - 4px;
          height: $logo - 4px;
          object-fit: contain;
          position: relative;
          top: 2px;
        }
      }

      &:hover {
        background-position: right center;
      }

      .name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 0;
        display: inline-block;
        vertical-align: middle;
      }
    }
  }
}
</style>

<script>
import { mapGetters } from 'vuex';
import { Banner } from '@components/Banner';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import YamlEditor, { EDITOR_MODES } from '@shell/components/YamlEditor';
import ModalWithCard from '@shell/components/ModalWithCard';
import { SECRET } from '@shell/config/types';

const _AUTOUNATTENDXML = 'autounattend.xml';
const _NEW = '_NEW';

export default {
  name: 'VirtualMachineWindowsSysprep',

  components: {
    Banner,
    LabeledInput,
    LabeledSelect,
    ModalWithCard,
    YamlEditor,
  },

  props: {
    mode: {
      type:    String,
      default: 'create',
    },
    namespace: {
      type:     String,
      required: true,
    },
    value: {
      type:    Object,
      default: () => ({
        secretName: '',
        xmlContent: '',
      }),
    },
  },

  data() {
    return {
      secretOptions:  [],
      errors:         [],
      secretName:     '',
      xmlContent:     '',
      newSecretName:  '',
      newXmlContent:  '',
      isOpen:         false,
    };
  },

  async fetch() {
    await this.loadSecretsOptions();
  },

  mounted() {
    // Force the loading of the XML content.
    this.secretName = this.value?.secretName || '';
  },

  watch: {
    secretName() {
      if (this.secretName === _NEW) {
        this.isOpen = true;

        return;
      }

      // Load the content from the given secret, or set empty value.
      this.xmlContent = this.secretName === '' ? '' : this.loadXmlContentFromSecret(this.secretName);

      // Update the editor form field.
      this.updateValue();

      // Update the property.
      this.update();
    },

    xmlContent() {
      this.update();
    }
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    editorMode() {
      return this.mode === 'view' ? EDITOR_MODES.VIEW_CODE : EDITOR_MODES.EDIT_CODE;
    },

    isView() {
      return this.mode === 'view';
    },

    xmlContentValidationError() {
      return this.validateXmlContent(this.xmlContent);
    },
  },

  methods: {
    update() {
      this.$emit('update:value', {
        secretName: this.secretName,
        xmlContent: this.xmlContent,
      });
    },

    updateValue() {
      this.$refs?.xmlEditor?.updateValue?.(this.xmlContent);
    },

    refresh() {
      this.$refs?.xmlEditor?.refresh?.();
    },

    cancel() {
      if (this.secretName === _NEW) {
        this.secretName = '';
      }
      this.newSecretName = '';
      this.newXmlContent = '';
      this.errors = [];
      this.isOpen = false;
    },

    async loadSecretsOptions() {
      const secrets = await this.$store.dispatch('harvester/findAll', { type: SECRET });

      const templates = secrets
        .filter(
          (s) => s.metadata?.namespace === this.namespace &&
            s.decodedData?.[_AUTOUNATTENDXML]
        )
        .map((s) => ({
          label: s.metadata.name,
          value: `${ s.metadata.namespace }/${ s.metadata.name }`,
        }));

      this.secretOptions = [
        {
          label: this.t('generic.none'),
          value: '',
        },
        {
          label: this.t('harvester.virtualMachine.sysprep.createNew'),
          value: _NEW,
        },
        ...templates,
      ];
    },

    async save(buttonCb) {
      this.errors = [];

      if (!this.newSecretName?.trim()) {
        this.errors.push(this.t('validation.required', { key: this.t('harvester.virtualMachine.input.name') }, true));
        buttonCb(false);

        return;
      }

      if (!this.newXmlContent?.trim()) {
        this.errors.push(this.t('validation.required', { key: this.t('harvester.virtualMachine.sysprep.xmlContent') }, true));
        buttonCb(false);

        return;
      }

      const xmlError = this.validateXmlContent(this.newXmlContent);

      if (xmlError) {
        this.errors.push(xmlError);
        buttonCb(false);

        return;
      }

      try {
        const secret = await this.$store.dispatch('harvester/create', {
          type:     SECRET,
          metadata: {
            name:      this.newSecretName,
            namespace: this.namespace,
          },
        });

        secret.setData(_AUTOUNATTENDXML, this.newXmlContent);
        const res = await secret.save();

        if (res?.metadata?.name) {
          await this.loadSecretsOptions();
          this.secretName = `${ this.namespace }/${ res.metadata.name }`;
        }

        buttonCb(true);
        this.cancel();
      } catch (err) {
        this.errors = [err.message];
        buttonCb(false);
      }
    },

    validateXmlContent(content) {
      if (!content?.trim()) {
        return null;
      }

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');
        const parseError = doc.querySelector('parsererror');

        if (parseError) {
          return this.t('harvester.virtualMachine.sysprep.validation.invalidXml');
        }

        // See https://learn.microsoft.com/en-us/windows-hardware/drivers/gpiobtn/implement-the-unattended-windows-setup-setting
        if (doc.documentElement.namespaceURI !== 'urn:schemas-microsoft-com:unattend') {
          return this.t('harvester.virtualMachine.sysprep.validation.invalidNamespace');
        }

        return null;
      } catch (e) {
        return e.message;
      }
    },

    loadXmlContentFromSecret(id) {
      const secret = this.$store.getters['harvester/byId'](SECRET, id);

      return secret?.decodedData?.[_AUTOUNATTENDXML] || '';
    }
  },
};
</script>

<template>
  <div>
    <h2 v-if="!isView">
      {{ t('harvester.virtualMachine.sysprep.title') }}
    </h2>
    <p
      v-if="!isView"
      class="text-muted mb-20"
    >
      <t
        k="harvester.virtualMachine.sysprep.description"
        :raw="true"
      />
    </p>

    <!-- Secret Selection -->
    <div class="row mb-20">
      <div class="col span-12">
        <LabeledSelect
          v-model:value="secretName"
          :options="secretOptions"
          :label="t('harvester.virtualMachine.sysprep.secret.label')"
          :mode="mode"
        />
      </div>
    </div>

    <!-- XML Editor -->
    <div class="mb-20">
      <Banner
        v-if="xmlContentValidationError"
        color="error"
        class="mb-10"
      >
        <i class="icon icon-error" />
        {{ xmlContentValidationError }}
      </Banner>

      <div class="resource-xml">
        <YamlEditor
          ref="xmlEditor"
          v-model:value="xmlContent"
          :editor-mode="editorMode"
          class="xml-editor"
        />
      </div>
    </div>

    <ModalWithCard
      v-if="isOpen"
      name="createSysprepSecret"
      width="40%"
      :errors="errors"
      @finish="save"
      @close="cancel"
    >
      <template #title>
        {{ t('harvester.virtualMachine.sysprep.createNewTitle') }}
      </template>

      <template #content>
        <LabeledInput
          v-model:value="newSecretName"
          :label="t('harvester.virtualMachine.input.name')"
          class="mb-20"
          required
          @keydown.native.enter.prevent="()=>{}"
        />

        <div class="xml">
          <div class="resource-xml">
            <YamlEditor
              ref="createTemplate"
              v-model:value="newXmlContent"
              :editor-mode="editorMode"
              class="xml-editor"
            />
          </div>
        </div>
      </template>
    </ModalWithCard>
  </div>
</template>

<style lang="scss" scoped>
$xml-height: 350px;

:deep() .resource-xml {
  flex: 1;
  display: flex;
  flex-direction: column;

  & .xml-editor {
    flex: 1;
    min-height: $xml-height;
    font-family: monospace;

    & .code-mirror .CodeMirror {
      min-height: $xml-height;
    }
  }
}

.xml {
  height: $xml-height;
  overflow: auto;
}
</style>

<script>
import { mapState, mapGetters } from 'vuex';
import { isEmpty } from '@shell/utils/object';
import Parse from 'url-parse';
import { resourceNames } from '@shell/utils/string';
import { HCI } from '../types';
import { alternateLabel as alternateLabelButton } from '@shell/utils/platform';
import { Banner } from '@components/Banner';

export default {
  name: 'HarvesterPromptRemove',

  components: { Banner },

  props: {
    value: {
      type:    Array,
      default: () => {
        return [];
      }
    },
    names: {
      type:    Array,
      default: () => {
        return [];
      }
    },
    type: {
      type:     String,
      required: true
    },
    close: {
      type:     Function,
      required: true
    },
    doneLocation: {
      type:    Object,
      default: () => {}
    }
  },

  data() {
    return {
      checkedList:    [],
      checkAll:       true,
      alternateLabel: alternateLabelButton
    };
  },

  computed: {
    ...mapState('action-menu', ['toRemove']),
    ...mapGetters({ t: 'i18n/t' }),

    protectedVMs() {
      return this.value.filter((resource) => resource.type === HCI.VM && resource.preventDeletionMessage);
    },

    protectedVMNames() {
      return this.protectedVMs.map((vm) => vm.nameDisplay).join(', ');
    },

    removeNameArr() {
      const out = {};

      this.value.forEach((crd) => {
        if (crd.type !== HCI.VM) {
          return;
        }
        const volumes = crd.spec.template.spec?.volumes || [];
        const names = volumes.filter((volume) => volume.persistentVolumeClaim ).map((volume) => {
          if (volume.persistentVolumeClaim) {
            return volume.name;
          }
        });

        out[crd.id] = names;
      });

      return out;
    },
  },

  watch: {
    removeNameArr: {
      handler(neu) {
        if (this.value.length === 1) {
          const keys = Object.values(neu[this.value[0].id]);

          this.checkedList.unshift(keys[0]);
        }
      },
      deep:      true,
      immediate: true
    }
  },

  methods: {
    resourceNames,
    remove() {
      let goTo;

      // The shell disables the Delete button for protected VMs; the server
      // refuses the delete too. Stop here so we don't send doomed requests.
      if (this.protectedVMs.length) {
        this.$emit('errors', this.t('harvester.virtualMachine.deleteProtection.preventDeleteMany', { names: this.protectedVMNames }));

        return Promise.reject(new Error('delete protection'));
      }

      if (this.doneLocation) {
        // doneLocation will recompute to undefined when delete request completes
        goTo = { ...this.doneLocation };
      }

      Promise.all(this.value.map((resource) => {
        if (resource.type !== HCI.VM) { // maybe is VMI
          resource.remove();

          return;
        }

        let removedDisks = '';

        if (this.value.length > 1) {
          if (this.checkAll) {
            this.removeNameArr[resource.id].forEach((item) => {
              removedDisks += `removedDisks=${ item }&`;
            });
          }
        } else {
          this.checkedList.forEach((item) => {
            removedDisks += `removedDisks=${ item }&`;
          });
          removedDisks.replace(/&$/, '');
        }

        const parsed = Parse(resource.links.self);

        resource.remove({ url: `${ parsed.pathname }?${ removedDisks }propagationPolicy=Foreground` });
      })).then((_results) => {
        if ( goTo && !isEmpty(goTo) ) {
          this.value?.[0]?.currentRouter().push(goTo);
        }
        this.close();
        this.$store.commit('action-menu/togglePromptModal', { performCallback: true, clearTableSelection: true });
      }).catch((err) => {
        this.$emit('errors', err);
      });
    }
  }
};
</script>

<template>
  <div>
    <Banner
      v-if="protectedVMs.length"
      color="error"
      data-testid="vm-delete-protection-banner"
      :label="t('harvester.virtualMachine.deleteProtection.preventDeleteMany', { names: protectedVMNames })"
    />
    <div class="mt-10">
      {{ t('promptRemove.attemptingToRemove', {type}) }}
      <span v-clean-html="resourceNames(names, null, t)"></span>

      <div class="mt-10">
        {{ t('harvester.virtualMachine.promptRemove.title') }}
      </div>
      <div v-if="value.length === 1">
        <span
          v-for="(name, i) in removeNameArr[value[0].id]"
          :key="i"
        >
          <label class="checkbox-container mr-15">
            <input
              v-model="checkedList"
              type="checkbox"
              :label="name"
              :value="name"
            />
            <span
              class="checkbox-custom mr-5"
              role="checkbox"
            />
            {{ name }}
          </label>
        </span>
      </div>
      <div v-else>
        <label class="checkbox-container mr-15">
          <input
            v-model="checkedList"
            type="checkbox"
          />
          <span
            class="checkbox-custom mr-5"
            role="checkbox"
          />
          {{ t('harvester.virtualMachine.promptRemove.deleteAll') }}
        </label>
      </div>
    </div>
    <div class="text-warning mb-10 mt-10">
      {{ t('harvester.virtualMachine.promptRemove.tips') }}
    </div>
    <div class="text-info mt-20">
      {{ t('promptRemove.protip', { alternateLabel }) }}
    </div>
  </div>
</template>

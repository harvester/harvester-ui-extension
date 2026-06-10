<script>
import { Banner } from '@components/Banner';
import MatchExpressions from '@shell/components/form/MatchExpressions';
import ResourceTable from '@shell/components/ResourceTable';
import { _EDIT } from '@shell/config/query-params';
import { convert, simplify, matching as selectorMatching } from '@shell/utils/selector';
import throttle from 'lodash/throttle';
import { NODE } from '@shell/config/types';
import { NAME, AGE } from '@shell/config/table-headers';

export default {
  name: 'HarvesterNodeSelector',

  components: {
    Banner,
    MatchExpressions,
    ResourceTable,
  },

  props: {
    mode: {
      type:    String,
      default: _EDIT,
    },
    value: {
      type:     Object,
      required: true,
    },
  },

  async fetch() {
    this.updateMatchingResources();
  },

  data() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    return {
      matchingResources: {
        matched: 0,
        matches: [],
        none:    true,
        sample:  null,
        total:   0,
      },
      tableHeaders: [
        NAME,
        {
          name:      'host-ip',
          labelKey:  'tableHeaders.hostIp',
          search:    ['internalIp'],
          value:     'internalIp',
          sort:      ['internalIp'],
          align:     'center',
        },
        {
          name:          'cpuManager',
          labelKey:      'harvester.tableHeaders.cpuManager',
          value:         'id',
          formatter:     'HarvesterCPUPinning',
          width:         150,
          align:         'center',
        },
        {
          name:      'diskState',
          labelKey:  'tableHeaders.diskState',
          value:     'diskState',
          formatter: 'HarvesterDiskState',
          width:     130,
        },
        AGE,
      ],
      inStore,
    };
  },

  watch: {
    value: {
      handler:   'updateMatchingResources',
      deep:      true,
    },
  },

  computed: {
    schema() {
      return this.$store.getters[`${ this.inStore }/schemaFor`](NODE);
    },

    selectorExpressions: {
      get() {
        return convert(
          this.value.matchLabels || {},
          this.value.matchExpressions || []
        );
      },
      set(selectorExpressions) {
        const { matchLabels, matchExpressions } = simplify(selectorExpressions);

        this.value['matchLabels'] = matchLabels;
        this.value['matchExpressions'] = matchExpressions;
        this.updateMatchingResources();
      },
    },

    allNodes() {
      return this.$store.getters[`${ this.inStore }/all`](NODE) || [];
    },

    allResourcesInScope() {
      return this.allNodes.length;
    },
  },

  methods: {
    updateMatchingResources: throttle(function() {
      const expressions = this.selectorExpressions;
      const allNodes = this.allNodes;

      // Empty expressions with no key = no match
      const hasValidExpression = expressions.length > 0 && expressions.every((e) => !!e.key);

      if (!hasValidExpression) {
        this.matchingResources = {
          matched: 0,
          matches: [],
          none:    true,
          sample:  null,
          total:   allNodes.length,
        };

        return;
      }

      const matches = selectorMatching(allNodes, expressions, 'metadata.labels');

      this.matchingResources = {
        matched: matches.length,
        matches,
        none:    matches.length === 0,
        sample:  matches[0]?.nameDisplay || null,
        total:   allNodes.length,
      };
    }, 100, { trailing: true })
  },
};
</script>

<template>
  <div>
    <div class="row">
      <div class="col span-12">
        <MatchExpressions
          v-model:value="selectorExpressions"
          :mode="mode"
          :show-remove="false"
          :type="'node'"
          :target-resources="allResourcesInScope"
        />
      </div>
    </div>
    <div class="row">
      <div class="col span-12">
        <Banner :color="(matchingResources.none ? 'warning' : 'success')">
          <span v-clean-html="t('generic.selectors.matchingResources.matchesSome', matchingResources)" />
        </Banner>
      </div>
    </div>
    <div class="row">
      <div class="col span-12">
        <ResourceTable
          :rows="matchingResources.matches"
          :headers="tableHeaders"
          key-field="id"
          :table-actions="false"
          :row-actions="false"
          :schema="schema"
          :groupable="false"
          :search="false"
        />
      </div>
    </div>
  </div>
</template>

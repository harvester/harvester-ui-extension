<script>
import NetworkPolicy from '@shell/edit/networking.k8s.io.networkpolicy';
import { Banner } from '@components/Banner';
import { DOC } from '../config/doc-links';
import { docLink } from '../utils/feature-flags';

export default {
  components: {
    NetworkPolicy,
    Banner
  },

  computed: {
    networkPolicyDocLink() {
      const version = this.$store.getters['harvester-common/getServerVersion']();

      return docLink(DOC.NETWORK_POLICY, version);
    }
  }
};
</script>

<template>
  <div class="network-policy-edit">
    <Banner color="info">
      <t
        k="harvester.networkPolicy.banner"
        :url="networkPolicyDocLink"
        :raw="true"
      />
    </Banner>
    <NetworkPolicy v-bind="$attrs" />
  </div>
</template>

<style lang="scss" scoped>
  .network-policy-edit {
    flex: auto;
    display: flex;
    flex-direction: column;
  }
</style>

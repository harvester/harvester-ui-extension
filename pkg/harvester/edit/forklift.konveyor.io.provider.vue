<script>
import { h } from 'vue';
import { PRODUCT_NAME } from '../config/harvester';

export default {
  name: 'ForkliftProviderEdit',

  created() {
    const { namespace, id } = this.$route.params;
    const query = namespace && id ? { providerId: `${ namespace }/${ id }` } : {};

    this.$router.replace({
      name:   `${ PRODUCT_NAME }-c-cluster-vm-migration-provider-wizard`,
      params: {
        product: this.$route.params.product,
        cluster: this.$route.params.cluster,
      },
      query,
    });
  },

  render: () => h('div'),
};
</script>

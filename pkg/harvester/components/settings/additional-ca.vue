<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import FileSelector, { createOnSelected } from '@shell/components/form/FileSelector';
import { TextAreaAutoGrow } from '@components/Form/TextArea';

export default {
  name: 'HarvesterAdditionalCA',

  components: { FileSelector, TextAreaAutoGrow },

  mixins: [CreateEditView],

  methods: { onKeySelected: createOnSelected('value.value') },
};
</script>

<template>
  <div>
    <div class="row mb-20">
      <div class="col span-12">
        <FileSelector
          variant="primary"
          class="mb-10"
          :label="t('generic.readFromFile')"
          @selected="onKeySelected"
        />

        <div>
          <TextAreaAutoGrow
            v-model:value="value.value"
            :min-height="254"
          />
        </div>
      </div>
    </div>
  </div>
</template>

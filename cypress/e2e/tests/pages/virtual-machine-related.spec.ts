import HarvesterDetailPagePo from '@/cypress/e2e/po/pages/harvester-detail-page.po';
import { TemplateVersionEditPagePo } from '@/cypress/e2e/po/pages/virtual-machines.po';
import { recordedBackups, recordedTemplateVersion } from '@/cypress/support/recorded';

const DETAIL_TYPES = {
  backup:   'harvesterhci.io.virtualmachinebackup',
  snapshot: 'harvesterhci.io.vmsnapshot',
};

// The other pages built on the VM form and its mixin
describe('Pages built on the VM form', { tags: ['@virtualMachines'] }, () => {
  it('loads a VM template version into the form', () => {
    recordedTemplateVersion().then((version) => {
      const edit = new TemplateVersionEditPagePo(version.namespace, version.name);

      edit.goTo();
      edit.waitForPage();
      edit.cpu().self().should('have.value', `${ version.cores }`);
    });
  });

  (['backup', 'snapshot'] as const).forEach((type) => {
    it(`shows a VM ${ type }`, () => {
      recordedBackups(type).then(([item]) => {
        if (!item) {
          cy.log(`The recording has no VM ${ type }`);

          return;
        }

        const detail = new HarvesterDetailPagePo(DETAIL_TYPES[type], item.namespace, item.name);

        detail.goTo();
        detail.waitForPage();
        detail.name().should('have.text', item.name);
      });
    });
  });
});

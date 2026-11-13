import { VirtualMachineCreatePagePo, VirtualMachineDetailPagePo, VirtualMachineEditPagePo } from '@/cypress/e2e/po/pages/virtual-machines.po';
import { harvesterApi, recordedImage, recordedVms, recordedVmSpec } from '@/cypress/support/recorded';

const inputValues = ($inputs: ArrayLike<HTMLElement>) => Array.from($inputs).map((input) => (input as HTMLInputElement).value);

// What the VM form sends and loads: the safety net for changes to the VM form and its mixin
describe('Virtual machine form', { tags: ['@virtualMachines'] }, () => {
  it('sends the VM the form describes', () => {
    const create = new VirtualMachineCreatePagePo();

    // Answered here, so nothing is created, in a replay or while recording
    cy.intercept('POST', /\/kubevirt\.io\.virtualmachines\/[^/?]+$/, (req) => req.reply(201, req.body)).as('createVm');

    recordedImage().then((image) => {
      create.goTo();
      create.waitForPage();
      create.nameNsDescription().name().set('e2e-vm');
      create.cpu().set('2');
      create.memory().set('4');
      create.tabs().clickTabWithName('Volume');
      create.image().toggle();
      create.image().clickOptionWithLabel(image.label);
      create.namespace().invoke('text').then((text) => {
        const namespace = text.trim();

        create.save();
        cy.wait('@createVm').then(({ request }) => {
          const vm = request.body;
          const { domain, volumes, networks } = vm.spec.template.spec;
          const claims = JSON.parse(vm.metadata.annotations['harvesterhci.io/volumeClaimTemplates']);

          expect(request.url).to.match(new RegExp(`${ harvesterApi() }/kubevirt\\.io\\.virtualmachines/${ namespace }$`));
          expect(vm.metadata).to.include({ name: 'e2e-vm', namespace });
          expect(domain.cpu.cores).to.equal(2);
          expect(domain.resources.limits.memory).to.equal('4Gi');
          expect(volumes.map((v: { name: string }) => v.name)).to.include.members(['disk-0', 'cloudinitdisk']);
          expect(networks).to.deep.include({ name: 'default', pod: {} });
          expect(claims).to.have.length(1);
          expect(claims[0].metadata.annotations['harvesterhci.io/imageId']).to.equal(image.id);
          expect(claims[0].spec.resources.requests.storage).to.equal('10Gi');
        });
      });
    });
  });

  it('loads a VM into the edit form', () => {
    recordedVms().then(({ running }) => recordedVmSpec(running).then((spec) => {
      const edit = new VirtualMachineEditPagePo(running.namespace, running.name);

      edit.goTo();
      edit.waitForPage();
      edit.cpu().self().should('have.value', `${ spec.cores }`);
      edit.memory().self().should('have.value', `${ spec.memoryGi }`);
      edit.tabs().clickTabWithName('Volume');
      edit.nameInputs('Volume').should(($inputs) => {
        expect(inputValues($inputs)).to.deep.equal(spec.disks);
      });
      edit.tabs().clickTabWithName('Network');
      edit.nameInputs('Network').should(($inputs) => {
        expect(inputValues($inputs)).to.deep.equal(spec.interfaces);
      });
    }));
  });

  it('shows the volumes and networks of a VM on its detail page', () => {
    recordedVms().then(({ running }) => recordedVmSpec(running).then((spec) => {
      const detail = new VirtualMachineDetailPagePo(running.namespace, running.name);

      detail.goTo();
      detail.waitForPage();
      detail.tabs().clickTabWithSelector('li[data-testid="disks"] a');
      spec.disks.forEach((disk) => detail.tabPanel('disks').should('contain.text', disk));
      detail.tabs().clickTabWithSelector('li[data-testid="networks"] a');
      spec.interfaces.forEach((nic) => detail.tabPanel('networks').should('contain.text', nic));
    }));
  });
});

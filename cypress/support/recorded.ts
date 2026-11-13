/**
 * The specs run against whatever Harvester was recorded, so the values they check (which VM to open, how
 * many rows a list shows) come from the recording: `yarn e2e:record` saves them while it records, and
 * replays read them back from cypress/recordings/<mode>.json.
 */

export interface RecordedVm {
  namespace: string;
  name: string;
}

export interface RecordedVms {
  running: RecordedVm;
  stopped?: RecordedVm;
}

interface VmResource {
  metadata: { namespace: string, name: string };
  status?: { printableStatus?: string };
}

export function isRecording(): boolean {
  return Cypress.env('recording') === true;
}

/**
 * `standalone` (Harvester's own UI) or `rancher` (the extension in Rancher)
 */
export function harvesterMode(): string {
  return Cypress.env('harvesterMode');
}

/**
 * Where Harvester's API is: straight on a standalone Harvester, through the cluster proxy in Rancher
 */
export function harvesterApi(): string {
  return harvesterMode() === 'rancher' ? `/k8s/clusters/${ Cypress.env('harvesterCluster') }/v1/harvester` : '/v1/harvester';
}

/**
 * While recording, `observe` the value on the live Harvester and save it under `key`. Otherwise return the
 * value that was saved
 */
export function recorded<T>(key: string, observe: () => Cypress.Chainable<T>): Cypress.Chainable<T> {
  if (isRecording()) {
    return observe().then((value: T) => {
      cy.task('saveRecordedValue', { key, value });

      return cy.wrap(value);
    });
  }

  return cy.readFile(`cypress/recordings/${ harvesterMode() }.json`).its(key);
}

/**
 * How many rows a list shows once the number stops changing: a live list can still be filling in when its
 * first rows appear. Only used while recording, so the fixed waits never slow a replay down
 */
export function settledRowCount<T extends { length: number }>(rows: () => Cypress.Chainable<T>): Cypress.Chainable<number> {
  const check = (last: number, stableFor: number): Cypress.Chainable<number> => {
    if (stableFor >= 3) {
      return cy.wrap(last);
    }

    // eslint-disable-next-line cypress/no-unnecessary-waiting
    return cy.wait(1000, { log: false }).then(() => rows().its('length').then((length: number) => check(length, length === last ? stableFor + 1 : 0)));
  };

  return rows().its('length').then((length: number) => check(length, 0));
}

/**
 * The VMs the specs open: a running one whose name is not part of another VM's name, and a stopped one
 */
export function recordedVms(): Cypress.Chainable<RecordedVms> {
  return recorded('vms', () => cy.request({
    url:     `${ harvesterApi() }/kubevirt.io.virtualmachines`,
    headers: { accept: 'application/json' }
  }).then(({ body }: { body: { data: VmResource[] } }) => {
    const vms = body.data
      .map((vm) => ({
        namespace: vm.metadata.namespace, name: vm.metadata.name, status: vm.status?.printableStatus
      }))
      .sort((a, b) => `${ a.namespace }/${ a.name }`.localeCompare(`${ b.namespace }/${ b.name }`));
    const pick = (status: string) => vms.find((vm) => vm.status === status && !vms.some((other) => other !== vm && other.name.includes(vm.name)));
    const running = pick('Running');
    const stopped = pick('Stopped');

    if (!running) {
      throw new Error('The Harvester being recorded needs a running VM');
    }

    return {
      running: { namespace: running.namespace, name: running.name },
      ...(stopped ? { stopped: { namespace: stopped.namespace, name: stopped.name } } : {})
    };
  }));
}

interface Named {
  metadata: { namespace: string, name: string };
}

interface VmSpec {
  domain: {
    cpu?: { cores?: number };
    resources?: { limits?: { memory?: string } };
    memory?: { guest?: string };
    devices: { disks: { name: string }[], interfaces?: { name: string }[] };
  };
}

type VmResponse = { spec: { template: { spec: VmSpec & { volumes: { name: string, cloudInitNoCloud?: unknown, cloudInitConfigDrive?: unknown }[] } } } };
type ImageList = { data: (Named & { spec: { displayName: string }, status?: { progress?: number } })[] };
type TemplateVersionList = { data: (Named & { spec: { vm: VmResponse } })[] };
type BackupList = { data: (Named & { spec: { type?: string }, status?: { readyToUse?: boolean } })[] };

const GI_PER_UNIT = {
  Mi: 1 / 1024, Gi: 1, Ti: 1024
};

export interface RecordedVmSpec {
  cores: number;
  memoryGi: number;
  disks: string[];
  interfaces: string[];
}

export interface RecordedImage {
  id: string;
  /** How the create form lists it: namespace/display name */
  label: string;
}

export interface RecordedTemplateVersion extends RecordedVm {
  cores: number;
}

const getHarvester = <T>(path: string): Cypress.Chainable<T> => cy.request({
  url:     `${ harvesterApi() }/${ path }`,
  headers: { accept: 'application/json' }
}).its('body');

const byNamespaceAndName = (a: Named, b: Named) => `${ a.metadata.namespace }/${ a.metadata.name }`.localeCompare(`${ b.metadata.namespace }/${ b.metadata.name }`);

/**
 * A Kubernetes memory quantity in Gi, as the VM form shows it
 */
export function toGi(quantity = ''): number {
  const match = /^(\d+(?:\.\d+)?)(Mi|Gi|Ti)$/.exec(quantity);

  if (!match) {
    throw new Error(`Memory ${ quantity } isn't in Mi, Gi or Ti`);
  }

  return Number(match[1]) * GI_PER_UNIT[match[2] as keyof typeof GI_PER_UNIT];
}

/**
 * What a VM's spec says: the edit form and the detail tabs must show the same
 */
export function recordedVmSpec(vm: RecordedVm): Cypress.Chainable<RecordedVmSpec> {
  return recorded('runningVmSpec', () => getHarvester<VmResponse>(`kubevirt.io.virtualmachines/${ vm.namespace }/${ vm.name }`).then(({ spec }) => {
    const { domain, volumes } = spec.template.spec;
    // The form keeps cloud-init in its own section, not with the volumes
    const cloudInit = volumes.filter((v) => v.cloudInitNoCloud || v.cloudInitConfigDrive).map((v) => v.name);

    return {
      cores:      domain.cpu?.cores || 1,
      memoryGi:   toGi(domain.resources?.limits?.memory || domain.memory?.guest),
      disks:      domain.devices.disks.map((disk) => disk.name).filter((name) => !cloudInit.includes(name)),
      interfaces: (domain.devices.interfaces || []).map((nic) => nic.name),
    };
  }));
}

/**
 * The image the create spec picks: the first ready one by namespace and name
 */
export function recordedImage(): Cypress.Chainable<RecordedImage> {
  return recorded('image', () => getHarvester<ImageList>('harvesterhci.io.virtualmachineimages').then(({ data }) => {
    const image = data.filter((i) => i.status?.progress === 100).sort(byNamespaceAndName)[0];

    if (!image) {
      throw new Error('The Harvester being recorded needs a ready image');
    }

    return { id: `${ image.metadata.namespace }/${ image.metadata.name }`, label: `${ image.metadata.namespace }/${ image.spec.displayName }` };
  }));
}

/**
 * The first template version by namespace and name, and the CPU cores its VM has
 */
export function recordedTemplateVersion(): Cypress.Chainable<RecordedTemplateVersion> {
  return recorded('templateVersion', () => getHarvester<TemplateVersionList>('harvesterhci.io.virtualmachinetemplateversions').then(({ data }) => {
    const version = data.sort(byNamespaceAndName)[0];

    if (!version) {
      throw new Error('The Harvester being recorded needs a VM template');
    }

    return {
      namespace: version.metadata.namespace, name: version.metadata.name, cores: version.spec.vm.spec.template.spec.domain.cpu?.cores || 1
    };
  }));
}

/**
 * The first ready VM backup or snapshot by namespace and name, as a list of none or one: a Harvester may
 * have neither
 */
export function recordedBackups(type: 'backup' | 'snapshot'): Cypress.Chainable<RecordedVm[]> {
  return recorded(`${ type }s`, () => getHarvester<BackupList>('harvesterhci.io.virtualmachinebackups').then(({ data }) => data
    .filter((b) => b.spec.type === type && b.status?.readyToUse)
    .sort(byNamespaceAndName)
    .slice(0, 1)
    .map((b) => ({ namespace: b.metadata.namespace, name: b.metadata.name }))));
}

/**
 * Log in to the Harvester being recorded. Replays need no login
 */
export function loginToRecordedHarvester() {
  cy.session('recording', () => {
    // Rancher wants the CSRF cookie this sets back as a header on the login
    cy.request({ url: '/v3-public/authProviders', headers: { accept: 'application/json' } });
    cy.getCookie('CSRF').then((csrf) => {
      // Not logged, and not failing on the status: a failed cy.request prints its body, password included
      cy.request({
        method:           'POST',
        url:              '/v3-public/localProviders/local?action=login',
        headers:          { 'x-api-csrf': csrf?.value },
        body:             {
          username:     Cypress.env('username'),
          password:     Cypress.env('password'),
          description:  'e2e recording',
          responseType: 'cookie'
        },
        log:              false,
        failOnStatusCode: false
      }).then(({ status }) => {
        if (status >= 300) {
          throw new Error(`Logging in to the Harvester being recorded failed with ${ status }`);
        }
      });
    });
  });
}

export function logoutOfRecordedHarvester() {
  cy.getCookie('CSRF').then((csrf) => {
    cy.request({
      method:           'POST',
      url:              '/v3/tokens?action=logout',
      headers:          { 'x-api-csrf': csrf?.value },
      failOnStatusCode: false
    });
  });
}

let apiRequestsInFlight = 0;

/**
 * Count the page's API requests that haven't been answered yet (recording only)
 */
export function trackApiRequests() {
  apiRequestsInFlight = 0;
  cy.intercept({ url: /\/(v1|v3|k8s|api|apis)\// }, (req) => {
    apiRequestsInFlight++;
    req.on('after:response', () => {
      apiRequestsInFlight--;
    });
  });
}

/**
 * Wait until the page has made no API request for 3 s, or 30 s at most. A page asks for some things late
 * (tabs, secondary lists), after the test is done with it: a replay is fast enough to get there, so the
 * recording needs them too. Never fails the test
 */
export function waitForApiIdle() {
  const check = (quietFor: number, left: number): Cypress.Chainable<null> => {
    if (quietFor >= 3 || left <= 0) {
      return cy.wrap(null, { log: false });
    }

    // eslint-disable-next-line cypress/no-unnecessary-waiting
    return cy.wait(1000, { log: false }).then(() => check(apiRequestsInFlight > 0 ? 0 : quietFor + 1, left - 1));
  };

  check(0, 30);
}

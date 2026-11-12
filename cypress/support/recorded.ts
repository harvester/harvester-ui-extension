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

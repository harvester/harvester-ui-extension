// Commands, reporters and the accessibility checks shared with rancher/dashboard
import '@rancher/cypress/support/e2e';
import { quietSubscribeSockets } from '@/cypress/support/quiet-sockets';
import {
  isRecording, loginToRecordedHarvester, logoutOfRecordedHarvester, trackApiRequests, waitForApiIdle
} from '@/cypress/support/recorded';

// `yarn e2e:record` runs the specs against a real Harvester, so they log in there, and lets each page
// finish its requests before the next test, so the recording has the ones a page makes late too.
// A replay has no live updates: its subscribe sockets stay quiet instead of failing
if (isRecording()) {
  beforeEach(loginToRecordedHarvester);
  beforeEach(trackApiRequests);
  afterEach(waitForApiIdle);
  after(logoutOfRecordedHarvester);
} else {
  Cypress.on('window:before:load', quietSubscribeSockets);
}

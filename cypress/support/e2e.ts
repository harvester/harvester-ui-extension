// Commands, reporters and the accessibility checks shared with rancher/dashboard
import '@rancher/cypress/support/e2e';
import { isRecording, loginToRecordedHarvester, logoutOfRecordedHarvester } from '@/cypress/support/recorded';

// `yarn e2e:record` runs the specs against a real Harvester, so they log in there
if (isRecording()) {
  beforeEach(loginToRecordedHarvester);
  after(logoutOfRecordedHarvester);
}

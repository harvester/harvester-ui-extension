# E2E tests

Cypress tests that run the Harvester UI against a **recorded** Harvester instead of a live cluster, so they can run on every PR.

- `recordings/harvester.har` holds the API responses of a real Harvester. `yarn dev:recorded` starts the dev server with the shell's HAR replay (`HAR_FILE`, see `@rancher/shell/server/har-file.js`), which answers every API call from that file.
- Page objects, commands and the Cypress config come from [`@rancher/cypress`](https://www.npmjs.com/package/@rancher/cypress), the package rancher/dashboard publishes for extensions. Harvester page objects live in `e2e/po/`.
- `e2e/tests/pages/` checks that the main pages load and work with that data.
- `e2e/tests/accessibility/` scans the same pages with axe. It only reports for now: violations never fail the job, and the job summary lists them per page.

## Running locally

```bash
yarn dev:recorded   # https://127.0.0.1:8005/harvester/c/local/harvesterhci.io.dashboard, no login
yarn cy:open        # or: TEST_SKIP=setup yarn cy:run
TEST_A11Y=true TEST_SKIP=setup yarn cy:run   # accessibility report in cypress/accessibility/
```

`yarn dev:recorded` is also handy for UI work without a cluster. It is read-only: anything that is not in the recording returns 404.

## Recording new data

1. Run `yarn dev` against a Harvester cluster and log in.
2. In the browser's DevTools, open **Network**, tick **Preserve log**, filter to **Fetch/XHR**, and visit the pages the tests need. Each page load records every request it makes.
3. Export the requests as a HAR (the download icon in the Network panel, or right-click **Save all as HAR**).
4. Clean it up into the recording:

   ```bash
   SCRUB_RENAME="alice:keypair-1" SCRUB_CHECK="<admin password>,<internal names>" \
     node scripts/e2e/scrub-har.mjs ~/Downloads/127.0.0.1.har cypress/recordings/harvester.har
   ```

   The script keeps only API responses, drops headers and cookies, redacts Secret data, passwords, tokens, keys, certificates, SSH keys and e-mail addresses, maps private IPs and internal host names to documentation values, and keeps Secrets, ConfigMaps, Pods and ServiceAccounts only from namespaces that hold a VM. It refuses to write the file if anything that looks sensitive is left. `SCRUB_RENAME` renames resources whose names give away people or internal systems, and `SCRUB_CHECK` lists strings that must not appear. Both are read from the environment, so they never show up in the process list.
5. Look through the diff before committing. Update the expected counts in the specs if the data changed.

The current recording comes from Harvester v1.10.0-rc1.

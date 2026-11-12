# E2E tests

Cypress tests that run the Harvester UI against a **recorded** backend instead of a live one, so they can run on every PR. They run in two modes:

- **standalone**: Harvester's own UI, `/harvester/c/local/...`
- **rancher**: the Harvester extension inside Rancher, on a Harvester cluster imported there, `/harvester/c/<cluster id>/...`. Virtualization Management itself is part of rancher/dashboard, not of `@rancher/shell`, so it isn't in the extension's dev server

How it fits together:

- `recordings/<mode>.har` holds the API responses of a real backend. `yarn dev:recorded` (standalone) and `yarn dev:recorded:rancher` start the dev server with the shell's HAR replay (`HAR_FILE`, see `@rancher/shell/server/har-file.js`), which answers every API call from that file.
- `recordings/<mode>.json` holds what the specs check that depends on the data: the cluster id, which VMs to open, how many rows each list showed. It's written together with the recording, so the specs work with any Harvester.
- Page objects, commands and the Cypress config come from [`@rancher/cypress`](https://www.npmjs.com/package/@rancher/cypress), the package rancher/dashboard publishes for extensions. Harvester page objects live in `e2e/po/`.
- `e2e/tests/pages/` checks that the main pages load and work with that data.
- `e2e/tests/accessibility/` scans the same pages with axe. It only reports for now: violations never fail the job, and the job summary lists them per page.

## Running locally

```bash
yarn dev:recorded              # or yarn dev:recorded:rancher. No login
TEST_SKIP=setup yarn cy:run    # add TEST_HARVESTER_MODE=rancher for the rancher mode, or use yarn cy:open
TEST_A11Y=true TEST_SKIP=setup yarn cy:run   # accessibility report in cypress/accessibility/
```

The replay is also handy for UI work without a cluster. It is read-only: anything that is not in the recording returns 404.

## Recording new data

Record again when a change makes the UI call an API the recording doesn't have. The CI job summary lists those calls under **Replayed Harvester**. Recording against a newer Harvester or Rancher is also a good idea.

```bash
# standalone: a Harvester with at least one running VM
HARVESTER_IP=<harvester address> HARVESTER_PASSWORD=<admin password> yarn e2e:record

# rancher: a Rancher with that Harvester imported
RANCHER_URL=https://<rancher> RANCHER_PASSWORD=<admin password> HARVESTER_CLUSTER=<cluster name or id> yarn e2e:record
```

Set both groups to record both modes in one go. `HARVESTER_USERNAME` and `RANCHER_USERNAME` default to `admin`. For each mode, `yarn e2e:record` (`scripts/e2e/record.mjs`):

1. starts the dev server against the backend, through a read-only proxy that keeps the API responses (`scripts/e2e/record-proxy.mjs`). The UI's writes, such as saving preferences, are answered by the proxy and never reach the backend. In the rancher mode it also hides the Rancher's installed extensions, so the Harvester extension being tested is the one the dev server builds
2. runs every spec against it, logged in, saving the values the specs check into `recordings/<mode>.json`
3. cleans the responses up into `recordings/<mode>.har` with `scripts/e2e/scrub-har.mjs`

Nothing is written for a mode whose specs fail or whose clean-up finds something sensitive. Look through the diff before committing. `yarn e2e:record --serve standalone` (or `rancher`) only starts the dev server through the proxy, to look around.

The clean-up keeps only API responses, drops headers and cookies, redacts Secret data, passwords, tokens, keys, certificates, SSH keys, e-mail addresses and Rancher import URLs, maps every IP address and internal host name to documentation values, keeps Secrets, ConfigMaps, Pods and ServiceAccounts only from namespaces that hold a VM, and keeps only `local` and the Harvester cluster in Rancher's cluster lists. It fails if anything that looks sensitive is left, including the backend's address and the password. Two optional variables help with the rest, both read from the environment so they never show up in the process list:

- `SCRUB_RENAME="alice:keypair-1,..."` renames resources whose names give away people or internal systems, everywhere they appear
- `SCRUB_CHECK="name1,name2"` lists more strings that must not appear

If Cypress can't run on your machine, run the recording in the Cypress image, which has the same Cypress version:

```bash
docker run --rm -e HARVESTER_IP -e HARVESTER_PASSWORD -e RANCHER_URL -e RANCHER_PASSWORD -e HARVESTER_CLUSTER \
  -v "$PWD":/src:ro -v "$PWD/cypress/recordings":/out --entrypoint bash cypress/included:15.19.0 -c '
    mkdir /work && tar -C /src --exclude=./node_modules --exclude=./.git -cf - . | tar -C /work -xf - &&
    cd /work && CYPRESS_INSTALL_BINARY=0 yarn install --frozen-lockfile && yarn e2e:record; cp cypress/recordings/*.har cypress/recordings/*.json /out/'
```

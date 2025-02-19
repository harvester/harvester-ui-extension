# harvester-ui-extension

Rancher Extension used in [rancher/dashboard](https://github.com/rancher/dashboard) for [Harvester](https://harvesterhci.io) Dashboard UI.

`
From Rancher 2.10.0, Harvester integration is provided by this new Harvester UI Extension.
`

## Installation

To install the Harvester UI Extension in Rancher 2.10.0 and newer, please refer to [installation](https://docs.harvesterhci.io/v1.5/rancher/harvester-ui-extension#installation-on-rancher-210) on harvester doc.

## Running for Development

This is what you probably want to get started.

### Prerequisite

Nodejs version >= 20


### Standalone Mode

For development, serve with hot reload at https://localhost:8005

```bash
# Install dependencies
yarn install

# Use RANCHER_ENV to specify the endpoint for your Harvester API
RANCHER_ENV=harvester API=https://your-harvester-ip yarn dev

# Use VUE_APP_SERVER_VERSION to specify the Harvester server version
# in case your are running a dev build of Harvester
RANCHER_ENV=harvester VUE_APP_SERVER_VERSION=your-harvester-server-version API=https://your-harvester-ip yarn dev

# or put your env variables into a .env file

# Example
RANCHER_ENV=harvester VUE_APP_SERVER_VERSION=v1.4.0 API=https://192.168.1.123 yarn dev
```

### Rancher Integration Mode

In this mode, you need to have Rancher and run Harvester UI Extension as Rancher extension, see more detail in [Rancher UI extension](https://extensions.rancher.io/extensions/next/extensions-getting-started#running-the-app).

```bash
API=https://your-rancher-ip yarn dev

# Example
API=https://192.168.1.123 yarn dev
```

## Contributing

For developers, after reading through the introduction on this page, head over to our [Getting Started](https://extensions.rancher.io/extensions/next/extensions-getting-started) guide to learn more.

License
=======
Copyright (c) 2014-2025 [SUSE, LLC.](https://www.suse.com/)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

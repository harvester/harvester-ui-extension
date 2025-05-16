# harvester-ui-extension

The Harvester UI Extension is a Rancher extension that provides the user interface for [Harvester](https://harvesterhci.io) within the [Rancher Dashboard](https://github.com/rancher/dashboard).

> **Note:**
> This extension is available starting from **Rancher 2.10.0**. Ensure your Rancher version is **2.10.0 or later** to access Harvester integration.

## Installation

For detailed installation instructions, please refer to the [official Harvester documentation](https://docs.harvesterhci.io/v1.5/rancher/harvester-ui-extension#installation-on-rancher-210).


## Development Setup

Ensure **Node.js v20 or later** is installed for development and debugging.

### Standalone Mode

Run the extension standalone with hot reload at `https://localhost:8005`.

```bash
# Install dependencies
yarn install

# Start the development server
RANCHER_ENV=harvester API=https://your-harvester-ip yarn dev

# Example with specific server version
RANCHER_ENV=harvester VUE_APP_SERVER_VERSION=v1.5.0 API=https://192.168.1.123 yarn dev
```

You may also define environment variables in a `.env` file:

```env
RANCHER_ENV=harvester
VUE_APP_SERVER_VERSION=v1.5.0
API=https://192.168.1.123
```

### Rancher Integration Mode

To run as a Rancher extension, follow the [Rancher UI Extension Guide](https://extensions.rancher.io/extensions/next/extensions-getting-started#running-the-app).

```bash
API=https://your-rancher-ip yarn dev
```

## Branch Structure

- **`main`** – Main development branch
- **`release-harvester-vX.Y`** – Stable release branches per version series
- **`vX.Y-head`** – Testing branches for ongoing changes in each release series

> **Note:**
> The `vX.Y-head` branches are auto-generated and kept in sync with release branches. Use these for testing the latest changes in each version series.

## Testing Guidelines

### UI Extension Testing

To validate changes in a release series, switch to the appropriate `vX.Y-head` branch. For main branch testing, use `main-head`.

- Examples:
  - Test `1.0.x` series → `v1.0-head`
  - Test `1.5.x` series → `v1.5-head`

**Steps:**
1. Navigate to **Rancher UI** → **Local** → **App** → **Repositories**
2. Refresh the Harvester repository using the target `vX.Y-head` branch
3. Go to the **Extensions** page and install the desired version

### Standalone Mode Testing

To test the standalone UI, configure Harvester to load the UI from an external source.

- Examples of `ui-index`:
  - Main branch → `https://releases.rancher.com/harvester-ui/dashboard/latest/index.html`
  - Release series `1.5.x` → `https://releases.rancher.com/harvester-ui/dashboard/release-harvester-v1.5/index.html`

**Steps:**
1. Go to **Harvester UI** → **Advanced** → **Settings** → **UI**
2. Set **ui-source** to `External`
3. Set **ui-index** to the desired URL

## Contributing

If you want to contribute, start by reading this document, then visit our [Getting Started guide](https://extensions.rancher.io/extensions/next/extensions-getting-started) to learn how to develop and submit changes.

## License

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

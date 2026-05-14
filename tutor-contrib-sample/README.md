# Tutor Plugin Configuration Guide (frontend-base)

This directory contains a Tutor plugin that wires the sample backend plugin (Django app) and the sample frontend-base App into a Tutor-managed Open edX deployment.

## Table of Contents

- [Overview](#overview)
- [What this plugin does](#what-this-plugin-does)
- [Installation](#installation)
- [Development vs Production](#development-vs-production)
- [Migrating from the FPF version of this plugin](#migrating-from-the-fpf-version-of-this-plugin)
- [Troubleshooting](#troubleshooting)

## Overview

This plugin assumes a tutor-mfe deployment that uses the **frontend-base site** instead of (or alongside) the legacy per-MFE images. In frontend-base, all frontend apps live in a single bundled site, and customizations are expressed as `App` objects registered with the site config rather than as `env.config.jsx` plugin slots.

**Official documentation:**
- [tutor-mfe](https://github.com/overhangio/tutor-mfe) (see the "Frontend-base site" section)
- [frontend-base](https://github.com/openedx/frontend-base)
- [Tutor Plugin Development](https://docs.tutor.edly.io/plugins/index.html)

## What this plugin does

The plugin file is [`tutorsample/plugin.py`](./tutorsample/plugin.py). Each block below maps to a section of that file.

### Backend installation

```python
hooks.Filters.ENV_PATCHES.add_item((
    "openedx-dockerfile-post-python-requirements",
    "RUN pip install openedx-plugin-sample",
))
hooks.Filters.MOUNTED_DIRECTORIES.add_item(("openedx", "backend-plugin-sample"))
```

Installs the published Django app from PyPI into the LMS and CMS images. The `MOUNTED_DIRECTORIES` entry makes `tutor mounts add /path/to/backend-plugin-sample` pip-install the local checkout on top of the published version.

### Migrations on first launch

```python
hooks.Filters.CLI_DO_INIT_TASKS.add_item((
    "lms", "./manage.py lms migrate openedx_plugin_sample",
))
hooks.Filters.CLI_DO_INIT_TASKS.add_item((
    "cms", "./manage.py cms migrate openedx_plugin_sample",
))
```

### Frontend integration (`tutormfe.hooks.FRONTEND_APPS`)

```python
from tutormfe.hooks import FRONTEND_APPS

@FRONTEND_APPS.add()
def _enable_learner_dashboard(apps):
    apps["learner-dashboard"]["enabled"] = True
    return apps

@FRONTEND_APPS.add()
def _add_sample_app(apps):
    apps["plugin-sample"] = {
        "npm_package": "@openedx/plugin-sample",
        "npm_version": "^1.0.0",
        "enabled": True,
    }
    return apps
```

The `FRONTEND_APPS` filter is the frontend-base equivalent of declaring an `MFE_APPS` entry. The first hook flips the built-in learner-dashboard App to `enabled` (it ships disabled in tutor-mfe). The second hook registers the sample npm package so tutor-mfe installs it into the site's `node_modules` at build time.

### Wiring the App into the site config

```python
hooks.Filters.ENV_PATCHES.add_item((
    "mfe-site-config-imports",
    "import sampleApp from '@openedx/plugin-sample';",
))
hooks.Filters.ENV_PATCHES.add_item((
    "mfe-site-config",
    "addApp(siteConfig, sampleApp);",
))
```

`mfe-site-config-imports` adds a static import to both `site.config.build.tsx` and `site.config.dev.tsx`. `mfe-site-config` adds code that runs after `siteConfig` is created. `addApp()` merges the App's slot operations into the site.

### Brand override

Unchanged from the legacy version: the plugin points `MFE_CONFIG["PARAGON_THEME_URLS"]["variants"]["light"]["urls"]["brandOverride"]` at a CDN-served copy of `../brand-sample/dist/light.min.css`.

## Installation

### Prerequisites

- Tutor >= 20 and [tutor-mfe](https://github.com/overhangio/tutor-mfe) installed.
- The `tutor-mfe` plugin must be enabled (`tutor plugins enable mfe`).

### Install and enable

```bash
pip install -e /path/to/sample-plugin/tutor-contrib-sample/
tutor plugins enable sample
tutor config save
```

Or, for a copy-only install without a Python package:

```bash
mkdir -p "$(tutor plugins printroot)"
cp tutorsample/plugin.py "$(tutor plugins printroot)/sample.py"
tutor plugins enable sample
```

### Build and launch

```bash
tutor images build mfe openedx
tutor local launch
```

Image rebuilds are required because both `pip install openedx-plugin-sample` and `npm install @openedx/plugin-sample` happen at image build time. If you only toggled `enabled` on an already-built app, `tutor config save` and a restart are enough.

### Verify

1. Visit the learner dashboard on the frontend-base site (default: `http://apps.local.openedx.io:8080`).
2. Confirm the course list shows the **Archive** / **Unarchive** buttons.
3. Hit the backend API directly: `http://local.openedx.io:8000/sample-plugin/api/v1/course-archive-status/`.

## Development vs Production

Both `tutor dev` and `tutor local` use the same plugin and the same `FRONTEND_APPS` declarations.

To hot-reload the frontend App without rebuilding the image:

```bash
tutor mounts add /path/to/sample-plugin/frontend-plugin-sample
tutor dev launch
```

tutor-mfe spins up an `mfe-dev` service that bind-mounts the package into the site's npm workspace.

To hot-reload the backend plugin:

```bash
tutor mounts add /path/to/sample-plugin/backend-plugin-sample
tutor dev launch
```

The `MOUNTED_DIRECTORIES` entry above ensures the mount is recognized by tutor's image-build wiring.

## Migrating from the FPF version of this plugin

If you have an existing tutor plugin written against the legacy `frontend-plugin-framework`, the mapping is:

| Legacy (FPF) | frontend-base |
| --- | --- |
| `from tutormfe.hooks import PLUGIN_SLOTS` | `from tutormfe.hooks import FRONTEND_APPS, FRONTEND_SLOTS` |
| `PLUGIN_SLOTS.add_item(("learner-dashboard", slot_id, "{ op: PLUGIN_OPERATIONS.Insert, ... }"))` | Either register an `App` package via `FRONTEND_APPS` + `mfe-site-config`, or use `FRONTEND_SLOTS.add_items([...])` for simple ops. |
| `mfe-dockerfile-post-npm-install` + `RUN npm install @org/plugin` | `FRONTEND_APPS["plugin-name"] = { "npm_package": "@org/plugin", "npm_version": "...", "enabled": True }` |
| `mfe-env-config-buildtime-imports` | `mfe-site-config-imports` |
| (no equivalent) | `mfe-site-config` to call `addApp(siteConfig, ...)` |
| Slot id `course_list_slot` (or legacy reverse-DNS) | `org.openedx.frontend.slot.learnerDashboard.courseList.v1` |
| `PLUGIN_OPERATIONS.Hide` on `default_contents` | `WidgetOperationTypes.REMOVE` with `relatedId: 'defaultContent'` |
| `PLUGIN_OPERATIONS.Insert` (DIRECT_PLUGIN) | `WidgetOperationTypes.APPEND` (or `PREPEND`/`INSERT_BEFORE`/`INSERT_AFTER`) |
| `Hide` + `Insert` against `default_contents` | `WidgetOperationTypes.REPLACE` with `relatedId: 'defaultContent'` |

If the upstream plugin can't be ported yet, tutor-mfe ships the [frontend-base-compat](https://github.com/openedx/frontend-base-compat) shim. Opt your plugin's `PLUGIN_SLOTS` contributions into the shim with:

```python
from tutormfe.hooks import FRONTEND_COMPAT_PLUGINS
FRONTEND_COMPAT_PLUGINS.add_item("sample")
```

or, more granularly, `FRONTEND_COMPAT_SLOTS.add_item((mfe_name, slot_name, plugin_config))`.

## Troubleshooting

**`tutormfe.hooks` doesn't have `FRONTEND_APPS`:** Your tutor-mfe is too old. Upgrade to a release that supports the frontend-base site (see [tutor-mfe README](https://github.com/overhangio/tutor-mfe#frontend-base-site)).

**npm complains the package isn't found at build time:** Confirm the package is published, or use a `source` git/file URL on the `FRONTEND_APPS` entry to point at a local checkout. Then `tutor images build mfe`.

**The App installs but the slot doesn't change:**
- Confirm the learner-dashboard frontend-base App is enabled (the first `FRONTEND_APPS` hook above). Without it, the legacy MFE renders instead.
- Confirm the `slotId` in `src/app.jsx` matches what the upstream app actually registers.
- Open the site with the React devtools, find the slot, and check which widgets it renders.

**Plugin works locally but not in production:** Image build vs runtime mismatch. Both `pip install` and `npm install` happen at image build, so any plugin change requires `tutor images build mfe openedx`.

**Backend plugin migrations don't run:** They run as `CLI_DO_INIT_TASKS`, which fire during `tutor local launch` / `tutor dev launch`. If you upgraded an existing deployment, run `tutor local do init` explicitly.

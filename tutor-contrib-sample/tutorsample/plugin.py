"""
Tutor plugin for the Open edX Sample Plugin (frontend-base edition).

Installs the backend Django app (openedx-plugin-sample from PyPI) into LMS/CMS
and registers the frontend App (@openedx/plugin-sample on npm) with tutor-mfe's
frontend-base site, where it customizes the learner-dashboard.

Requirements:
    tutor>=21.0.0
    tutor-mfe (for frontend-base site configuration)
"""
import json

from tutor import hooks

try:
    from tutormfe.hooks import FRONTEND_APPS
    _tutormfe_available = True
except ImportError:
    _tutormfe_available = False

# ---------------------------------------------------------------------------
# Backend: Install the Django app plugin into LMS and CMS images
# ---------------------------------------------------------------------------

# The openedx-dockerfile-post-python-requirements patch runs after pip
# installs the base Open edX requirements. Plugins installed here are
# available in both LMS and CMS containers.

hooks.Filters.ENV_PATCHES.add_item((
    "openedx-dockerfile-post-python-requirements",
    "RUN pip install openedx-plugin-sample",
))

# Ensure that *if* backend-plugin-sample is bind-mounted, then it is mapped
# to /mnt/backend-plugin-sample and pip-installed as part of the openedx
# and openedx-dev image builds.

hooks.Filters.MOUNTED_DIRECTORIES.add_item(("openedx", "backend-plugin-sample"))

# ---------------------------------------------------------------------------
# Migrations: Run openedx_plugin_sample migrations on init
# ---------------------------------------------------------------------------

hooks.Filters.CLI_DO_INIT_TASKS.add_item((
    "lms",
    "./manage.py lms migrate openedx_plugin_sample",
))
hooks.Filters.CLI_DO_INIT_TASKS.add_item((
    "cms",
    "./manage.py cms migrate openedx_plugin_sample",
))

# ---------------------------------------------------------------------------
# Frontend: Register the sample App with the frontend-base site
# ---------------------------------------------------------------------------
# Only runs when tutor-mfe is installed, so the plugin degrades gracefully
# if someone uses this plugin without the MFE plugin.
#
# In the frontend-base world there is one bundled "site" instead of one MFE
# per app. To extend a built-in app like the learner-dashboard, we register
# our own App alongside it via FRONTEND_APPS, then `addApp(siteConfig, ...)`
# in site.config.*.tsx. The sample App's slot operations are applied to
# whichever apps share the targeted slots, regardless of which other apps
# (built-in or third-party) happen to be loaded.
# ---------------------------------------------------------------------------

if _tutormfe_available:
    # Step 1: Enable the built-in learner-dashboard App. It ships disabled by
    # default in tutor-mfe; without this, the legacy MFE is served instead and
    # our slot operations don't apply.
    @FRONTEND_APPS.add()
    def _enable_learner_dashboard(apps):
        apps["learner-dashboard"]["enabled"] = True
        return apps

    # Step 2: Declare our App so tutor-mfe installs the npm package into the
    # site workspace at image build time.
    @FRONTEND_APPS.add()
    def _add_sample_app(apps):
        apps["plugin-sample"] = {
            "npm_package": "@openedx/plugin-sample",
            "npm_version": "^1.0.0",
            "enabled": True,
        }
        return apps

    # Step 3: Import the App in site.config.*.tsx so it is in scope when the
    # config is evaluated.
    hooks.Filters.ENV_PATCHES.add_item((
        "mfe-site-config-imports",
        "import sampleApp from '@openedx/plugin-sample';",
    ))

    # Step 4: Register the App with the site config. addApp() folds the App's
    # slot operations into the site's slot pipeline.
    hooks.Filters.ENV_PATCHES.add_item((
        "mfe-site-config",
        "addApp(siteConfig, sampleApp);",
    ))

# ---------------------------------------------------------------------------
# Brand: Override Paragon theme CSS with brand-sample
# ---------------------------------------------------------------------------
# Open edX MFEs load their Paragon design-system CSS at runtime via the
# PARAGON_THEME_URLS setting. The "default" URL points at upstream Paragon;
# the optional "brandOverride" URL is loaded on top to recolor/restyle the
# theme. We point brandOverride at the compiled CSS in this repo's
# brand-sample/ directory, served via jsDelivr straight from GitHub.
#
# TODO: This assumes brand-sample has been pushed to jsdelivr.
#       Is it possible to set this up for dev so that it loads the brand from
#       the filesystem instead?
#       ANSWER: Yes, it is possible using the tutor-contrib-paragon plugin.
#       We should update this section to use that.
# ---------------------------------------------------------------------------

paragon_theme_urls = {
    "variants": {
        "light": {
            "urls": {
                "default": "https://cdn.jsdelivr.net/npm/@openedx/paragon@$paragonVersion/dist/light.min.css",
                "brandOverride": "https://cdn.jsdelivr.net/gh/openedx/sample-plugin@frontend-base/brand-sample/dist/light.min.css"
            }
        }
    }
}

brand_settings_lines = f"""
MFE_CONFIG["PARAGON_THEME_URLS"] = {json.dumps(paragon_theme_urls)}
"""

hooks.Filters.ENV_PATCHES.add_item(
    (
        "mfe-lms-common-settings",
        brand_settings_lines,
    )
)

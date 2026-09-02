# -----------------------------------------------------------------------------
# Copyright (c) Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
# -----------------------------------------------------------------------------
from __future__ import annotations

# Standard library imports
from dataclasses import dataclass

__all__ = ("NPM_PACKAGES", "NpmPackage")


@dataclass(frozen=True)
class NpmPackage:
    name: str
    workspace: str
    tarball: str

# Dependency order is also publication order.
NPM_PACKAGES = (
    NpmPackage("@bokeh/bokehjs", "", "bokeh-bokehjs"),
    NpmPackage("@bokeh/framework", "frameworks/base", "bokeh-framework"),
    NpmPackage("@bokeh/angular", "frameworks/angular", "bokeh-angular"),
    NpmPackage("@bokeh/react", "frameworks/react", "bokeh-react"),
    NpmPackage("@bokeh/svelte", "frameworks/svelte", "bokeh-svelte"),
    NpmPackage("@bokeh/vue", "frameworks/vue", "bokeh-vue"),
    NpmPackage("@bokeh/web-component", "frameworks/web-component", "bokeh-web-component"),
)


if __name__ == "__main__":
    print("\n".join(package.tarball for package in NPM_PACKAGES))

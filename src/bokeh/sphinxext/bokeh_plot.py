# -----------------------------------------------------------------------------
# Copyright (c) Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
# -----------------------------------------------------------------------------
"""Migration diagnostic for the Sphinx extension renamed in Bokeh 4.0."""

from __future__ import annotations

# Standard library imports
from typing import Any

# External imports
from sphinx.errors import SphinxError

# Bokeh imports
from ._internal import SphinxParallelSpec

__all__ = ("setup",)


def setup(app: Any) -> SphinxParallelSpec:
    raise SphinxError(
        "bokeh.sphinxext.bokeh_plot was renamed to bokeh.sphinxext.bokeh_embed in Bokeh 4.0; "
        "update the Sphinx extensions list and replace '.. bokeh-plot::' with '.. bokeh-embed::'",
    )

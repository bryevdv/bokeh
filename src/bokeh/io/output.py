#-----------------------------------------------------------------------------
# Copyright (c) Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------
'''

'''

#-----------------------------------------------------------------------------
# Boilerplate
#-----------------------------------------------------------------------------
from __future__ import annotations

import logging # isort:skip
log = logging.getLogger(__name__)

#-----------------------------------------------------------------------------
# Imports
#-----------------------------------------------------------------------------

# Standard library imports
from typing import TYPE_CHECKING

# Bokeh imports
from ._output_capture import record_output
from .state import curstate

if TYPE_CHECKING:
    from ..core.types import PathLike
    from ..resources import ResourcesMode
    from .state import State

#-----------------------------------------------------------------------------
# Globals and constants
#-----------------------------------------------------------------------------

__all__ = (
    'output_file',
    'reset_output',
)

#-----------------------------------------------------------------------------
# General API
#-----------------------------------------------------------------------------

def output_file(filename: PathLike, title: str = "Bokeh Plot",
        mode: ResourcesMode | None = None, root_dir: PathLike | None = None) -> None:
    ''' Configure the default output state for a standalone HTML file.

    Does not change the current ``Document`` from ``curdoc()``. In an
    interactive notebook, :func:`show` displays inline and does not consume
    this file configuration; call :func:`~bokeh.io.save` explicitly instead.

    Args:
        filename (str) : a filename for saving the HTML document

        title (str, optional) : a title for the HTML document (default: "Bokeh Plot")

        mode (str, optional) : how to include BokehJS (default: ``'cdn'``)
            One of: ``'inline'``, ``'cdn'``, ``'relative(-dev)'`` or
            ``'absolute(-dev)'``. See :class:`bokeh.resources.Resources` for more details.

        root_dir (str, optional) : root directory to use for 'absolute' resources. (default: None)
            This value is ignored for other resource types, e.g. ``INLINE`` or
            ``CDN``.

    Returns:
        None

    .. note::
        Generally, this should be called at the beginning of an interactive
        session or the top of a script.

    .. warning::
        This output file will be overwritten by each explicit |save|, or by
        |show| outside an interactive notebook.

    '''
    if record_output("output_file", filename, title=title, mode=mode, root_dir=root_dir):
        return

    curstate().output_file(
        filename,
        title=title,
        mode=mode,
        root_dir=root_dir,
    )

def reset_output(state: State | None = None) -> None:
    ''' Clear the default state of all output modes.

    Returns:
        None

    '''
    if record_output("reset_output", state):
        return
    (state or curstate()).reset()
    from .notebook import _reset_notebook_resources
    _reset_notebook_resources()

#-----------------------------------------------------------------------------
# Dev API
#-----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# Private API
#-----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# Code
#-----------------------------------------------------------------------------

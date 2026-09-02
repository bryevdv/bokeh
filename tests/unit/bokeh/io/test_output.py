#-----------------------------------------------------------------------------
# Copyright (c) Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# Boilerplate
#-----------------------------------------------------------------------------
from __future__ import annotations # isort:skip

import pytest ; pytest

#-----------------------------------------------------------------------------
# Imports
#-----------------------------------------------------------------------------

# Standard library imports
from unittest.mock import MagicMock, patch

# Bokeh imports
from bokeh.io.state import curstate

# Module under test
import bokeh.io.output as bio # isort:skip

#-----------------------------------------------------------------------------
# Setup
#-----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# General API
#-----------------------------------------------------------------------------


class Test_output_file:
    @patch('bokeh.io.state.State.output_file')
    def test_no_args(self, mock_output_file: MagicMock) -> None:
        default_kwargs = dict(title="Bokeh Plot", mode=None, root_dir=None)
        bio.output_file("foo.html")
        assert mock_output_file.call_count == 1
        assert mock_output_file.call_args[0] == ("foo.html",)
        assert mock_output_file.call_args[1] == default_kwargs

    @patch('bokeh.io.state.State.output_file')
    def test_with_args(self, mock_output_file: MagicMock) -> None:
        kwargs = dict(title="title", mode="cdn", root_dir="foo")
        bio.output_file("foo.html", **kwargs)
        assert mock_output_file.call_count == 1
        assert mock_output_file.call_args[0] == ("foo.html",)
        assert mock_output_file.call_args[1] == kwargs


@patch('bokeh.io.state.State.reset')
def test_reset_output(mock_reset: MagicMock) -> None:
    # might create a new one, which also calls reset
    original_call_count = curstate().reset.call_count
    bio.reset_output()
    assert curstate().reset.call_count == original_call_count+1

#-----------------------------------------------------------------------------
# Dev API
#-----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# Private API
#-----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# Code
#-----------------------------------------------------------------------------

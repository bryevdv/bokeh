#-----------------------------------------------------------------------------
# Copyright (c) 2012 - 2021, Anaconda, Inc. All rights reserved.
#
# Powered by the Bokeh Development Team.
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

# External imports
from flaky import flaky

# Bokeh imports
from bokeh._testing.plugins.project import BokehModelPage, BokehServerPage
from bokeh._testing.util.selenium import RECORD, find_element_for
from bokeh.core.enums import ButtonType
from bokeh.layouts import column
from bokeh.models import (
    Button,
    Circle,
    ColumnDataSource,
    CustomAction,
    CustomJS,
    Plot,
    Range1d,
)

#-----------------------------------------------------------------------------
# Tests
#-----------------------------------------------------------------------------

pytest_plugins = (
    "bokeh._testing.plugins.project",
)


@pytest.mark.selenium
class Test_Button:
    def test_displays_label(self, bokeh_model_page: BokehModelPage) -> None:
        button = Button(label="label")

        page = bokeh_model_page(button)

        button_el = find_element_for(page.driver, button, ".bk-btn")
        assert button_el.text == "label"

    @pytest.mark.parametrize('typ', list(ButtonType))
    def test_displays_button_type(self, typ, bokeh_model_page: BokehModelPage) -> None:
        button = Button(button_type=typ)

        page = bokeh_model_page(button)

        button = find_element_for(page.driver, button, ".bk-btn")
        assert typ in button.get_attribute('class')

    @flaky(max_runs=10)
    def test_server_on_click_round_trip(self, bokeh_server_page: BokehServerPage) -> None:

        button = Button()
        def modify_doc(doc):
            source = ColumnDataSource(dict(x=[1, 2], y=[1, 1]))
            plot = Plot(height=400, width=400, x_range=Range1d(0, 1), y_range=Range1d(0, 1), min_border=0)
            plot.add_glyph(source, Circle(x='x', y='y', size=20))
            plot.add_tools(CustomAction(callback=CustomJS(args=dict(s=source), code=RECORD("data", "s.data"))))
            def cb(event):
                source.data=dict(x=[10, 20], y=[10, 10])
            button.on_click(cb)
            doc.add_root(column(button, plot))

        page = bokeh_server_page(modify_doc)

        button_el = find_element_for(page.driver, button, ".bk-btn")
        button_el.click()

        page.click_custom_action()

        results = page.results
        assert results == {'data': {'x': [10, 20], 'y': [10, 10]}}

        # XXX (bev) disabled until https://github.com/bokeh/bokeh/issues/7970 is resolved
        #assert page.has_no_console_errors()

    @flaky(max_runs=10)
    def test_server_on_event_round_trip(self, bokeh_server_page: BokehServerPage) -> None:

        button = Button()
        def modify_doc(doc):
            source = ColumnDataSource(dict(x=[1, 2], y=[1, 1]))
            plot = Plot(height=400, width=400, x_range=Range1d(0, 1), y_range=Range1d(0, 1), min_border=0)
            plot.add_glyph(source, Circle(x='x', y='y', size=20))
            plot.add_tools(CustomAction(callback=CustomJS(args=dict(s=source), code=RECORD("data", "s.data"))))
            def cb(event):
                source.data=dict(x=[10, 20], y=[10, 10])
            button.on_event('button_click', cb)
            doc.add_root(column(button, plot))

        page = bokeh_server_page(modify_doc)

        button_el = find_element_for(page.driver, button, ".bk-btn")
        button_el.click()

        page.click_custom_action()

        results = page.results
        assert results == {'data': {'x': [10, 20], 'y': [10, 10]}}

        # XXX (bev) disabled until https://github.com/bokeh/bokeh/issues/7970 is resolved
        #assert page.has_no_console_errors()

    def test_js_on_event_executes(self, bokeh_model_page: BokehModelPage) -> None:
        button = Button()
        button.js_on_event('button_click', CustomJS(code=RECORD("clicked", "true")))

        page = bokeh_model_page(button)

        button_el = find_element_for(page.driver, button, ".bk-btn")
        button_el.click()

        results = page.results
        assert results == {'clicked': True}

        assert page.has_no_console_errors()

    def test_js_on_click_executes(self, bokeh_model_page: BokehModelPage) -> None:
        button = Button()
        button.js_on_click(CustomJS(code=RECORD("clicked", "true")))

        page = bokeh_model_page(button)

        button_el = find_element_for(page.driver, button, ".bk-btn")
        button_el.click()

        results = page.results
        assert results == {'clicked': True}

        assert page.has_no_console_errors()

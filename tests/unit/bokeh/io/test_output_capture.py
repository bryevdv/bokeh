from __future__ import annotations

from bokeh.document import Document
from bokeh.io._output_capture import capture_output
from bokeh.plotting import figure
from bokeh.plotting import show as imported_show


def test_capture_uses_already_imported_functions_without_global_patches() -> None:
    document = Document()
    plot = figure()

    with capture_output(document) as captured:
        imported_show(plot)

    assert [call.action for call in captured.calls] == ["show"]
    assert captured.outputs[0].obj is plot
    assert document.roots == [plot]
    assert Document.__module__ == "bokeh.document.document"

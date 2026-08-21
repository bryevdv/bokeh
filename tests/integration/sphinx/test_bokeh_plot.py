from __future__ import annotations

# Standard library imports
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import StringIO
from pathlib import Path
from threading import Thread

# External imports
import pytest
from sphinx.application import Sphinx

playwright = pytest.importorskip("playwright.sync_api")


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def test_static_page_renders_with_request_and_size_budgets(tmp_path: Path) -> None:
    source = tmp_path / "source"
    output = tmp_path / "output"
    doctrees = tmp_path / "doctrees"
    source.mkdir()
    (source / "conf.py").write_text(
        "extensions = ['bokeh.sphinxext.bokeh_plot']\n"
        "project = 'bokeh-plot-browser-test'\n"
        "bokeh_plot_resources = 'static'\n",
        encoding="utf-8",
    )
    (source / "index.rst").write_text(
        "Browser\n=======\n\n"
        ".. bokeh-plot::\n   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n"
        "   p = figure(width=240, height=160)\n"
        "   p.scatter([1, 2], [3, 4])\n"
        "   show(p)\n\n"
        ".. bokeh-plot::\n   :source-position: none\n\n"
        "   from bokeh.io import show\n"
        "   from bokeh.models import Button\n"
        "   show(Button(label='ready'))\n",
        encoding="utf-8",
    )
    warnings = StringIO()
    app = Sphinx(
        srcdir=source,
        confdir=source,
        outdir=output,
        doctreedir=doctrees,
        buildername="html",
        status=StringIO(),
        warning=warnings,
        freshenv=True,
    )
    app.build(force_all=True)
    assert app.statuscode == 0, warnings.getvalue()

    generated = output / "_static" / "bokeh-plot"
    payloads = list(generated.glob("bokeh-plot-*.json"))
    assert len(payloads) == 1
    assert payloads[0].stat().st_size < 100_000
    assert (generated / "bokeh-sphinx-bootstrap.js").stat().st_size < 4_000
    bundles = list((generated / "vendor" / "js").glob("*.js"))
    assert {path.name for path in bundles} == {"bokeh.min.js", "bokeh-widgets.min.js", "bokeh-api.min.js"}
    assert sum(path.stat().st_size for path in bundles) < 2_500_000

    handler = partial(_QuietHandler, directory=str(output))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    errors: list[str] = []
    requests: list[str] = []
    try:
        with playwright.sync_playwright() as manager:
            browser = manager.chromium.launch()
            page = browser.new_page()
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.on("request", lambda request: requests.append(request.url))
            response = page.goto(f"http://127.0.0.1:{server.server_port}/index.html", wait_until="networkidle")
            assert response is not None and response.ok
            page.wait_for_timeout(500)
            assert not errors, "\n".join(errors)
            page.locator("[data-bokeh-mounted]").first.wait_for(state="attached", timeout=5_000)
            assert page.locator("[data-bokeh-mounted]").count() == 2
            assert page.get_by_text("ready", exact=True).count() == 1
            browser.close()
    finally:
        server.shutdown()
        thread.join()
        server.server_close()

    assert errors == []
    bokeh_requests = [url for url in requests if "/vendor/js/bokeh" in url]
    assert len(bokeh_requests) == len(set(bokeh_requests)) == 3
    plot_requests = [url for url in requests if "/_static/bokeh-plot/" in url]
    assert len(plot_requests) == len(set(plot_requests)) == 5  # three bundles, one payload, one bootstrap

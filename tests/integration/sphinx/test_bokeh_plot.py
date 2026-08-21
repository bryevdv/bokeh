from __future__ import annotations

# Standard library imports
import json
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import StringIO
from pathlib import Path
from threading import Thread
from typing import Any

# External imports
import pytest
from sphinx.application import Sphinx

playwright = pytest.importorskip("playwright.sync_api")


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def _inject_early_consumer(output: Path) -> None:
    consumer = output / "_static" / "bokeh-sphinx-consumer.js"
    consumer.write_text(
        "const target = document.querySelector("
        "'[data-bokeh-root=\"root-0\"]')\n"
        "window.sphinxEarlyMount = Bokeh.when_mounted(target)\n"
        "window.sphinxEarlyResult = window.sphinxEarlyMount.then(\n"
        "  (mount) => ({ok: true, mount}),\n"
        "  (error) => ({ok: false, error}),\n"
        ")\n",
        encoding="utf-8",
    )
    index = output / "index.html"
    html = index.read_text(encoding="utf-8")
    marker = '<script src="_static/bokeh-plot/bokeh-sphinx-bootstrap.js"'
    assert html.count(marker) == 1
    html = html.replace(marker, '<script src="_static/bokeh-sphinx-consumer.js"></script>\n' + marker)
    index.write_text(html, encoding="utf-8")


def _build_static_page(tmp_path: Path, source_text: str) -> Path:
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
    (source / "index.rst").write_text(source_text, encoding="utf-8")
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
    return output


def _page_result(page: Any) -> dict[str, Any]:
    return page.evaluate("""async () => {
      const targets = [...document.querySelectorAll("[data-bokeh-page-artifact][data-bokeh-root]")]
      const mounts = await Promise.all(targets.map((target) => Bokeh.when_mounted(target)))
      const firstKey = targets[0].dataset.bokehPageArtifact
      const firstTargets = targets.filter((target) => target.dataset.bokehPageArtifact === firstKey)
      const firstMount = mounts[0]
      const earlyMount = await window.sphinxEarlyMount
      return {
        targetCount: targets.length,
        sameArtifactMount: firstTargets.every((target) => target.bokehMount === firstMount),
        earlyIsPublishedMount: earlyMount === firstMount,
        mountedAttributes: targets.map((target) => target.getAttribute("data-bokeh-mounted")),
        hasSphinxRegistry: document.querySelector("[data-bokeh-page-payload-url]").bokehMounts !== undefined,
      }
    }""")


def test_static_page_renders_with_request_and_size_budgets(tmp_path: Path) -> None:
    output = _build_static_page(tmp_path,
        "Browser\n=======\n\n"
        ".. bokeh-plot::\n   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n"
        "   first = figure(width=240, height=160)\n"
        "   second = figure(width=180, height=120)\n"
        "   first.scatter([1, 2], [3, 4])\n"
        "   second.line([1, 2], [4, 3])\n"
        "   show([first, second])\n\n"
        ".. bokeh-plot::\n   :source-position: none\n\n"
        "   from bokeh.io import show\n"
        "   from bokeh.models import Button\n"
        "   show(Button(label='ready'))\n",
    )
    _inject_early_consumer(output)

    generated = output / "_static" / "bokeh-plot"
    payloads = list(generated.glob("bokeh-plot-*.json"))
    assert len(payloads) == 1
    assert payloads[0].stat().st_size < 100_000
    assert (generated / "bokeh-sphinx-bootstrap.js").stat().st_size < 8_000
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
            assert page.locator("[data-bokeh-mounted]").count() == 3
            assert page.get_by_text("ready", exact=True).count() == 1
            assert _page_result(page) == {
                "targetCount": 3,
                "sameArtifactMount": True,
                "earlyIsPublishedMount": True,
                "mountedAttributes": ["", "", ""],
                "hasSphinxRegistry": False,
            }
            initial_plot_requests = [url for url in requests if "/_static/bokeh-plot/" in url]
            assert len(initial_plot_requests) == len(set(initial_plot_requests)) == 5
            disposed = page.evaluate("""async () => {
              const targets = [...document.querySelectorAll("[data-bokeh-page-artifact][data-bokeh-root]")]
              const firstKey = targets[0].dataset.bokehPageArtifact
              const firstTargets = targets.filter((target) => target.dataset.bokehPageArtifact === firstKey)
              await targets[0].bokehMount.dispose()
              const cleared = firstTargets.every((target) =>
                target.bokehMount === undefined && !target.hasAttribute("data-bokeh-mounted"))
              const declaration = document.querySelector("[data-bokeh-page-payload-url]")
              const page = await fetch(declaration.dataset.bokehPagePayloadUrl).then((response) => response.json())
              const artifact = page.artifacts.find((entry) => entry.key === firstKey).artifact
              const remounted = Bokeh.mount(artifact, {
                targets: new Map(firstTargets.map((target) => [target.dataset.bokehRoot, target])),
                resources: "none",
              })
              await remounted.ready
              const reacquired = await Promise.all(firstTargets.map((target) => Bokeh.when_mounted(target)))
              return {
                cleared,
                remounted: reacquired.every((mount) => mount === remounted),
                siblingStillMounted: targets.at(-1).bokehMount?.state === "ready",
              }
            }""")
            assert disposed == {"cleared": True, "remounted": True, "siblingStillMounted": True}
            browser.close()
    finally:
        server.shutdown()
        thread.join()
        server.server_close()

    assert errors == []
    bokeh_requests = [url for url in requests if "/vendor/js/bokeh" in url]
    assert len(bokeh_requests) == len(set(bokeh_requests)) == 3
    plot_requests = [url for url in requests if "/_static/bokeh-plot/" in url]
    assert len(plot_requests) == 6
    assert len(set(plot_requests)) == 5  # remount deliberately re-fetches the page payload


@pytest.mark.parametrize(
    "failure", ["missing-payload", "page-schema", "artifact-schema", "resource", "bootstrap"],
)
def test_pre_handle_failures_reject_early_and_late_consumers(tmp_path: Path, failure: str) -> None:
    output = _build_static_page(
        tmp_path,
        "Failure\n=======\n\n.. bokeh-plot::\n   :source-position: none\n\n"
        "   from bokeh.io import show\n"
        "   from bokeh.models import Button\n"
        "   show([Button(label='first'), Button(label='second')])\n",
    )
    _inject_early_consumer(output)
    [payload_path] = (output / "_static" / "bokeh-plot").glob("bokeh-plot-*.json")
    if failure == "missing-payload":
        payload_path.unlink()
    elif failure in ("page-schema", "artifact-schema"):
        payload = json.loads(payload_path.read_text(encoding="utf-8"))
        if failure == "page-schema":
            payload["schema"] = "bokeh.embed-page/invalid"
        else:
            payload["artifacts"][0]["artifact"]["schema"] = "bokeh.embed/invalid"
        payload_path.write_text(json.dumps(payload), encoding="utf-8")
    elif failure == "resource":
        (output / "_static" / "bokeh-plot" / "vendor" / "js" / "bokeh-widgets.min.js").unlink()
    else:
        index = output / "index.html"
        html = index.read_text(encoding="utf-8")
        html = re.sub(r' data-bokeh-page-payload-url="[^"]+"', "", html, count=1)
        index.write_text(html, encoding="utf-8")

    handler = partial(_QuietHandler, directory=str(output))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with playwright.sync_playwright() as manager:
            browser = manager.chromium.launch()
            page = browser.new_page()
            response = page.goto(f"http://127.0.0.1:{server.server_port}/index.html", wait_until="networkidle")
            assert response is not None and response.ok
            result = page.evaluate("""async () => {
              const target = document.querySelector('[data-bokeh-root="root-0"]')
              const key = target.dataset.bokehPageArtifact
              const targets = [...document.querySelectorAll("[data-bokeh-page-artifact][data-bokeh-root]")]
                .filter((candidate) => candidate.dataset.bokehPageArtifact === key)
              const early = await window.sphinxEarlyResult
              const late = await Promise.all(targets.map((candidate) =>
                Bokeh.when_mounted(candidate).then(
                  () => ({ok: true}),
                  (error) => ({ok: false, error}),
                ),
              ))
              return {
                earlyOk: early.ok,
                lateOk: late.some((result) => result.ok),
                sameError: late.every((result, index) =>
                  result.error === early.error && result.error === targets[index].bokehMountError),
                kind: late[0].error.kind,
                phase: late[0].error.phase,
                mounted: targets.some((candidate) =>
                  candidate.bokehMount !== undefined || candidate.hasAttribute("data-bokeh-mounted")),
              }
            }""")
            assert result["earlyOk"] is False
            assert result["lateOk"] is False
            assert result["sameError"] is True
            assert result["mounted"] is False
            assert result["kind"] in {"source", "schema", "decode", "http"}
            assert result["phase"] in {"bootstrap", "payload", "schema", "deserialize"}
            browser.close()
    finally:
        server.shutdown()
        thread.join()
        server.server_close()

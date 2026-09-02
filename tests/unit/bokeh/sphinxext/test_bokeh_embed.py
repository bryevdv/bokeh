from __future__ import annotations

# Standard library imports
import json
import os
from io import StringIO
from pathlib import Path
from typing import Any, Mapping

# External imports
import pytest
from sphinx.application import Sphinx

# Bokeh imports
from bokeh.embed import EmbedArtifact


def _project(tmp_path: Path, *, config: str = "") -> tuple[Path, Path, Path]:
    source = tmp_path / "source"
    output = tmp_path / "output"
    doctrees = tmp_path / "doctrees"
    source.mkdir(parents=True)
    (source / "conf.py").write_text(
        "extensions = ['bokeh.sphinxext.bokeh_embed']\n"
        "project = 'bokeh-embed-test'\n"
        f"{config}\n",
        encoding="utf-8",
    )
    return source, output, doctrees


def _build(source: Path, output: Path, doctrees: Path, *, builder: str = "html",
        freshenv: bool = True, force_all: bool = True, parallel: int = 1) -> tuple[Sphinx, str]:
    status = StringIO()
    warning = StringIO()
    app = Sphinx(
        srcdir=source,
        confdir=source,
        outdir=output,
        doctreedir=doctrees,
        buildername=builder,
        status=status,
        warning=warning,
        freshenv=freshenv,
        parallel=parallel,
    )
    app.build(force_all=force_all)
    assert app.statuscode == 0, warning.getvalue()
    return app, warning.getvalue()


def _payloads(output: Path) -> list[Path]:
    return sorted((output / "_static" / "bokeh-embed").glob("bokeh-embed-*.json"))


def test_html_build_aggregates_artifacts_and_exact_resources_once(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text(
        "Embeds\n=======\n\n"
        ".. toctree::\n\n"
        "   plain\n\n"
        ".. bokeh-embed::\n"
        "   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n"
        "   show(figure(width=200, height=100))\n\n"
        ".. bokeh-embed::\n"
        "   :source-position: none\n\n"
        "   from bokeh.io import show\n"
        "   from bokeh.models import Button\n"
        "   show(Button(label='click'))\n",
        encoding="utf-8",
    )
    (source / "plain.rst").write_text("Plain\n=====\n\nNo embeds here.\n", encoding="utf-8")

    _build(source, output, doctrees)

    html = (output / "index.html").read_text(encoding="utf-8")
    plain = (output / "plain.html").read_text(encoding="utf-8")
    assert html.count("data-bokeh-page-payload-url") == 1
    assert html.count("data-bokeh-page-artifact") == 2
    assert html.count("data-bokeh-artifact=") == 2
    assert html.count("/bokeh-") >= 1
    assert html.count("bokeh-widgets-") == 1
    assert html.count("bokeh-api-") == 1
    assert "bokeh-tables-" not in html
    assert "bokeh-gl-" not in html
    assert "bokeh-mathjax-" not in html
    assert "data-bokeh-page-payload-url" not in plain
    assert "cdn.bokeh.org" not in plain

    [payload_path] = _payloads(output)
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    assert payload["schema"] == "bokeh.embed-page/v1"
    assert len(payload["artifacts"]) == 2
    assert (output / "_static" / "bokeh-embed" / "bokeh-sphinx-bootstrap.js").is_file()


def test_html_build_delegates_target_lifecycle_to_the_shared_artifact_runtime(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text(
        "Lifecycle\n=========\n\n.. bokeh-embed::\n   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n   show([figure(), figure()])\n",
        encoding="utf-8",
    )

    _build(source, output, doctrees)
    html = (output / "index.html").read_text(encoding="utf-8")
    bootstrap = (
        output / "_static" / "bokeh-embed" / "bokeh-sphinx-bootstrap.js"
    ).read_text(encoding="utf-8")

    assert html.count('data-bokeh-root="root-0"') == 1
    assert html.count('data-bokeh-root="root-1"') == 1
    assert html.index("cdn.bokeh.org/bokeh/") < html.index("data-bokeh-page-artifact")
    assert html.index("data-bokeh-page-artifact") < html.index("bokeh-sphinx-bootstrap.js")
    assert "runtime.mount_artifact_declaration(declaration)" in bootstrap
    assert "runtime.publish_mount_error(target, error)" in bootstrap
    assert "Bokeh.mount(" not in bootstrap
    assert ".bokehMount =" not in bootstrap
    assert ".bokehMounts" not in bootstrap
    assert ".bokehMounted" not in bootstrap
    assert "data-bokeh-mounted" not in bootstrap


def test_multiple_show_calls_and_multiple_roots_use_logical_keys(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text(
        "Multiple\n========\n\n"
        ".. bokeh-embed::\n"
        "   :source-position: none\n\n"
        "   from bokeh.io import show\n"
        "   from bokeh.plotting import figure\n"
        "   first = figure()\n"
        "   second = figure()\n"
        "   third = figure()\n"
        "   show([first, second])\n"
        "   show(third)\n",
        encoding="utf-8",
    )

    _build(source, output, doctrees)
    html = (output / "index.html").read_text(encoding="utf-8")
    [payload_path] = _payloads(output)
    payload = json.loads(payload_path.read_text(encoding="utf-8"))

    assert html.count("data-bokeh-page-artifact") == 3
    assert [root["key"] for root in payload["artifacts"][0]["artifact"]["roots"]] == ["root-0", "root-1"]
    assert [root["key"] for root in payload["artifacts"][1]["artifact"]["roots"]] == ["root"]
    assert all("document" in root and "root" in root and "model_id" not in root
        for entry in payload["artifacts"] for root in entry["artifact"]["roots"])


def test_non_html_builder_emits_accessible_fallback_without_assets(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text(
        "Fallback\n========\n\n"
        ".. bokeh-embed::\n"
        "   :alt: Sales trend visualization\n"
        "   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n"
        "   show(figure())\n",
        encoding="utf-8",
    )

    _build(source, output, doctrees, builder="text")
    text = (output / "index.txt").read_text(encoding="utf-8")
    assert "Sales trend visualization" in text
    assert not (output / "_static" / "bokeh-embed").exists()


def test_quick_build_skips_execution_and_emits_fallback(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text(
        "Quick\n=====\n\n.. bokeh-embed::\n"
        "   :alt: Sales trend visualization\n"
        "   :source-position: none\n\n"
        "   raise RuntimeError('must not execute')\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("BOKEH_SPHINX_QUICK", "1")

    _build(source, output, doctrees)
    html = (output / "index.html").read_text(encoding="utf-8")
    assert "Sales trend visualization" in html
    assert "data-bokeh-page-payload-url" not in html


def test_renamed_directive_reports_an_actionable_migration(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text(
        "Legacy\n======\n\n.. bokeh-plot::\n\n   from bokeh.models import Button\n",
        encoding="utf-8",
    )

    with pytest.raises(Exception, match=r"bokeh-plot was renamed to bokeh-embed in Bokeh 4.0"):
        _build(source, output, doctrees)


def test_renamed_extension_reports_an_actionable_migration(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "conf.py").write_text(
        "extensions = ['bokeh.sphinxext.bokeh_plot']\nproject = 'legacy-extension'\n",
        encoding="utf-8",
    )
    (source / "index.rst").write_text("Legacy\n======\n", encoding="utf-8")

    with pytest.raises(Exception, match=r"bokeh.sphinxext.bokeh_plot was renamed"):
        _build(source, output, doctrees)


def test_renamed_config_reports_an_actionable_migration(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path, config="bokeh_plot_resources = 'cdn'")
    (source / "index.rst").write_text("Legacy\n======\n", encoding="utf-8")

    with pytest.raises(Exception, match="bokeh_plot_resources was renamed to bokeh_embed_resources"):
        _build(source, output, doctrees)


def test_incremental_external_dependency_is_deterministic_and_cleans_stale_payload(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    example = source / "plot.py"
    example.write_text(
        "from bokeh.plotting import figure, show\nshow(figure(width=100))\n", encoding="utf-8",
    )
    (source / "index.rst").write_text(
        "External\n========\n\n.. bokeh-embed:: plot.py\n   :source-position: none\n",
        encoding="utf-8",
    )

    _build(source, output, doctrees)
    [first] = _payloads(output)
    first_name = first.name

    _build(source, output, doctrees, freshenv=False, force_all=False)
    assert [path.name for path in _payloads(output)] == [first_name]

    example.write_text(
        "from bokeh.plotting import figure, show\nshow(figure(width=250))\n", encoding="utf-8",
    )
    stat = example.stat()
    os.utime(example, (stat.st_atime + 2, stat.st_mtime + 2))
    _build(source, output, doctrees, freshenv=False, force_all=False)
    [second] = _payloads(output)
    assert second.name != first_name
    assert not (second.parent / first_name).exists()


def test_incremental_build_recompiles_substituted_google_api_key(
        tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text(
        "API key\n=======\n\n.. bokeh-embed::\n   :source-position: none\n\n"
        "   from bokeh.io import show\n"
        "   from bokeh.models import Div\n"
        "   show(Div(text='GOOGLE_API_KEY'))\n",
        encoding="utf-8",
    )

    monkeypatch.setenv("GOOGLE_API_KEY", "first-test-key")
    _build(source, output, doctrees)
    [first] = _payloads(output)
    assert "first-test-key" in first.read_text(encoding="utf-8")

    monkeypatch.setenv("GOOGLE_API_KEY", "second-test-key")
    _build(source, output, doctrees, freshenv=False, force_all=False)
    [second] = _payloads(output)
    payload = second.read_text(encoding="utf-8")
    assert second.name != first.name
    assert "second-test-key" in payload
    assert "first-test-key" not in payload
    assert not first.exists()


def test_page_processing_decodes_and_renders_each_artifact_once(
        tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text(
        "Artifacts\n=========\n\n.. bokeh-embed::\n   :source-position: none\n\n"
        "   from bokeh.io import show\n"
        "   from bokeh.models import Div\n"
        "   show(Div(text='first'))\n"
        "   show(Div(text='second'))\n",
        encoding="utf-8",
    )
    original_from_dict = EmbedArtifact.from_dict
    original_fragment = EmbedArtifact.fragment
    decoded = 0
    rendered = 0

    def from_dict(cls: type[EmbedArtifact], value: Mapping[str, Any]) -> EmbedArtifact:
        nonlocal decoded
        decoded += 1
        return original_from_dict(value)

    def fragment(self: EmbedArtifact, *args: Any, **kwargs: Any) -> Any:
        nonlocal rendered
        rendered += 1
        return original_fragment(self, *args, **kwargs)

    monkeypatch.setattr(EmbedArtifact, "from_dict", classmethod(from_dict))
    monkeypatch.setattr(EmbedArtifact, "fragment", fragment)

    _build(source, output, doctrees)

    assert decoded == 2
    assert rendered == 2


def test_parallel_builds_produce_one_payload_per_page(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text(
        "Parallel\n========\n\n.. toctree::\n\n   first\n   second\n",
        encoding="utf-8",
    )
    for name in ("first", "second"):
        (source / f"{name}.rst").write_text(
            f"{name.title()}\n{'=' * len(name)}\n\n"
            ".. bokeh-embed::\n"
            "   :source-position: none\n\n"
            "   from bokeh.plotting import figure, show\n"
            f"   show(figure(title='{name}'))\n",
            encoding="utf-8",
        )

    _build(source, output, doctrees, parallel=2)
    assert len(_payloads(output)) == 2
    for name in ("first", "second"):
        html = (output / f"{name}.html").read_text(encoding="utf-8")
        assert html.count("data-bokeh-page-payload-url") == 1


def test_nested_pages_use_relative_asset_urls_without_html_suffixes(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "nested").mkdir()
    (source / "index.rst").write_text(
        "Nested\n======\n\n.. toctree::\n\n   nested/page\n", encoding="utf-8",
    )
    (source / "nested" / "page.rst").write_text(
        "Page\n====\n\n.. bokeh-embed::\n   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n   show(figure())\n",
        encoding="utf-8",
    )

    _build(source, output, doctrees)
    html = (output / "nested" / "page.html").read_text(encoding="utf-8")
    assert 'src="../_static/bokeh-embed/bokeh-sphinx-bootstrap.js"' in html
    assert "bokeh-sphinx-bootstrap.js.html" not in html
    assert ".json.html" not in html


@pytest.mark.parametrize("source_code, message", [
    (
        "from bokeh.application import Application\nfrom bokeh.io import show\nshow(Application())\n",
        "server application",
    ),
    (
        "from bokeh.plotting import figure, show\np = figure()\np.on_change('visible', lambda attr, old, new: None)\nshow(p)\n",
        "cannot execute Python callbacks",
    ),
])
def test_failures_are_source_located_and_actionable(tmp_path: Path, source_code: str, message: str) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text(
        "Failure\n=======\n\n.. bokeh-embed::\n   :source-position: none\n\n" +
        "\n".join(f"   {line}" for line in source_code.splitlines()) + "\n",
        encoding="utf-8",
    )

    with pytest.raises(Exception, match=message):
        _build(source, output, doctrees)


def test_csp_and_host_owned_policies_are_explicit(tmp_path: Path) -> None:
    source, output, doctrees = _project(
        tmp_path,
        config=(
            "bokeh_embed_resources = 'cdn'\n"
            "bokeh_embed_resource_options = {'nonce': 'docs-nonce'}\n"
        ),
    )
    (source / "index.rst").write_text(
        "CSP\n===\n\n.. bokeh-embed::\n   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n   show(figure())\n",
        encoding="utf-8",
    )
    _build(source, output, doctrees)
    html = (output / "index.html").read_text(encoding="utf-8")
    assert html.count('nonce="docs-nonce"') == 3  # core, API, and page bootstrap

    host_source, host_output, host_doctrees = _project(tmp_path / "host", config="bokeh_embed_resources = 'none'")
    (host_source / "index.rst").write_text(
        "Host\n====\n\n.. bokeh-embed::\n   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n   show(figure())\n",
        encoding="utf-8",
    )
    _build(host_source, host_output, host_doctrees)
    host_html = (host_output / "index.html").read_text(encoding="utf-8")
    assert "cdn.bokeh.org" not in host_html
    assert host_html.count("data-bokeh-page-payload-url") == 1


def test_duplicate_custom_extension_assets_are_emitted_once(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    directive = (
        ".. bokeh-embed::\n"
        "   :source-position: none\n\n"
        "   from bokeh.io import show\n"
        "   from bokeh.models import Div\n"
        "   class ExtensionDiv(Div):\n"
        "       __javascript__ = ['https://example.test/extension.js']\n"
        "   show(ExtensionDiv(text='extension'))\n"
    )
    (source / "index.rst").write_text(
        f"Extensions\n==========\n\n{directive}\n{directive}", encoding="utf-8",
    )

    _build(source, output, doctrees)
    html = (output / "index.html").read_text(encoding="utf-8")
    assert html.count("https://example.test/extension.js") == 1


def test_static_policy_copies_only_required_local_bundles(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path, config="bokeh_embed_resources = 'static'")
    (source / "index.rst").write_text(
        "Static\n======\n\n.. bokeh-embed::\n   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n   show(figure())\n",
        encoding="utf-8",
    )

    _build(source, output, doctrees)
    html = (output / "index.html").read_text(encoding="utf-8")
    vendor = output / "_static" / "bokeh-embed" / "vendor" / "js"
    assert (vendor / "bokeh.min.js").is_file()
    assert (vendor / "bokeh-api.min.js").is_file()
    assert not (vendor / "bokeh-widgets.min.js").exists()
    assert "_static/bokeh-embed/vendor/js/bokeh.min.js" in html


def test_tracking_manifest_removes_stale_bootstrap_payloads_and_vendor_assets(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path, config="bokeh_embed_resources = 'static'")
    index = source / "index.rst"
    index.write_text(
        "Tracked\n=======\n\n.. bokeh-embed::\n   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n   show(figure())\n",
        encoding="utf-8",
    )

    _build(source, output, doctrees)
    generated = output / "_static" / "bokeh-embed"
    assert (generated / "bokeh-sphinx-bootstrap.js").is_file()
    assert (generated / "vendor" / "js" / "bokeh.min.js").is_file()
    assert len(_payloads(output)) == 1

    index.write_text("Tracked\n=======\n\nNo embed remains.\n", encoding="utf-8")
    _build(source, output, doctrees, freshenv=False, force_all=False)
    html = (output / "index.html").read_text(encoding="utf-8")
    assert "data-bokeh-page-payload-url" not in html
    assert "bokeh-sphinx-bootstrap.js" not in html
    assert not (generated / "bokeh-sphinx-bootstrap.js").exists()
    assert not (generated / "vendor" / "js" / "bokeh.min.js").exists()
    assert _payloads(output) == []
    manifest = json.loads((generated / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["files"] == []


def test_build_removes_only_manifest_tracked_legacy_assets(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path)
    (source / "index.rst").write_text("Current\n=======\n", encoding="utf-8")

    legacy = output / "_static" / "bokeh-plot"
    payload = legacy / f"bokeh-plot-{'0' * 64}.json"
    bootstrap = legacy / "bokeh-sphinx-bootstrap.js"
    bundle = legacy / "vendor" / "js" / "bokeh.min.js"
    unmanaged = legacy / "keep.txt"
    bundle.parent.mkdir(parents=True)
    for path in (payload, bootstrap, bundle, unmanaged):
        path.write_text(path.name, encoding="utf-8")
    (legacy / "manifest.json").write_text(json.dumps({
        "schema": "bokeh.sphinx-assets/v1",
        "files": [payload.name, bootstrap.name, "vendor/js/bokeh.min.js"],
    }), encoding="utf-8")

    _build(source, output, doctrees)

    assert not payload.exists()
    assert not bootstrap.exists()
    assert not bundle.exists()
    assert not (legacy / "manifest.json").exists()
    assert unmanaged.read_text(encoding="utf-8") == "keep.txt"


def test_offline_policy_rejects_external_extension_with_source_context(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path, config="bokeh_embed_resources = 'offline'")
    (source / "index.rst").write_text(
        "Offline\n=======\n\n.. bokeh-embed::\n   :source-position: none\n\n"
        "   from bokeh.io import show\n"
        "   from bokeh.models import Div\n"
        "   class ExternalDiv(Div):\n"
        "       __javascript__ = ['https://example.test/extension.js']\n"
        "   show(ExternalDiv())\n",
        encoding="utf-8",
    )

    with pytest.raises(Exception, match="offline policy cannot load external script"):
        _build(source, output, doctrees)


def test_offline_policy_inlines_exact_bokeh_resources(tmp_path: Path) -> None:
    source, output, doctrees = _project(tmp_path, config="bokeh_embed_resources = 'offline'")
    (source / "index.rst").write_text(
        "Offline\n=======\n\n.. bokeh-embed::\n   :source-position: none\n\n"
        "   from bokeh.plotting import figure, show\n   show(figure())\n",
        encoding="utf-8",
    )

    _build(source, output, doctrees)
    html = (output / "index.html").read_text(encoding="utf-8")
    assert "/* BEGIN bokeh.min.js */" in html
    assert "/* BEGIN bokeh-api.min.js */" in html
    assert "/* BEGIN bokeh-widgets.min.js */" not in html
    assert '<script src="https://cdn.bokeh.org' not in html
    assert '<link rel="stylesheet" href="https://cdn.bokeh.org' not in html


def test_payload_names_are_stable_across_clean_build_directories(tmp_path: Path) -> None:
    names: list[str] = []
    for name in ("first", "second"):
        source, output, doctrees = _project(tmp_path / name)
        (source / "index.rst").write_text(
            "Stable\n======\n\n.. bokeh-embed::\n   :source-position: none\n\n"
            "   from bokeh.plotting import figure, show\n   show(figure(title='stable'))\n",
            encoding="utf-8",
        )
        _build(source, output, doctrees)
        names.append(_payloads(output)[0].name)
    assert names[0] == names[1]

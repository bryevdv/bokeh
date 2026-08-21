# -----------------------------------------------------------------------------
# Copyright (c) Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
# -----------------------------------------------------------------------------
"""Compile ``bokeh-plot`` directives into page-level embedding artifacts.

The directive executes ordinary example code through context-local output
capture, compiles the captured objects with :func:`bokeh.embed.embed`, and
stores versioned artifacts on the doctree. HTML writers aggregate every
artifact on a page into one deterministic payload and exact resource union.
Other writers receive an accessible textual fallback.
"""

from __future__ import annotations

from sphinx.util import logging  # isort:skip
log = logging.getLogger(__name__)

# Standard library imports
import hashlib
import json
import re
import warnings
from collections.abc import Mapping, Sequence
from heapq import nlargest
from html import escape
from importlib.metadata import PackageNotFoundError, distribution
from os import getenv, getpid, replace
from os.path import basename, join
from pathlib import Path
from time import perf_counter
from typing import Any, NamedTuple, cast

# External imports
from docutils import nodes
from docutils.parsers.rst.directives import choice, flag, unchanged
from sphinx.errors import SphinxError
from sphinx.util.nodes import set_source_info
from sphinx.util.osutil import copyfile, ensuredir, relative_uri

# Bokeh imports
from bokeh import __version__
from bokeh.document import Document
from bokeh.embed import (
    EmbedArtifact,
    ResourcePolicy,
    ResourceRequirements,
    embed,
)
from bokeh.embed.artifact import EMBED_ARTIFACT_SCHEMA
from bokeh.embed.renderers import render_resources
from bokeh.model import Model
from bokeh.resources import Resources
from bokeh.settings import settings
from bokeh.util.warnings import BokehDeprecationWarning

# Bokeh imports
from ._internal import PARALLEL_SAFE, SphinxParallelSpec
from ._internal.bokeh_directive import BokehDirective
from ._internal.example_handler import ExampleHandler
from ._internal.util import get_sphinx_resources

__all__ = ("BokehPlotDirective", "setup")

GOOGLE_API_KEY = getenv("GOOGLE_API_KEY")
PAGE_SCHEMA = "bokeh.embed-page/v1"
GENERATED_DIR = "bokeh-plot"
BOOTSTRAP_NAME = "bokeh-sphinx-bootstrap.js"
TRACKING_NAME = "manifest.json"


class _PlotTiming(NamedTuple):
    total: float
    evaluate: float
    serialize: float
    write: float
    docname: str
    source: str


class bokeh_artifact(nodes.General, nodes.Element):
    """A picklable doctree node containing compiled artifact envelopes."""


class BokehPlotDirective(BokehDirective):

    has_content = True
    optional_arguments = 2

    @staticmethod
    def _flag(value: str) -> bool:
        flag(value)
        return True

    option_spec = {
        "process-docstring": _flag,
        "source-position": lambda value: choice(value, ("below", "above", "none")),
        "linenos": _flag,
        "alt": unchanged,
    }

    def run(self) -> list[Any]:
        env = cast(Any, self.env)
        source, path, external = self.process_args_or_content()
        self.process_sampledata(source)

        process_docstring = self.options.get("process-docstring", False)
        above, below = self.process_code_block(source, _module_docstring(source))
        if getenv("BOKEH_SPHINX_QUICK") == "1":
            fallback = nodes.paragraph(
                "", self.options.get("alt", "Interactive Bokeh plot omitted from the quick documentation build."),
                classes=["bokeh-plot-fallback"],
            )
            set_source_info(self, fallback)
            return [*above, fallback, *below]

        source_fingerprint = _source_fingerprint(source, path, self.options, env, external=external)
        try:
            record = self.process_source(source, path, source_fingerprint)
        except Exception as error:
            source_name, line = self.get_source_info()
            location = f"{source_name}:{line}" if source_name is not None else env.docname
            raise SphinxError(f"{location}: bokeh-plot compilation failed: {error}") from error

        record["fallback"] = self.options.get(
            "alt", f"Interactive Bokeh plot with {record['root_count']} root(s); view the HTML documentation.",
        )
        page_records = env.bokeh_plot_pages.setdefault(env.docname, [])
        page_index = len(page_records)
        record["page_index"] = page_index
        page_records.append(record)

        dashed_docname = env.docname.replace("/", "-")
        target_id = f"bokeh-plot-{dashed_docname}-{page_index}-{source_fingerprint[:12]}"
        target = nodes.target("", "", ids=[target_id])
        set_source_info(self, target)

        artifact_node = bokeh_artifact()
        artifact_node["record"] = record
        set_source_info(self, artifact_node)

        docstring = cast(str | None, record.get("docstring"))
        intro = self.parse(docstring, "<bokeh-plot-docstring>") if docstring and process_docstring else []
        return [target, *intro, *above, artifact_node, *below]

    def process_code_block(self, source: str, docstring: str | None) -> tuple[list[Any], list[Any]]:
        source_position = self.options.get("source-position", "below")
        if source_position == "none":
            return [], []

        source = _remove_module_docstring(source, docstring).strip()
        code_block = nodes.literal_block(
            source, source, language="python", linenos=self.options.get("linenos", False), classes=[],
        )
        set_source_info(self, code_block)
        return ([code_block], []) if source_position == "above" else ([], [code_block])

    def process_args_or_content(self) -> tuple[str, str, bool]:
        if self.arguments and self.content:
            raise SphinxError("bokeh-plot:: directive can't have both args and content")

        env = cast(Any, self.env)
        if self.content:
            log.debug(f"[bokeh-plot] handling inline content in {env.docname!r}")
            return "\n".join(self.content), env.bokeh_plot_auxdir, False
        if not self.arguments:
            raise SphinxError("bokeh-plot:: directive requires a source path or inline Python content")

        path = self.arguments[0]
        log.debug(f"[bokeh-plot] handling external content in {env.docname!r}: {path}")
        if path.startswith("__REPO__/"):
            from ._internal import REPO_TOP
            path = join(REPO_TOP, path.removeprefix("__REPO__/"))
        elif not Path(path).is_absolute():
            path = join(env.srcdir, path)
        env.note_dependency(path)
        try:
            return Path(path).read_text(encoding="utf-8"), path, True
        except Exception as error:
            raise SphinxError(f"bokeh-plot:: error reading {path!r} for {env.docname!r}: {error!r}") from error

    def process_source(self, source: str, path: str, source_fingerprint: str) -> dict[str, Any]:
        env = cast(Any, self.env)
        started = perf_counter()
        cache_file = Path(env.bokeh_plot_cachedir) / f"{source_fingerprint}.json"
        cached = _read_cache(cache_file)
        if cached is not None:
            finished = perf_counter()
            env.bokeh_plot_timings.append(_PlotTiming(
                total=finished - started,
                evaluate=0.0,
                serialize=finished - started,
                write=0.0,
                docname=env.docname,
                source=basename(path),
            ))
            return cached

        callback_policy = env.config.bokeh_plot_callback_policy
        if callback_policy not in ("warn", "error", "suppress"):
            raise ValueError("bokeh_plot_callback_policy must be 'warn', 'error', or 'suppress'")

        document, handler = _evaluate_source(source, path, env)
        evaluated = perf_counter()
        outputs = [call.obj for call in handler.captured.outputs]
        if not outputs:
            if document.roots:
                outputs.append(document)
            outputs.extend(handler.documents)
        if not outputs:
            raise RuntimeError(
                "example produced no output; call show()/save(), add roots to curdoc(), "
                "or expose a populated Document",
            )

        artifacts: list[dict[str, Any]] = []
        heights: list[dict[str, int | None]] = []
        for index, output in enumerate(outputs):
            if callable(output) or getattr(output, "_is_a_bokeh_application_class", False):
                raise RuntimeError(
                    f"captured output {index} is a server application; bokeh-plot builds static artifacts only. "
                    "Use a server embed outside this directive or provide a standalone model with CustomJS callbacks",
                )
            artifact = embed(output, callback_policy=callback_policy)
            # Exercising the typed renderer here keeps the directive on the
            # common artifact/mount contract; page aggregation reuses its mounts.
            artifact.fragment(resources="none")
            artifacts.append(artifact.to_dict())
            heights.append(_artifact_heights(artifact, output))

        record = {
            "source_fingerprint": source_fingerprint,
            "artifacts": artifacts,
            "heights": heights,
            "root_count": sum(len(artifact["roots"]) for artifact in artifacts),
            "docstring": handler.doc.strip() if handler.doc else None,
            "captured_actions": [call.action for call in handler.captured.calls],
        }
        serialized = perf_counter()
        _write_json_atomic(cache_file, record)
        finished = perf_counter()
        env.bokeh_plot_timings.append(_PlotTiming(
            total=finished - started,
            evaluate=evaluated - started,
            serialize=serialized - evaluated,
            write=finished - serialized,
            docname=env.docname,
            source=basename(path),
        ))
        return record

    def process_sampledata(self, source: str) -> None:
        env = cast(Any, self.env)
        if not hasattr(env, "solved_sampledata"):
            env.solved_sampledata = []

        file, _ = self.get_source_info()
        if file is not None and "/docs/examples/" in file and file not in env.solved_sampledata:
            env.solved_sampledata.append(file)
            if not hasattr(env, "all_sampledata_xrefs"):
                env.all_sampledata_xrefs = []
            if not hasattr(env, "all_gallery_overview"):
                env.all_gallery_overview = []
            env.all_gallery_overview.append({"docname": env.docname})

            regex = r"(:|bokeh\.)sampledata(:|\.| import )\s*(\w+(\,\s*\w+)*)"
            matches = re.findall(regex, source)
            keywords: set[str] = set()
            for match in matches:
                keywords.update(match[2].replace(" ", "").split(","))
            for keyword in keywords:
                env.all_sampledata_xrefs.append({"docname": env.docname, "keyword": keyword})


def builder_inited(app: Any) -> None:
    app.env.bokeh_plot_auxdir = join(app.env.doctreedir, GENERATED_DIR)
    app.env.bokeh_plot_cachedir = join(app.env.bokeh_plot_auxdir, "cache")
    ensuredir(app.env.bokeh_plot_cachedir)
    if not hasattr(app.env, "bokeh_plot_pages"):
        app.env.bokeh_plot_pages = {}
    app.env.bokeh_plot_timings = []


def process_artifact_nodes(app: Any, doctree: Any, fromdocname: str) -> None:
    artifact_nodes = list(doctree.findall(bokeh_artifact))
    if not artifact_nodes:
        return
    if app.builder.format != "html":
        for node in artifact_nodes:
            fallback = nodes.paragraph("", node["record"]["fallback"], classes=["bokeh-plot-fallback"])
            fallback.source = node.source
            fallback.line = node.line
            node.replace_self(fallback)
        return

    records = [cast(dict[str, Any], node["record"]) for node in artifact_nodes]
    entries = _page_entries(fromdocname, records)
    artifacts = [entry["artifact"] for entry in entries]
    requirements = ResourceRequirements.union(
        *(EmbedArtifact.from_dict(artifact).requires for artifact in artifacts),
    )
    policy, policy_identity = _resource_policy(app, fromdocname)
    try:
        resolved = policy.resolve(requirements)
    except Exception as error:
        raise SphinxError(
            f"{fromdocname}: bokeh-plot resource policy {policy.mode!r} cannot satisfy page requirements: {error}",
        ) from error

    payload = {
        "schema": PAGE_SCHEMA,
        "bokeh_version": __version__,
        "artifacts": entries,
    }
    payload_name = _page_payload_name(fromdocname, records, policy_identity)
    generated_dir = Path(app.builder.outdir) / "_static" / GENERATED_DIR
    _write_json_atomic(generated_dir / payload_name, payload)
    _copy_bootstrap(generated_dir)

    page_uri = app.builder.get_target_uri(fromdocname)
    payload_uri = relative_uri(page_uri, f"_static/{GENERATED_DIR}/{payload_name}")
    bootstrap_uri = relative_uri(page_uri, f"_static/{GENERATED_DIR}/{BOOTSTRAP_NAME}")
    nonce = "" if policy.nonce is None else f' nonce="{escape(policy.nonce, quote=True)}"'
    bootstrap = (
        f'<script src="{escape(bootstrap_uri, quote=True)}" data-bokeh-page-payload-url='
        f'"{escape(payload_uri, quote=True)}"{nonce}></script>'
    )
    resource_tags = render_resources(resolved)

    entry_index = 0
    for node_index, node in enumerate(artifact_nodes):
        record = records[node_index]
        fragments: list[str] = []
        for artifact_index, artifact_dict in enumerate(record["artifacts"]):
            artifact = EmbedArtifact.from_dict(artifact_dict)
            fragment = artifact.fragment(resources="none")
            entry = entries[entry_index]
            entry_index += 1
            root_heights = record["heights"][artifact_index]
            for mount in fragment.mounts:
                mount_html = mount.html.replace(
                    f'data-bokeh-artifact="{artifact.fingerprint}"',
                    f'data-bokeh-page-artifact="{escape(entry["key"], quote=True)}"',
                )
                height = root_heights.get(mount.key)
                if height:
                    mount_html = mount_html.replace("<div ", f'<div style="min-height:{height}px" ')
                fragments.append(mount_html)
        if node_index == 0 and resource_tags:
            fragments.insert(0, resource_tags)
        if node_index == len(artifact_nodes) - 1:
            fragments.append(bootstrap)
        replacement = nodes.raw("", "\n".join(fragments), format="html")
        replacement.source = node.source
        replacement.line = node.line
        node.replace_self(replacement)


def purge_doc(app: Any, env: Any, docname: str) -> None:
    if hasattr(env, "bokeh_plot_pages"):
        env.bokeh_plot_pages.pop(docname, None)


def env_merge_info(app: Any, env: Any, docnames: list[str], other: Any) -> None:
    if not hasattr(env, "bokeh_plot_pages"):
        env.bokeh_plot_pages = {}
    docnames_set = set(docnames)
    for docname in docnames_set:
        records = getattr(other, "bokeh_plot_pages", {}).get(docname)
        if records is not None:
            env.bokeh_plot_pages[docname] = records
    env.bokeh_plot_timings.extend(item for item in other.bokeh_plot_timings if item.docname in docnames_set)


def build_finished(app: Any, exception: Exception | None) -> None:
    if exception is not None or app.builder.format != "html":
        return
    generated_dir = Path(app.builder.outdir) / "_static" / GENERATED_DIR
    ensuredir(generated_dir)

    pages = getattr(app.env, "bokeh_plot_pages", {})
    expected: set[str] = set()
    if pages:
        _copy_bootstrap(generated_dir)
        expected.add(BOOTSTRAP_NAME)
    for docname, records in sorted(pages.items()):
        _, identity = _resource_policy(app, docname)
        expected.add(_page_payload_name(docname, records, identity))
    expected.update(_copy_static_resources(app, pages))

    tracking = generated_dir / TRACKING_NAME
    previous = _read_json(tracking)
    previous_files = previous.get("files", []) if isinstance(previous, dict) else []
    for name in previous_files:
        if name not in expected and _is_tracked_asset(name):
            (generated_dir / name).unlink(missing_ok=True)

    _write_json_atomic(tracking, {"schema": "bokeh.sphinx-assets/v1", "files": sorted(expected)})

    timings = app.env.bokeh_plot_timings
    if timings:
        total_seconds = sum(item.total for item in timings)
        evaluate_seconds = sum(item.evaluate for item in timings)
        serialize_seconds = sum(item.serialize for item in timings)
        write_seconds = sum(item.write for item in timings)
        log.info(
            f"Bokeh plot timings: directives={len(timings)} total={total_seconds:.3f}s "
            f"evaluate={evaluate_seconds:.3f}s serialize={serialize_seconds:.3f}s write={write_seconds:.3f}s",
        )
        for timing in nlargest(5, timings, key=lambda timing: timing.total):
            log.info(
                f"Bokeh plot slow: total={timing.total:.3f}s evaluate={timing.evaluate:.3f}s "
                f"serialize={timing.serialize:.3f}s write={timing.write:.3f}s "
                f"{timing.docname} ({timing.source})",
            )

def setup(app: Any) -> SphinxParallelSpec:
    app.add_directive("bokeh-plot", BokehPlotDirective)
    app.add_node(bokeh_artifact)
    app.add_config_value("bokeh_missing_google_api_key_ok", True, "html")
    app.add_config_value("bokeh_plot_resources", None, "html")
    app.add_config_value("bokeh_plot_resource_options", {}, "html")
    app.add_config_value("bokeh_plot_callback_policy", "error", "env")
    app.connect("builder-inited", builder_inited)
    app.connect("doctree-resolved", process_artifact_nodes)
    app.connect("env-purge-doc", purge_doc)
    app.connect("env-merge-info", env_merge_info)
    app.connect("build-finished", build_finished)
    return PARALLEL_SAFE


def _replace_google_api_key(source: str, env: Any) -> str:
    if "GOOGLE_API_KEY" not in source:
        return source
    if GOOGLE_API_KEY is None:
        if env.config.bokeh_missing_google_api_key_ok:
            return source.replace("GOOGLE_API_KEY", "MISSING_API_KEY")
        raise SphinxError(
            "The GOOGLE_API_KEY environment variable is not set. Set GOOGLE_API_KEY to a valid API key, "
            "or set bokeh_missing_google_api_key_ok=True in conf.py to build anyway (with broken GMaps)",
        )
    return source.replace("GOOGLE_API_KEY", GOOGLE_API_KEY)


def _evaluate_source(source: str, filename: str, env: Any) -> tuple[Document, ExampleHandler]:
    source = _replace_google_api_key(source, env)
    handler = ExampleHandler(source=source, filename=filename)
    document = Document()
    with warnings.catch_warnings():
        if "reference" in env.docname:
            warnings.filterwarnings("ignore", category=BokehDeprecationWarning)
        handler.modify_document(document)
    if handler.error:
        raise RuntimeError(f"{handler.error_detail}\n\nevaluating source:\n\n{source}")
    return document, handler


def _module_docstring(source: str) -> str | None:
    import ast
    try:
        return ast.get_docstring(ast.parse(source), clean=False)
    except SyntaxError:
        return None


def _remove_module_docstring(source: str, docstring: str | None) -> str:
    if docstring is None:
        return source
    docstring = docstring.replace("\\", r"\\")
    return re.sub(rf'(\'\'\'|\"\"\")\s*{re.escape(docstring)}\s*(\'\'\'|\"\"\")', "", source)


def _source_fingerprint(source: str, path: str, options: Mapping[str, Any], env: Any, *, external: bool) -> str:
    if external:
        source_path = Path(path).resolve()
        origins = (Path(env.srcdir).resolve(), Path.cwd().resolve())
        origin = source_path.as_posix()
        for base in origins:
            try:
                origin = source_path.relative_to(base).as_posix()
                break
            except ValueError:
                pass
    else:
        origin = f"{env.docname}:inline"
    payload = {
        "schema": EMBED_ARTIFACT_SCHEMA,
        "bokeh_version": __version__,
        "origin": origin,
        "source": source,
        "options": dict(sorted(options.items())),
        "callback_policy": env.config.bokeh_plot_callback_policy,
    }
    return _sha256(payload)


def _artifact_heights(artifact: EmbedArtifact, output: Any) -> dict[str, int | None]:
    if isinstance(output, Document):
        roots = list(output.roots)
    elif isinstance(output, Model):
        roots = [output]
    elif isinstance(output, Mapping):
        roots = []
        for value in output.values():
            roots.extend(value.roots if isinstance(value, Document) else [value])
    elif isinstance(output, Sequence) and not isinstance(output, (str, bytes)):
        roots = []
        for value in output:
            roots.extend(value.roots if isinstance(value, Document) else [value])
    else:
        roots = []
    result: dict[str, int | None] = {}
    for descriptor, root in zip(artifact.roots, roots):
        hint = getattr(root, "_sphinx_height_hint", None)
        result[descriptor.key] = cast(int | None, hint() if callable(hint) else None)
    return result


def _page_entries(docname: str, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for record in records:
        for artifact_index, artifact in enumerate(record["artifacts"]):
            key = (
                f"{docname.replace('/', '-')}-{record['page_index']}-{artifact_index}-"
                f"{record['source_fingerprint'][:16]}"
            )
            entries.append({"key": key, "artifact": artifact})
    return entries


def _page_payload_name(docname: str, records: list[dict[str, Any]], policy_identity: Mapping[str, Any]) -> str:
    payload = {
        "schema": PAGE_SCHEMA,
        "bokeh_version": __version__,
        "docname": docname,
        "policy": policy_identity,
        "directives": [
            {
                "source": record["source_fingerprint"],
                "page_index": record["page_index"],
                "artifacts": [artifact["fingerprint"] for artifact in record["artifacts"]],
            }
            for record in records
        ],
    }
    return f"bokeh-plot-{_sha256(payload)}.json"


def _resource_policy(app: Any, docname: str) -> tuple[ResourcePolicy, dict[str, Any]]:
    configured = app.config.bokeh_plot_resources
    options = dict(app.config.bokeh_plot_resource_options or {})
    static = configured == "static" or (
        isinstance(configured, Mapping) and configured.get("mode") == "static"
    )
    if isinstance(configured, Mapping):
        data = dict(configured)
        data.update(options)
        mode = data.pop("mode", "cdn")
        if mode == "static":
            configured = "static"
            options = data
        else:
            if mode in ("inline", "offline") and "base_dir" not in data:
                data["base_dir"] = _bokehjs_path()
            policy = ResourcePolicy(mode=mode, **data)
            identity = policy.to_dict()
            identity.pop("root_dir", None)
            identity.pop("base_dir", None)
            return policy, identity
    if static:
        page_dir = Path(app.builder.get_outfilename(docname)).parent
        vendor = Path(app.builder.outdir) / "_static" / GENERATED_DIR / "vendor"
        policy = ResourcePolicy(mode="relative", root_dir=page_dir, base_dir=vendor, **options)
        identity = policy.to_dict()
        identity.pop("root_dir", None)
        identity.pop("base_dir", None)
        identity["delivery"] = "static"
        return policy, identity
    if configured is None:
        policy = ResourcePolicy.build(get_sphinx_resources(), **options)
    elif isinstance(configured, (ResourcePolicy, Resources, str)):
        if isinstance(configured, str) and configured in ("inline", "offline") and "base_dir" not in options:
            options["base_dir"] = _bokehjs_path()
        policy = ResourcePolicy.build(configured, **options)
    else:
        raise SphinxError(
            "bokeh_plot_resources must be None, a policy mode, 'static', Resources, ResourcePolicy, or mapping",
        )
    identity = policy.to_dict()
    identity.pop("root_dir", None)
    identity.pop("base_dir", None)
    return policy, identity


def _copy_static_resources(app: Any, pages: Mapping[str, list[dict[str, Any]]]) -> set[str]:
    static_pages = [docname for docname in pages if (
        app.config.bokeh_plot_resources == "static" or (
            isinstance(app.config.bokeh_plot_resources, Mapping) and
            app.config.bokeh_plot_resources.get("mode") == "static"
        )
    )]
    if not static_pages:
        return set()
    requirements = ResourceRequirements.union(*(
        EmbedArtifact.from_dict(artifact).requires
        for records in pages.values()
        for record in records
        for artifact in record["artifacts"]
    ))
    docname = static_pages[0]
    policy, _ = _resource_policy(app, docname)
    resolved = policy.resolve(requirements)
    vendor = Path(app.builder.outdir) / "_static" / GENERATED_DIR / "vendor"
    source_root = _bokehjs_path()
    copied: set[str] = set()
    for asset in resolved.assets:
        if asset.url is None:
            continue
        name = Path(asset.url).name
        kind = "js" if asset.kind == "script" else "css"
        source = Path(source_root) / kind / name
        if source.is_file():
            target = vendor / kind / name
            ensuredir(target.parent)
            copyfile(source, target)
            copied.add(f"vendor/{kind}/{name}")
    return copied


def _is_tracked_asset(name: str) -> bool:
    if name == BOOTSTRAP_NAME or re.fullmatch(r"bokeh-plot-[0-9a-f]{64}\.json", name):
        return True
    return re.fullmatch(r"vendor/(?:js|css)/bokeh(?:-[a-z-]+)?(?:\.min)?\.(?:js|css)", name) is not None


def _bokehjs_path() -> Path:
    configured = Path(settings.bokehjs_path())
    if (configured / "js" / "bokeh.min.js").is_file():
        return configured
    development = Path(__file__).parents[3] / "bokehjs" / "build"
    if (development / "js" / "bokeh.min.js").is_file():
        return development
    try:
        installed = Path(distribution("bokeh").locate_file("bokeh/server/static"))
    except PackageNotFoundError:
        installed = configured
    if not (installed / "js" / "bokeh.min.js").is_file():
        raise SphinxError(
            f"BokehJS static assets were not found at {configured}, {development}, or {installed}; "
            "install the matching Bokeh distribution or build BokehJS before using inline/offline/static resources",
        )
    return installed


def _copy_bootstrap(generated_dir: Path) -> None:
    ensuredir(generated_dir)
    source = Path(__file__).parent / "_internal" / "static" / BOOTSTRAP_NAME
    target = generated_dir / BOOTSTRAP_NAME
    if not target.exists() or target.read_bytes() != source.read_bytes():
        copyfile(source, target)


def _read_cache(path: Path) -> dict[str, Any] | None:
    value = _read_json(path)
    if not isinstance(value, dict):
        return None
    try:
        for artifact in value.get("artifacts", []):
            EmbedArtifact.from_dict(artifact)
    except Exception:
        log.warning(f"ignoring invalid bokeh-plot cache entry {path}")
        return None
    return value


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _write_json_atomic(path: Path, value: Any) -> None:
    ensuredir(path.parent)
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    temporary = path.with_name(f".{path.name}.{getpid()}.tmp")
    temporary.write_text(encoded, encoding="utf-8")
    replace(temporary, path)


def _sha256(value: Mapping[str, Any]) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

.. _bokeh.sphinxext:

bokeh.sphinxext
===============

Sphinx extensions for including Bokeh content in Sphinx documentation.

bokeh_embed
-----------

.. automodule:: bokeh.sphinxext.bokeh_embed

``bokeh-embed`` executes inline Python or an external example file and captures
ordinary calls to :func:`~bokeh.io.show` and :func:`~bokeh.io.save`. Each
captured value is compiled as a versioned :class:`~bokeh.embed.EmbedArtifact`.
Multiple output calls and multiple roots are supported and retain their order.
Calls imported before execution are captured without replacing
``bokeh.io``, ``bokeh.plotting``, or :class:`~bokeh.document.Document`.

For HTML builders, all directives on a page share one deterministic JSON
payload, one bootstrap, and the exact union of their required BokehJS bundles
and custom-extension assets. Pages without embedded Bokeh content receive no
Bokeh resources.
Incremental builds track external example files, and a generated-asset
manifest removes stale page payloads. Parallel readers merge page records
without sharing mutable module state.

The generated targets use the same target-local ``BokehMount`` lifecycle as
other artifact declarations. An external script may run before or after the
page bootstrap and acquire the handle from a logical-root target::

    const target = document.querySelector(
      "#my-embed-section [data-bokeh-root='root']",
    )
    const mounted = await Bokeh.when_mounted(target)
    await mounted.ready

Scope the selector to a stable section or application container when a page has
more than one embed. A multi-root artifact uses ``root-0``, ``root-1``, and so
on; every one of its targets publishes the same handle. Disposal and remounting
update those targets through the common lifecycle. Payload, schema, resource,
and other pre-handle failures make ``when_mounted()`` reject with a structured
``BokehMountError`` instead of leaving a consumer waiting indefinitely.

The directive options are:

``source-position``
    ``above``, ``below`` (the default), or ``none``.

``linenos``
    Display line numbers in the source block.

``process-docstring``
    Render the example's module docstring separately from its source.

``alt``
    Accessible fallback text for non-HTML and quick builders.

Projects select resource delivery with ``bokeh_embed_resources``. It accepts
``cdn``, ``inline``, ``offline``, ``static``, ``none``, any normal
:class:`~bokeh.embed.ResourcePolicy` mode, a ``Resources`` or
``ResourcePolicy`` object, or a mapping of policy fields. ``static`` copies
only the required local bundles under ``_static/bokeh-embed/vendor``. ``none``
means the host page already owns a compatible BokehJS runtime. Additional
policy fields such as ``nonce``, ``integrity``, ``crossorigin``, and
``external_only`` belong in ``bokeh_embed_resource_options``::

    bokeh_embed_resources = "cdn"
    bokeh_embed_resource_options = {
        "integrity": True,
        "crossorigin": "anonymous",
        "nonce": "documentation-csp-nonce",
    }

``offline`` rejects external custom-extension URLs rather than silently
creating a network-dependent build. ``inline`` and ``offline`` use packaged
BokehJS assets (or a task-local development build). ``static`` keeps page
payloads and the shared bootstrap external, which works with an external-only
content security policy. With ``none``, the host must load a compatible BokehJS
artifact runtime and satisfy the exact bundle and custom-extension requirements
of every page before the Sphinx bootstrap runs; the extension does not fall
back to a second resource loader.

Static artifacts cannot run Python callbacks. By default, the directive treats
them as an error with source location and recommends ``CustomJS`` or a Bokeh
server. Set ``bokeh_embed_callback_policy`` to ``warn`` or ``suppress`` only
when a project intentionally accepts that limitation. Bokeh server
applications are not valid directive output.

Bokeh 4.0 migration
~~~~~~~~~~~~~~~~~~~

The extension and directive were renamed because they embed any supported
Bokeh content, including layouts, widgets, tables, and custom models—not only
plots. Update projects as follows:

* ``bokeh.sphinxext.bokeh_plot`` becomes
  ``bokeh.sphinxext.bokeh_embed``.
* ``.. bokeh-plot::`` becomes ``.. bokeh-embed::``.
* ``bokeh_plot_resources``, ``bokeh_plot_resource_options``, and
  ``bokeh_plot_callback_policy`` become ``bokeh_embed_resources``,
  ``bokeh_embed_resource_options``, and ``bokeh_embed_callback_policy``.
* Generated assets move from ``_static/bokeh-plot`` to
  ``_static/bokeh-embed``. A successful build with the renamed extension
  removes assets listed in the old directory's manifest.

The old extension path, directive, and configuration names produce actionable
migration errors instead of silently selecting different behavior.

The extension no longer calls ``autoload_static()`` and does not emit a
UUID-named JavaScript program for each directive. Projects that customized or
copied those generated programs should instead configure
``bokeh_embed_resources`` and serve the deterministic page payloads generated
under ``_static/bokeh-embed``. Examples may keep ``output_file()`` and
``output_notebook()`` calls for source compatibility; during directive
execution these calls are captured as inert output configuration and do not
change global state. Custom wrappers should consume :func:`bokeh.embed.embed`
and its typed renderers rather than reconstructing autoload or ``RenderItem``
markup. Code that inspected a generated bootstrap's private mount collection or
waited for its load order should select the intended ``data-bokeh-root`` target
and call ``Bokeh.when_mounted()`` instead.

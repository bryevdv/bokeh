.. _bokeh.sphinxext:

bokeh.sphinxext
===============

Sphinx extensions for including Bokeh content in Sphinx documentation.

bokeh_plot
----------

.. automodule:: bokeh.sphinxext.bokeh_plot

``bokeh-plot`` executes inline Python or an external example file and captures
ordinary calls to :func:`~bokeh.io.show` and :func:`~bokeh.io.save`. Each
captured value is compiled as a versioned :class:`~bokeh.embed.EmbedArtifact`.
Multiple output calls and multiple roots are supported and retain their order.
Calls imported before execution are captured without replacing
``bokeh.io``, ``bokeh.plotting``, or :class:`~bokeh.document.Document`.

For HTML builders, all directives on a page share one deterministic JSON
payload, one bootstrap, and the exact union of their required BokehJS bundles
and custom-extension assets. Pages without plots receive no Bokeh resources.
Incremental builds track external example files, and a generated-asset
manifest removes stale page payloads. Parallel readers merge page records
without sharing mutable module state.

The directive options are:

``source-position``
    ``above``, ``below`` (the default), or ``none``.

``linenos``
    Display line numbers in the source block.

``process-docstring``
    Render the example's module docstring separately from its source.

``alt``
    Accessible fallback text for non-HTML and quick builders.

Projects select resource delivery with ``bokeh_plot_resources``. It accepts
``cdn``, ``inline``, ``offline``, ``static``, ``none``, any normal
:class:`~bokeh.embed.ResourcePolicy` mode, a ``Resources`` or
``ResourcePolicy`` object, or a mapping of policy fields. ``static`` copies
only the required local bundles under ``_static/bokeh-plot/vendor``. ``none``
means the host page already owns a compatible BokehJS runtime. Additional
policy fields such as ``nonce``, ``integrity``, ``crossorigin``, and
``external_only`` belong in ``bokeh_plot_resource_options``::

    bokeh_plot_resources = "cdn"
    bokeh_plot_resource_options = {
        "integrity": True,
        "crossorigin": "anonymous",
        "nonce": "documentation-csp-nonce",
    }

``offline`` rejects external custom-extension URLs rather than silently
creating a network-dependent build. ``inline`` and ``offline`` use packaged
BokehJS assets (or a task-local development build). ``static`` keeps page
payloads and the shared bootstrap external, which works with an external-only
content security policy.

Static artifacts cannot run Python callbacks. By default, the directive treats
them as an error with source location and recommends ``CustomJS`` or a Bokeh
server. Set ``bokeh_plot_callback_policy`` to ``warn`` or ``suppress`` only
when a project intentionally accepts that limitation. Bokeh server
applications are not valid directive output.

Bokeh 4.0 migration
~~~~~~~~~~~~~~~~~~~

The extension no longer calls ``autoload_static()`` and does not emit a
UUID-named JavaScript program for each directive. Projects that customized or
copied those generated programs should instead configure
``bokeh_plot_resources`` and serve the deterministic page payloads generated
under ``_static/bokeh-plot``. Examples may keep ``output_file()`` and
``output_notebook()`` calls for source compatibility; during directive
execution these calls are captured as inert output configuration and do not
change global state. Custom wrappers should consume :func:`bokeh.embed.embed`
and its typed renderers rather than reconstructing autoload or ``RenderItem``
markup.

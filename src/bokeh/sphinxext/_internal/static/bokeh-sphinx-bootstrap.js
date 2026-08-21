void (async () => {
  function page_targets() {
    return [...document.querySelectorAll("[data-bokeh-page-artifact][data-bokeh-root]")]
      .filter((target) => target instanceof HTMLElement)
  }

  function page_error(runtime, error, {kind, message, phase, url}) {
    if (error instanceof runtime.MountError) {
      return error
    }
    return new runtime.MountError(
      kind, message, error, undefined, phase, {kind: "artifact-declaration", url},
    )
  }

  function publish_page_error(runtime, targets, error) {
    for (const target of targets) {
      runtime.publish_mount_error(target, error)
    }
  }

  async function load_page(runtime, script, targets) {
    const payload_url = script.dataset.bokehPagePayloadUrl
    if (payload_url == null) {
      const error = page_error(runtime, undefined, {
        kind: "source",
        message: "the Bokeh Sphinx bootstrap requires a page payload URL",
        phase: "bootstrap",
      })
      publish_page_error(runtime, targets, error)
      throw error
    }

    let response
    try {
      response = await fetch(payload_url)
    } catch (cause) {
      const error = page_error(runtime, cause, {
        kind: "http",
        message: `Bokeh Sphinx payload request failed: ${cause}`,
        phase: "payload",
        url: payload_url,
      })
      publish_page_error(runtime, targets, error)
      throw error
    }
    if (!response.ok) {
      const error = page_error(runtime, undefined, {
        kind: "http",
        message: `Bokeh Sphinx payload request failed: ${response.status} ${response.statusText}`,
        phase: "payload",
        url: payload_url,
      })
      publish_page_error(runtime, targets, error)
      throw error
    }

    let page
    try {
      page = await response.json()
    } catch (cause) {
      const error = page_error(runtime, cause, {
        kind: "decode",
        message: `failed to decode the Bokeh Sphinx payload: ${cause}`,
        phase: "payload",
        url: payload_url,
      })
      publish_page_error(runtime, targets, error)
      throw error
    }
    if (page?.schema !== "bokeh.embed-page/v1" || !Array.isArray(page.artifacts)) {
      const error = page_error(runtime, undefined, {
        kind: "schema",
        message: `unsupported Bokeh Sphinx payload schema '${page?.schema}'`,
        phase: "schema",
        url: payload_url,
      })
      publish_page_error(runtime, targets, error)
      throw error
    }
    return page
  }

  function artifact_declarations(runtime, script, targets, page) {
    const markers = []
    const declarations = []
    const target_keys = new Set(targets.map((target) => target.dataset.bokehPageArtifact))
    const entry_keys = new Set()
    for (const entry of page.artifacts) {
      if (entry == null || typeof entry.key !== "string") {
        throw new runtime.MountError(
          "schema", "a Bokeh Sphinx artifact entry requires a string key",
          undefined, undefined, "schema", {kind: "artifact-declaration"},
        )
      }
      if (entry_keys.has(entry.key)) {
        throw new runtime.MountError(
          "schema", `duplicate Bokeh Sphinx artifact key '${entry.key}'`,
          undefined, undefined, "schema", {kind: "artifact-declaration"},
        )
      }
      entry_keys.add(entry.key)
      const entry_targets = targets.filter((target) => target.dataset.bokehPageArtifact === entry.key)
      const fingerprint = entry_targets[0]?.dataset.bokehArtifact
      if (fingerprint == null) {
        throw new runtime.MountError(
          "target", `missing Bokeh Sphinx target for artifact '${entry.key}'`,
          undefined, undefined, "target", {kind: "artifact-declaration"},
        )
      }
      if (entry_targets.some((target) => target.dataset.bokehArtifact !== fingerprint)) {
        throw new runtime.MountError(
          "target", `inconsistent Bokeh Sphinx targets for artifact '${entry.key}'`,
          undefined, undefined, "target", {kind: "artifact-declaration", artifact: fingerprint},
        )
      }
      const roots = entry.artifact?.roots
      if (Array.isArray(roots) && roots.every((root) => typeof root?.key === "string")) {
        const declared_roots = new Set(roots.map((root) => root.key))
        const target_roots = new Set(entry_targets.map((target) => target.dataset.bokehRoot))
        if (declared_roots.size !== target_roots.size ||
            [...declared_roots].some((key) => !target_roots.has(key))) {
          throw new runtime.MountError(
            "target", `Bokeh Sphinx roots do not match targets for artifact '${entry.key}'`,
            undefined, undefined, "target", {kind: "artifact-declaration", artifact: fingerprint},
          )
        }
      }

      const payload = document.createElement("script")
      payload.type = "application/vnd.bokeh.embed+json"
      payload.dataset.bokehArtifactPayload = ""
      payload.dataset.bokehArtifact = fingerprint
      payload.textContent = JSON.stringify(entry.artifact)

      const declaration = document.createElement("script")
      declaration.type = "application/vnd.bokeh.embed-declaration+json"
      declaration.dataset.bokehArtifactBootstrap = ""
      declaration.dataset.bokehArtifact = fingerprint
      markers.push(payload, declaration)
      declarations.push(declaration)
    }
    if (target_keys.size !== entry_keys.size || [...target_keys].some((key) => !entry_keys.has(key))) {
      throw new runtime.MountError(
        "target", "Bokeh Sphinx page artifacts do not match their declaration targets",
        undefined, undefined, "target", {kind: "artifact-declaration"},
      )
    }
    script.after(...markers)
    return {declarations, markers}
  }

  const targets = page_targets()
  const runtime = globalThis.Bokeh
  if (runtime == null || typeof runtime.mount_artifact_declaration !== "function" ||
      typeof runtime.publish_mount_error !== "function") {
    throw new Error("the Bokeh Sphinx bootstrap requires the Bokeh artifact runtime")
  }

  const script = document.currentScript
  if (!(script instanceof HTMLScriptElement)) {
    const error = page_error(runtime, undefined, {
      kind: "source",
      message: "the Bokeh Sphinx bootstrap requires its declaration script",
      phase: "bootstrap",
    })
    publish_page_error(runtime, targets, error)
    throw error
  }

  const page = await load_page(runtime, script, targets)
  let markers = []
  let declarations
  try {
    ({declarations, markers} = artifact_declarations(runtime, script, targets, page))
  } catch (cause) {
    const error = page_error(runtime, cause, {
      kind: "schema",
      message: `invalid Bokeh Sphinx page declaration: ${cause}`,
      phase: "schema",
      url: script.dataset.bokehPagePayloadUrl,
    })
    publish_page_error(runtime, targets, error)
    throw error
  }

  try {
    const results = await Promise.allSettled(
      declarations.map((declaration) => runtime.mount_artifact_declaration(declaration)),
    )
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Failed to mount a Bokeh Sphinx artifact", result.reason)
      }
    }
  } finally {
    for (const marker of markers) {
      marker.remove()
    }
  }
})().catch((error) => {
  console.error("Failed to mount Bokeh Sphinx artifacts", error)
})

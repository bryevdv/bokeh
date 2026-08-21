void (async () => {
  const script = document.currentScript
  if (!(script instanceof HTMLScriptElement)) {
    throw new Error("the Bokeh Sphinx bootstrap requires its declaration script")
  }
  const payloadUrl = script.dataset.bokehPagePayloadUrl
  if (payloadUrl == null) {
    throw new Error("the Bokeh Sphinx bootstrap requires a page payload URL")
  }

  const response = await fetch(payloadUrl)
  if (!response.ok) {
    throw new Error(`Bokeh Sphinx payload request failed: ${response.status} ${response.statusText}`)
  }
  const page = await response.json()
  if (page.schema !== "bokeh.embed-page/v1" || !Array.isArray(page.artifacts)) {
    throw new Error(`unsupported Bokeh Sphinx payload schema '${page.schema}'`)
  }

  const handles = []
  for (const entry of page.artifacts) {
    const targets = new Map()
    for (const root of entry.artifact.roots) {
      const candidates = document.querySelectorAll(
        "[data-bokeh-page-artifact][data-bokeh-root]:not([data-bokeh-mounted])",
      )
      const target = [...candidates].find((candidate) =>
        candidate.dataset.bokehPageArtifact === entry.key && candidate.dataset.bokehRoot === root.key)
      if (!(target instanceof HTMLElement)) {
        throw new Error(`missing Bokeh Sphinx target for artifact '${entry.key}' root '${root.key}'`)
      }
      targets.set(root.key, target)
    }

    const handle = Bokeh.mount(entry.artifact, {targets, resources: "none"})
    for (const target of targets.values()) {
      target.dataset.bokehMounted = entry.artifact.fingerprint
      target.bokehMount = handle
    }
    try {
      await handle.ready
    } catch (error) {
      for (const target of targets.values()) {
        delete target.dataset.bokehMounted
        delete target.bokehMount
      }
      throw error
    }
    handles.push(handle)
  }
  script.bokehMounts = handles
})().catch((error) => {
  console.error("Failed to mount Bokeh Sphinx artifacts", error)
})

import {expect} from "#framework/assertions"

import {mount} from "@bokehjs/api/io"
import * as embed from "@bokehjs/embed"
import * as Bokeh from "@bokehjs/index"
import {Document} from "@bokehjs/document"
import {HasProps} from "@bokehjs/core/has_props"
import {DOMElementView} from "@bokehjs/core/dom_view"
import {defer} from "@bokehjs/core/util/defer"

class SomeView extends DOMElementView {
  render(): void {
    this.el.style.width = "100px"
    this.el.style.height = "100px"
    this.el.style.backgroundColor = "red"
    this.finish()
  }
}

class ModelWithoutView extends HasProps {}

class ModelWithView extends HasProps {
  declare __view_type__: SomeView

  static {
    this.prototype.default_view = SomeView
  }
}

describe("embed", () => {
  describe("mount()", () => {
    it("notifies idle on models without views", async () => {
      const doc = new Document()
      doc.add_root(ModelWithoutView.create())
      doc.add_root(ModelWithView.create())
      const mounted = mount(doc, document.body)
      await mounted.ready
      await defer() // wait one full loop for NotificationsView; unfortunately view.ready isn't in sync
      try {
        expect(doc.is_idle).to.be.true
      } finally {
        await mounted.dispose()
      }
    })
  })

  it("keeps rendered views scoped to their owning manager", async () => {
    const doc = new Document({roots: [ModelWithView.create()]})
    const mounted = mount(doc, document.body)
    await mounted.ready
    try {
      const views = [...mounted.view_lookup]
      expect(views.length).to.be.equal(2) // root + notifications
      const [view] = views
      expect(mounted.view_lookup.find_one(view.model)).to.be.equal(view)
      expect("index" in embed).to.be.false
      expect("index" in Bokeh).to.be.false
      expect("documents" in Bokeh).to.be.false
    } finally {
      await mounted.dispose()
    }
  })
})

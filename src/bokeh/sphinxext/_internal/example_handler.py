# -----------------------------------------------------------------------------
# Copyright (c) Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Boilerplate
# -----------------------------------------------------------------------------
from __future__ import annotations

import logging  # isort:skip
log = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Imports
# -----------------------------------------------------------------------------

# Standard library imports
from typing import TYPE_CHECKING

# Bokeh imports
from bokeh.application.handlers.code_runner import CodeRunner
from bokeh.application.handlers.handler import Handler
from bokeh.document import Document
from bokeh.io._output_capture import OutputCapture, capture_output
from bokeh.io.doc import patch_curdoc

if TYPE_CHECKING:
    from bokeh.core.types import PathLike

# -----------------------------------------------------------------------------
# Globals and constants
# -----------------------------------------------------------------------------

__all__ = (
    "ExampleHandler",
)

# -----------------------------------------------------------------------------
# General API
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Dev API
# -----------------------------------------------------------------------------


class ExampleHandler(Handler):
    """Execute example code with context-local output capture."""

    def __init__(self, source: str, filename: PathLike) -> None:
        super().__init__()
        self._runner = CodeRunner(source, filename, ())
        self._capture = OutputCapture()
        self._documents: tuple[Document, ...] = ()

    def modify_document(self, doc: Document) -> None:
        if self.failed:
            return

        module = self._runner.new_module()
        assert module is not None

        doc.modules.add(module)

        with patch_curdoc(doc), capture_output(doc) as captured:
            self._runner.run(module, lambda: None)
        self._capture = captured

        documents: list[Document] = []
        for value in module.__dict__.values():
            if isinstance(value, Document) and value.roots and value is not doc and value not in documents:
                documents.append(value)
        self._documents = tuple(documents)

    @property
    def failed(self) -> bool:
        return self._runner.failed

    @property
    def error(self) -> str | None:
        return self._runner.error

    @property
    def error_detail(self) -> str | None:
        return self._runner.error_detail

    @property
    def doc(self) -> str | None:
        return self._runner.doc

    @property
    def captured(self) -> OutputCapture:
        return self._capture

    @property
    def documents(self) -> tuple[Document, ...]:
        return self._documents

# -----------------------------------------------------------------------------
# Private API
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Code
# -----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# Copyright (c) Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------
"""Context-local capture for hosts that execute ordinary Bokeh output code."""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..document import Document


@dataclass(frozen=True)
class CapturedOutput:
    action: str
    obj: Any = None
    args: tuple[Any, ...] = ()
    kwargs: dict[str, Any] = field(default_factory=dict)


@dataclass
class OutputCapture:
    document: Document | None = None
    calls: list[CapturedOutput] = field(default_factory=list)

    @property
    def outputs(self) -> tuple[CapturedOutput, ...]:
        return tuple(call for call in self.calls if call.action in ("show", "save"))

    def record(self, action: str, obj: Any, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        self.calls.append(CapturedOutput(action, obj, args, kwargs))
        if action in ("show", "save"):
            self._add_document_roots(obj)

    def _add_document_roots(self, obj: Any) -> None:
        if self.document is None:
            return

        from ..document import Document
        from ..model import Model

        if isinstance(obj, Document):
            roots = obj.roots
        elif isinstance(obj, Model):
            roots = [obj]
        elif isinstance(obj, Sequence) and not isinstance(obj, (str, bytes)):
            roots = [root for root in obj if isinstance(root, Model)]
        else:
            roots = []

        for root in roots:
            if root.document is None or root.document is self.document:
                if root not in self.document.roots:
                    self.document.add_root(root)


@contextmanager
def capture_output(document: Document | None = None) -> Iterator[OutputCapture]:
    """Capture output calls in the current context without replacing modules."""
    capture = OutputCapture(document)
    token = _CAPTURES.set((*_CAPTURES.get(), capture))
    try:
        yield capture
    finally:
        _CAPTURES.reset(token)


def record_output(action: str, obj: Any = None, *args: Any, **kwargs: Any) -> bool:
    captures = _CAPTURES.get()
    if not captures:
        return False
    captures[-1].record(action, obj, args, kwargs)
    return True


_CAPTURES: ContextVar[tuple[OutputCapture, ...]] = ContextVar("_CAPTURES", default=())


__all__ = ("CapturedOutput", "OutputCapture", "capture_output", "record_output")

#-----------------------------------------------------------------------------
# Copyright (c) Anaconda, Inc., and Bokeh Contributors.
# All rights reserved.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------
"""Notebook host adapter for the shared embedding compiler.

Notebook output deliberately has no private document envelope or browser
rendering path. Both static and live initial state are ordinary
``EmbedArtifact`` values; the only distinction is whether canonical IDs are
retained for a later patch protocol.
"""

from __future__ import annotations

# Standard library imports
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING

# Bokeh imports
from .artifact import EmbedArtifact
from .compiler import embed, embed_protocol
from .util import FromCurdoc, ThemeSource

if TYPE_CHECKING:
    from ..document import Document
    from ..model import Model
    from .renderers import ArtifactFragment

__all__ = ("notebook_content",)


type NotebookContent = Model | Document | Sequence[Model | Document] | Mapping[str, Model | Document]


def notebook_content(content: NotebookContent, *, theme: ThemeSource = FromCurdoc,
        live: bool = False) -> tuple[EmbedArtifact, ArtifactFragment]:
    """Compile notebook content and its host-owned fragment.

    ``live=True`` retains protocol-visible model IDs so comm patches address
    the same graph. The returned fragment resolves no resources: the notebook
    host owns one explicit, shared resource policy for all displays.
    """
    compiler = embed_protocol if live else embed
    artifact = compiler(content, theme=theme, _always_new=True)
    return artifact, artifact.fragment(resources="none")

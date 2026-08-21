import type {ClientSession} from "../client/session"
import {parse_token, pull_session} from "../client/connection"
import {logger} from "../core/logging"
import type {ViewManager} from "../core/view_manager"
import type {Document} from "../document"

import {add_document_standalone} from "./standalone"
import type {EmbedTarget} from "./dom"

// @internal
export function _get_ws_url(app_path: string | undefined, absolute_url: string | undefined): string {
  // if in an `srcdoc` iframe, try to get the absolute URL
  // from the `data-absolute-url` attribute if not passed explicitly
  if (absolute_url === undefined && _is_frame_HTMLElement(frameElement) && frameElement.dataset.absoluteUrl !== undefined) {
    absolute_url = frameElement.dataset.absoluteUrl
  }

  let loc: HTMLAnchorElement | Location
  if (absolute_url != null) {
    loc = document.createElement("a")
    loc.href = absolute_url
  } else {
    loc = window.location
  }

  const protocol = loc.protocol == "https:" ? "wss:" : "ws:"
  if (app_path != null) {
    if (app_path == "/") {
      app_path = ""
    }
  } else {
    app_path = loc.pathname.replace(/\/+$/, "")
  }

  return `${protocol}//${loc.host}${app_path}/ws`
}

function _is_frame_HTMLElement(frame: Element | null): frame is HTMLIFrameElement {
  // `frameElement` is a delicate construct; it allows the document inside the frame to access
  // some (but not all) properties of the parent element in which the frame document is embedded.
  // Because it lives in a different DOM context than the frame's `window`, we cannot just use
  // `frameElement instanceof HTMLIFrameElement`; we could use `window.parent.HTMLIFrameElement`
  // but this can be blocked by CORS policy and throw an exception.
  if (frame === null) {
    return false
  }
  if (frame.tagName.toUpperCase() === "IFRAME") {
    return true
  }
  return false
}

type WebSocketURL = string
type SessionID = string

const _sessions: Map<WebSocketURL, Map<SessionID, Promise<ClientSession>>> = new Map()
const _document_sessions = new WeakMap<Document, {session: ClientSession, websocket_url: WebSocketURL, session_id: SessionID}>()
const _cancelled_elements = new Map<string, ReturnType<typeof setTimeout>>()
const _cancelled_element_timeout = 30_000

function _close_session(session: ClientSession, websocket_url: WebSocketURL, session_id: SessionID): void {
  session.close()
  const sessions = _sessions.get(websocket_url)
  sessions?.delete(session_id)
  if (sessions?.size == 0) {
    _sessions.delete(websocket_url)
  }
}

export function cancel_session_for_element(element_id: string): void {
  const previous = _cancelled_elements.get(element_id)
  if (previous != null) {
    clearTimeout(previous)
  }
  const timeout = setTimeout(() => _cancelled_elements.delete(element_id), _cancelled_element_timeout)
  _cancelled_elements.set(element_id, timeout)
}

function _take_cancelled_element(element_id: string | undefined): boolean {
  if (element_id == null) {
    return false
  }
  const timeout = _cancelled_elements.get(element_id)
  if (timeout == null) {
    return false
  }
  clearTimeout(timeout)
  _cancelled_elements.delete(element_id)
  return true
}

function _get_session(websocket_url: string, token: string, args_string: string): Promise<ClientSession> {
  const session_id = parse_token(token).session_id
  if (!_sessions.has(websocket_url)) {
    _sessions.set(websocket_url, new Map())
  }

  const subsessions = _sessions.get(websocket_url)!
  if (!subsessions.has(session_id)) {
    subsessions.set(session_id, pull_session(websocket_url, token, args_string))
  }

  return subsessions.get(session_id)!
}

// Fill element with the roots from token
export async function add_document_from_session(websocket_url: string, token: string, element: EmbedTarget,
    roots: EmbedTarget[] = [], use_for_title: boolean = false, element_id?: string): Promise<ViewManager> {
  const session_id = parse_token(token).session_id
  const args_string = window.location.search.substring(1)
  let session: ClientSession
  try {
    session = await _get_session(websocket_url, token, args_string)
  } catch (error) {
    const sessions = _sessions.get(websocket_url)
    sessions?.delete(session_id)
    if (sessions?.size == 0) {
      _sessions.delete(websocket_url)
    }
    logger.error(`Failed to load Bokeh session ${session_id}: ${error}`)
    throw error
  }
  if (_take_cancelled_element(element_id)) {
    _close_session(session, websocket_url, session_id)
    throw new DOMException("Session rendering was cancelled", "AbortError")
  }
  try {
    const manager = await add_document_standalone(session.document, element, roots, use_for_title)
    if (_take_cancelled_element(element_id)) {
      manager.clear()
      throw new DOMException("Session rendering was cancelled", "AbortError")
    }
    _document_sessions.set(session.document, {session, websocket_url, session_id})
    return manager
  } catch (error) {
    _close_session(session, websocket_url, session_id)
    logger.error(`Failed to render Bokeh session ${session_id}: ${error}`)
    throw error
  }
}

export function close_session_for_document(document: Document): boolean {
  const entry = _document_sessions.get(document)
  if (entry == null) {
    return false
  }
  _document_sessions.delete(document)
  _close_session(entry.session, entry.websocket_url, entry.session_id)
  return true
}

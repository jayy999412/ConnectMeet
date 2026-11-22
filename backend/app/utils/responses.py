"""Consistent JSON helpers used by every route."""

from flask import jsonify


def ok(data=None, status: int = 200, message: str | None = None):
    """Successful response envelope.

    The payload is merged flat into the body and `message` is the reserved
    status key — do not pass a payload that also uses the key `message`
    together with the `message=` status argument (the status wins).
    """
    body = dict(data) if isinstance(data, dict) else {}
    if message:
        body["message"] = message
    if data is not None and not isinstance(data, dict):
        body = {"data": data}
    return jsonify(body), status


def err(message: str, status: int = 400, errors: dict | None = None, code: str | None = None):
    """Error response envelope: { "message": ..., "errors": {...} }"""
    body = {"message": message}
    if errors:
        body["errors"] = errors
    if code:
        body["code"] = code
    return jsonify(body), status


def validation_error(errors: dict):
    return err("Please fix the highlighted fields.", 422, errors=errors)

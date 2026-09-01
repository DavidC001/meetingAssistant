"""Regression guard against circular imports across app.*.

The dependency graph has a few deliberate, documented layering inversions
(e.g. app.core.llm.tools -> app.modules.projects.service) that are only kept
acyclic by deferred (function-local) imports and TYPE_CHECKING guards — see
the comments in app/core/llm/tools.py and app/modules/projects/service.py.
Nothing stops a future top-level import from turning one of those into a
real ImportError at module-load time, and that failure mode is easy to miss
locally since it only shows up once every module on the cycle is imported
together. This test imports every app.* module standalone and fails loudly
if any of them raises ImportError.

app.main is skipped: it eagerly builds a SQLAlchemy engine against the
configured DATABASE_URL and fails with OperationalError outside the Docker
network (e.g. host "db" unresolvable) even when import wiring is correct —
that's a live-DB-connectivity concern, not a circular-import one.
app.scripts.* is skipped: those are standalone CLI entry points that assume
being run as scripts (some via a sys.path hack), not imported as a package.
"""

import importlib
import os
import pkgutil

import pytest

import app

_SKIP_MODULES = {"app.main"}
_SKIP_PACKAGES = ("app.scripts",)


def _iter_app_modules():
    for module_info in pkgutil.walk_packages(app.__path__, prefix="app."):
        name = module_info.name
        if name in _SKIP_MODULES or name.startswith(_SKIP_PACKAGES):
            continue
        yield name


@pytest.mark.unit
def test_all_app_modules_import_cleanly():
    """Every app.* module (except app.main and app.scripts.*) must import standalone."""
    os.environ.setdefault("SKIP_STARTUP_DB_INIT", "1")

    failures = []
    for name in _iter_app_modules():
        try:
            importlib.import_module(name)
        except ImportError as exc:
            failures.append(f"{name}: {type(exc).__name__}: {exc}")

    assert not failures, "Circular or broken imports detected:\n" + "\n".join(failures)

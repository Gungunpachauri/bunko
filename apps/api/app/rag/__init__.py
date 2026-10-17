"""AI core: hybrid retrieval over located passages, spoiler-safe filtering, and cited answers."""

import os
import sys

# onnxruntime needs the VC++ 2015-2022 runtime. On machines without it system-wide, the `msvc-runtime`
# package drops the DLLs into the virtualenv, which Windows only searches when told to.
if sys.platform == "win32" and hasattr(os, "add_dll_directory"):
    for _dir in {sys.prefix, os.path.join(sys.prefix, "Scripts")}:
        if os.path.isdir(_dir):
            os.add_dll_directory(_dir)

# Windows without Developer Mode can't symlink; the model cache works anyway, so skip the warning.
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

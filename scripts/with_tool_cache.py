#!/usr/bin/env python3
"""Run a local tool with shared download caches and a worktree activity lock."""
import fcntl
import os
from pathlib import Path
import subprocess
import sys

from workspace_maintenance import cache_root, git, worktree_lock


def main():
    args = sys.argv[1:]
    install = bool(args and args[0] == '--browser-install')
    if install:
        args.pop(0)
    if args and args[0] == '--':
        args.pop(0)
    if not args:
        raise SystemExit('Usage: with_tool_cache.py [--browser-install] -- COMMAND [ARGS...]')
    root = Path(git(Path.cwd(), 'rev-parse', '--show-toplevel').decode().strip())
    cache = cache_root()
    for name in ['npm', 'playwright', 'pip']:
        p = cache / name
        if p.is_symlink():
            raise RuntimeError('Symlink cache subdirectory refused')
        p.mkdir(mode=0o700, exist_ok=True)
    env = dict(os.environ)
    env.update(NPM_CONFIG_CACHE=str(cache / 'npm'),
               PLAYWRIGHT_BROWSERS_PATH=str(cache / 'playwright'), PIP_CACHE_DIR=str(cache / 'pip'))
    activity = worktree_lock(root)
    browser = None
    try:
        # All wrappers hold a shared browser lock; installation/GC takes exclusive access.
        fd = os.open(cache / 'browser-install.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        browser = os.fdopen(fd, 'w')
        fcntl.flock(browser, fcntl.LOCK_EX if install else fcntl.LOCK_SH)
        return subprocess.call(args, env=env)
    finally:
        if browser:
            browser.close()
        activity.close()


if __name__ == '__main__':
    raise SystemExit(main())

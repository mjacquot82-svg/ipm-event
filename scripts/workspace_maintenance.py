#!/usr/bin/env python3
"""Conservative IPM cache maintenance. No deletion without --apply."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

CACHE_PATHS = (
    '.pytest_cache', '.mypy_cache', '.ruff_cache',
    'frontend/.expo', 'frontend/.metro-cache', 'frontend/.cache',
    'frontend/.next', 'frontend/dist', 'frontend/build', 'frontend/web-build',
    'frontend/test-results', 'frontend/playwright-report',
)


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.PIPE)


def cache_root():
    path = Path(os.environ.get('IPM_TOOL_CACHE_ROOT', f'/tmp/ipm-tool-cache-{os.getuid()}'))
    if not path.is_absolute() or path.is_symlink():
        raise RuntimeError('Cache root must be an absolute, non-symlink path')
    for parent in path.parents:
        if parent.is_symlink():
            raise RuntimeError('Symlink in cache root ancestry')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.stat().st_uid != os.getuid():
        raise RuntimeError('Cache root is not owned by this user')
    os.chmod(path, 0o700)
    return path


def worktree_lock(root, exclusive=False):
    name = hashlib.sha256(str(root.resolve()).encode()).hexdigest()[:24]
    path = cache_root() / ('worktree-' + name + '.lock')
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    handle = os.fdopen(fd, 'w')
    try:
        fcntl.flock(handle, (fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH) | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        raise RuntimeError('Worktree is active or maintenance is already running') from None
    return handle


def repository(path):
    root = Path(git(path, 'rev-parse', '--show-toplevel').decode().strip()).resolve()
    if root != Path(path).resolve():
        raise RuntimeError('Pass the exact worktree root')
    for marker in ('MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'index.lock'):
        marker_path = Path(git(root, 'rev-parse', '--path-format=absolute', '--git-path', marker).decode().strip())
        if marker_path.exists():
            raise RuntimeError('Repository operation in progress: ' + marker)
    return root


def inspect_candidate(root, rel, days):
    path = root / rel
    result = {'path': str(path), 'bytes': 0, 'eligible': False}
    if not path.exists() and not path.is_symlink():
        return None
    if path.is_symlink() or any(p.is_symlink() for p in path.parents if p != root):
        return result | {'reason': 'symlink; never followed or removed'}
    if not path.is_dir():
        return result | {'reason': 'not a directory'}
    if git(root, 'ls-files', '-z', '--', rel):
        return result | {'reason': 'contains tracked files; preserve'}
    if subprocess.run(['git', '-C', str(root), 'check-ignore', '-q', '--', rel]).returncode:
        return result | {'reason': 'not ignored; may contain source'}
    newest = path.stat().st_mtime
    seen = set()
    for base, dirs, files in os.walk(path, followlinks=False):
        for name in dirs + files:
            item = Path(base) / name
            if item.is_symlink() or name == '.git':
                return result | {'reason': 'nested symlink/repository; preserve'}
            st = item.stat()
            if st.st_dev != path.stat().st_dev:
                return result | {'reason': 'nested filesystem; preserve'}
            newest = max(newest, st.st_mtime)
            inode = (st.st_dev, st.st_ino)
            if inode not in seen:
                result['bytes'] += st.st_blocks * 512
                seen.add(inode)
    if newest > time.time() - days * 86400:
        return result | {'reason': 'too recent'}
    return result | {'eligible': True, 'reason': 'known ignored regeneratable directory'}


def cleanup(root, apply=False, days=7):
    root = repository(root)
    lock = worktree_lock(root, exclusive=True) if apply else None
    try:
        before = shutil.disk_usage(root).free
        rows = []
        for rel in CACHE_PATHS:
            row = inspect_candidate(root, rel, days)
            if row is None:
                continue
            if apply and row['eligible']:
                # Recheck immediately before removal. Use with_tool_cache.py for build/test locks.
                check = inspect_candidate(root, rel, days)
                if check != row:
                    raise RuntimeError('Candidate changed during inspection: ' + rel)
                shutil.rmtree(root / rel)
                row['removed'] = True
            rows.append(row)
        return {'mode': 'apply' if apply else 'dry-run', 'root': str(root), 'candidates': rows,
                'estimated_bytes': sum(r['bytes'] for r in rows if r['eligible']),
                'filesystem_free_delta_bytes': shutil.disk_usage(root).free - before if apply else 0}
    finally:
        if lock:
            lock.close()


def remove_worktree(root, target, apply=False, confirm_head=None):
    root = repository(root)
    target_path = Path(target)
    if target_path.is_symlink():
        raise RuntimeError('Worktree path is a symlink')
    target = repository(target_path)
    records = git(root, 'worktree', 'list', '--porcelain').decode().split('\n\n')
    paths = [Path(b.splitlines()[0][9:]).resolve() for b in records if b.strip()]
    if target not in paths or target == paths[0] or target == root:
        raise RuntimeError('Only a separately registered linked worktree can be removed')
    lock = worktree_lock(target, exclusive=True) if apply else None
    try:
        head = git(target, 'rev-parse', 'HEAD').decode().strip()
        if git(target, 'status', '--porcelain', '--untracked-files=all').strip():
            raise RuntimeError('Worktree has tracked changes or untracked files')
        if git(target, 'ls-files', '--others', '--ignored', '--exclude-standard', '-z').strip():
            raise RuntimeError('Worktree contains ignored files; review/preserve them separately')
        remote = git(root, 'ls-remote', '--heads', 'origin').decode().splitlines()
        refs = [line.split()[0] for line in remote]
        preserved = any(subprocess.run(['git', '-C', str(root), 'merge-base', '--is-ancestor', head, sha],
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
                        for sha in refs)
        if not preserved:
            raise RuntimeError('Cannot prove HEAD ancestry in a current remote branch; fetch/review first')
        result = {'mode': 'apply' if apply else 'dry-run', 'worktree': str(target), 'head': head,
                  'branch_retained': True, 'remote_preserved': True}
        if apply:
            if confirm_head != head:
                raise RuntimeError('--confirm-head must equal the full reviewed HEAD SHA')
            before = shutil.disk_usage(target).free
            git(root, 'worktree', 'remove', str(target))
            result['filesystem_free_delta_bytes'] = shutil.disk_usage(target.parent).free - before
        return result
    finally:
        if lock:
            lock.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--apply', action='store_true', help='Explicitly delete eligible artifacts')
    parser.add_argument('--older-than-days', type=int, default=7)
    parser.add_argument('--remove-worktree', type=Path, help='Separate explicit worktree removal mode')
    parser.add_argument('--confirm-head', help='Required full SHA for worktree removal with --apply')
    args = parser.parse_args()
    if args.older_than_days < 0:
        parser.error('Retention cannot be negative')
    try:
        result = (remove_worktree(args.repo, args.remove_worktree, args.apply, args.confirm_head)
                  if args.remove_worktree else cleanup(args.repo, args.apply, args.older_than_days))
        print(json.dumps(result, indent=2))
    except (RuntimeError, subprocess.CalledProcessError, OSError) as error:
        parser.exit(2, 'REFUSED: ' + str(error) + '\n')


if __name__ == '__main__':
    main()

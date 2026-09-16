"""Filesystem safety checks; every fixture is disposable and local."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('maintenance', Path(__file__).parents[1] / 'workspace_maintenance.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class MaintenanceSafety(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='ipm-maintenance-test-')
        self.root = Path(self.tmp.name) / 'repo'
        self.root.mkdir()
        self.git('init', '-q')
        self.git('config', 'user.name', 'Local test')
        self.git('config', 'user.email', 'local@example.invalid')
        (self.root / '.gitignore').write_text('frontend/.metro-cache/\nfrontend/dist/\nnode_modules/\n')
        self.git('add', '.gitignore')
        self.git('commit', '-qm', 'fixture')

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args], stderr=subprocess.PIPE)

    def cache(self):
        p = self.root / 'frontend/.metro-cache'
        p.mkdir(parents=True)
        (p / 'generated').write_bytes(b'x' * 8192)
        return p

    def test_default_dry_run_and_source_preservation(self):
        p = self.cache()
        source = self.root / 'unique.py'
        source.write_text('keep me')
        result = m.cleanup(self.root, days=0)
        self.assertGreater(result['estimated_bytes'], 0)
        self.assertTrue(p.exists())
        m.cleanup(self.root, apply=True, days=0)
        self.assertFalse(p.exists())
        self.assertEqual(source.read_text(), 'keep me')

    def test_tracked_output_and_dependencies_never_deleted(self):
        p = self.root / 'frontend/dist'
        p.mkdir(parents=True)
        (p / 'index.html').write_text('production asset')
        self.git('add', '-f', 'frontend/dist/index.html')
        deps = self.root / 'node_modules'
        deps.mkdir()
        (deps / 'only-working-copy').write_text('keep')
        m.cleanup(self.root, apply=True, days=0)
        self.assertTrue((p / 'index.html').exists())
        self.assertTrue((deps / 'only-working-copy').exists())

    def test_external_symlink_never_followed(self):
        p = self.cache()
        outside = Path(self.tmp.name) / 'important'
        outside.write_text('keep')
        (p / 'escape').symlink_to(outside)
        m.cleanup(self.root, apply=True, days=0)
        self.assertTrue(p.exists())
        self.assertEqual(outside.read_text(), 'keep')

    def test_recent_cache_and_unignored_directory_preserved(self):
        p = self.cache()
        m.cleanup(self.root, apply=True)
        self.assertTrue(p.exists())
        (self.root / '.gitignore').write_text('')
        m.cleanup(self.root, apply=True, days=0)
        self.assertTrue(p.exists())

    def test_active_worktree_and_ambiguous_git_state_refused(self):
        self.cache()
        with m.worktree_lock(self.root):
            with self.assertRaises(RuntimeError):
                m.cleanup(self.root, apply=True, days=0)
        (self.root / '.git/MERGE_HEAD').write_text('active')
        with self.assertRaises(RuntimeError):
            m.cleanup(self.root, apply=True, days=0)

    def test_explicit_worktree_mode_requires_sha_and_keeps_branch(self):
        remote = Path(self.tmp.name) / 'remote.git'
        subprocess.run(['git', 'init', '--bare', '-q', str(remote)], check=True)
        self.git('remote', 'add', 'origin', str(remote))
        self.git('push', '-q', 'origin', 'HEAD:refs/heads/main')
        child = Path(self.tmp.name) / 'child'
        self.git('worktree', 'add', '-qb', 'completed', str(child))
        head = self.git('rev-parse', 'HEAD').decode().strip()
        m.remove_worktree(self.root, child)
        self.assertTrue(child.exists())
        with self.assertRaises(RuntimeError):
            m.remove_worktree(self.root, child, apply=True, confirm_head='wrong')
        (child / 'unique.txt').write_text('source')
        with self.assertRaises(RuntimeError):
            m.remove_worktree(self.root, child, apply=True, confirm_head=head)
        (child / 'unique.txt').unlink()
        m.remove_worktree(self.root, child, apply=True, confirm_head=head)
        self.assertFalse(child.exists())
        self.assertEqual(self.git('rev-parse', 'completed').decode().strip(), head)


if __name__ == '__main__':
    unittest.main()

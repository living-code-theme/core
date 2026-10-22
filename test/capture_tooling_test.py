"""Offline contract tests for the vendorable native capture runner. No application/display is launched."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import struct
import sys
import tempfile
import unittest
import zlib

sys.dont_write_bytecode = True
SOURCE = Path(__file__).resolve().parents[1] / 'templates/capture/capture.py'
spec = importlib.util.spec_from_file_location('capture_tooling', SOURCE)
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)


def calibration_png():
    # Explicit synthetic test raster, never an application screenshot or published port asset.
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 2560, 1600, 8, 2, 0, 0, 0)) + chunk(
        b'IDAT', zlib.compress((b'\0' + b'\x10\x20\x30' * 2560) * 1600)) + chunk(b'IEND', b'')


class CaptureContract(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='living-code-capture-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        files = {'port.json': json.dumps({'flavors': ['night', 'paper'], 'files': ['themes/night.json'],
                 'images': [{'flavor': f, 'path': f'images/{f}.png'} for f in ('night', 'paper')]}),
                 'palette/theme.json': '{}', 'capture/config.json': '{"fixtures":[]}',
                 'capture/app.py': '# Adapter fixture, not a real app', 'capture/flake.nix': '# Locked environment fixture',
                 'capture/flake.lock': '{}', 'themes/night.json': '{"color":"#123456"}', 'scripts/capture.py': SOURCE.read_text()}
        for name, data in files.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(data)
        (self.root / 'images').mkdir()
        for flavor in ('night', 'paper'):
            (self.root / 'images' / (flavor + '.png')).write_bytes(calibration_png())
        self.record = {'schemaVersion': 1, 'inputs': capture.inputs(self.root), 'images': {
            f: {'path': f'images/{f}.png', 'sha256': capture.digest(self.root / 'images' / (f + '.png')),
                'application': 'Synthetic contract-test fixture, not a native capture',
                'paletteColors': ['#123456', '#abcdef']} for f in ('night', 'paper')}}
        self.save_record()

    def save_record(self):
        (self.root / 'images/capture.json').write_text(json.dumps(self.record))

    def test_current_capture_validation_is_read_only_and_needs_no_display(self):
        before = {str(path.relative_to(self.root)): capture.digest(path) for path in self.root.rglob('*') if path.is_file()}
        self.assertEqual(capture.check(self.root), self.record)
        self.assertEqual(capture.png_size(self.root / 'images/night.png'), (2560, 1600))
        self.assertEqual(before, {str(path.relative_to(self.root)): capture.digest(path) for path in self.root.rglob('*') if path.is_file()})

    def test_payload_recipe_runtime_palette_and_descriptor_changes_invalidate_captures(self):
        for name in ('themes/night.json', 'capture/app.py', 'capture/flake.lock', 'palette/theme.json', 'port.json'):
            with self.subTest(input=name):
                path = self.root / name
                original = path.read_text()
                path.write_text(original + '\n')
                with self.assertRaisesRegex(ValueError, 'stale'):
                    capture.check(self.root)
                path.write_text(original)

    def test_changed_png_missing_flavor_and_unproven_images_are_rejected(self):
        original = (self.root / 'images/night.png').read_bytes()
        (self.root / 'images/night.png').write_bytes(original + b'changed')
        with self.assertRaisesRegex(ValueError, 'damaged|changed'):
            capture.check(self.root)
        (self.root / 'images/night.png').write_bytes(original)
        self.record['images'].pop('paper')
        self.save_record()
        with self.assertRaisesRegex(ValueError, 'Every supported flavor'):
            capture.check(self.root)

    def test_old_smaller_images_cannot_pass_even_with_a_matching_hash(self):
        path = self.root / 'images/night.png'
        data = bytearray(path.read_bytes())
        data[16:24] = struct.pack('>II', 1280, 800)
        path.write_bytes(data)
        self.record['images']['night']['sha256'] = capture.digest(path)
        self.save_record()
        with self.assertRaisesRegex(ValueError, 'damaged|changed'):
            capture.check(self.root)

    def test_path_traversal_and_symlink_inputs_are_rejected(self):
        for path in ('../outside', '/tmp/outside', 'capture/../port.json', 'bad\\path', '.git/config'):
            with self.subTest(path=path), self.assertRaises(ValueError):
                capture.local_file(self.root, path)
        target = self.root / 'themes/night.json'
        target.unlink()
        target.symlink_to(self.root / 'port.json')
        with self.assertRaisesRegex(ValueError, 'regular file'):
            capture.inputs(self.root)

    def test_failed_programs_cannot_pass_as_a_shell_rendering_fixture_text(self):
        state = lambda command: [{'tabs': [{'windows': [{'foreground_processes': [{'cmdline': command}]}]}]}]
        self.assertTrue(capture.has_application(state(['/nix/store/example/bin/.crush-wrapped']), 'crush'))
        self.assertTrue(capture.has_application(state(['node', '/package/pi-coding-agent/cli.js']), 'pi'))
        self.assertFalse(capture.has_application(state(['/bin/bash']), 'herdr'))
        self.assertFalse(capture.has_application(state(['/bin/crusher']), 'crush'))

    def test_isolated_app_environment_does_not_inherit_user_credentials_or_services(self):
        secrets = {'ANTHROPIC_API_KEY': 'do-not-inherit', 'OPENAI_API_KEY': 'do-not-inherit',
                   'GH_TOKEN': 'do-not-inherit', 'DOCKER_HOST': 'do-not-inherit', 'DBUS_SESSION_BUS_ADDRESS': 'do-not-inherit',
                   '__EGL_VENDOR_LIBRARY_FILENAMES': 'do-not-inherit', 'LIBGL_DRIVERS_PATH': 'do-not-inherit'}
        before = {key: os.environ.get(key) for key in [*secrets, 'CAPTURE_MESA']}
        try:
            os.environ.update(secrets, CAPTURE_MESA='/nix/store/locked-mesa')
            home = self.root / 'isolated-home'
            home.mkdir()
            context = capture.Context(self.root, home, {'id': 'night'}, ':999')
            for key in secrets:
                self.assertNotEqual(context.env.get(key), 'do-not-inherit', key)
            self.assertEqual(context.env['HOME'], str(home))
            self.assertTrue(context.env['XDG_RUNTIME_DIR'].startswith(str(home)))
            self.assertEqual(context.env['DISPLAY'], ':999')
            self.assertEqual(context.env['__EGL_VENDOR_LIBRARY_FILENAMES'], '/nix/store/locked-mesa/share/glvnd/egl_vendor.d/50_mesa.json')
            self.assertEqual(context.env['LIBGL_DRIVERS_PATH'], '/nix/store/locked-mesa/lib/dri')
            self.assertEqual(context.env['GALLIUM_DRIVER'], 'llvmpipe')
        finally:
            for key, value in before.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value


if __name__ == '__main__':
    unittest.main()

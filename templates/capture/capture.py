#!/usr/bin/env python3
"""Real-app screenshot runner. Vendored by ports; no core checkout or runtime download needed.

The app-owned capture/app.py prepares an isolated profile and drives the real application.
Xvfb + Kitty are the display/terminal, not a reconstruction of the application's UI.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import signal
import struct
import subprocess
import sys
import tempfile
import time

# Match the original ports: 1280×800 layout rendered natively at 2×, never upscaled.
WIDTH, HEIGHT = 2560, 1600
sys.dont_write_bytecode = True


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def local_file(root, name):
    path = Path(name)
    if path.is_absolute() or not path.parts or any(p in ('.', '..', '.git', 'node_modules') for p in path.parts) or '\\' in name:
        raise ValueError(f'Unsafe capture path: {name}')
    target = root / path
    if target.is_symlink() or root not in target.resolve().parents or not target.is_file():
        raise ValueError(f'Capture input must be a repository-owned regular file: {name}')
    return target


def inputs(root):
    config = json.loads(local_file(root, 'capture/config.json').read_text())
    manifest = json.loads(local_file(root, 'port.json').read_text())
    paths = ['port.json', 'palette/theme.json', 'scripts/capture.py', 'capture/config.json',
             'capture/app.py', 'capture/flake.nix', 'capture/flake.lock', *config.get('fixtures', []), *manifest['files']]
    return {name: digest(local_file(root, name)) for name in sorted(set(paths))}


def png_size(path):
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'Invalid capture PNG: {path}')
    return struct.unpack('>II', data[16:24])


def check(root):
    manifest = json.loads(local_file(root, 'port.json').read_text())
    record = json.loads(local_file(root, 'images/capture.json').read_text())
    if record.get('schemaVersion') != 1 or record.get('inputs') != inputs(root):
        raise ValueError('Screenshots are stale. Run pnpm screenshots (or pnpm screenshots -- --force).')
    declared = {image['flavor']: image['path'] for image in manifest['images']}
    if len(declared) != len(manifest['images']) or set(declared) != set(manifest['flavors']) or set(record['images']) != set(declared):
        raise ValueError('Every supported flavor needs exactly one real application screenshot')
    for flavor, name in declared.items():
        image = local_file(root, name)
        evidence = record['images'][flavor]
        if png_size(image) != (WIDTH, HEIGHT) or digest(image) != evidence['sha256'] or evidence['path'] != name:
            raise ValueError(f'Capture is missing, damaged or changed without provenance: {name}')
        if not evidence.get('application') or len(evidence.get('paletteColors', [])) < 2:
            raise ValueError(f'Incomplete native capture evidence: {flavor}')
    return record


def has_application(state, application):
    processes = [process for window in state for tab in window['tabs'] for pane in tab['windows']
                 for process in pane.get('foreground_processes', [])]
    pattern = r'(?:^|[/\s.\-])' + re.escape(application) + r'(?:$|[/\s.\-])'
    return any(re.search(pattern, ' '.join(item.get('cmdline', []))) for item in processes)


class Context:
    def __init__(self, root, home, flavor, display):
        self.root, self.home, self.flavor = root, home, flavor
        self.work = home / 'glyph-field'
        self.work.mkdir()
        self.slug = f'living-code-{flavor["id"]}'
        self.socket = home / 'terminal.sock'
        self.children = []
        self.env = {key: os.environ[key] for key in ('PATH', 'FONTCONFIG_FILE', 'FONTCONFIG_PATH', 'TERMINFO_DIRS', 'LOCALE_ARCHIVE', 'SSL_CERT_FILE') if key in os.environ}
        self.env.update(HOME=str(home), XDG_CONFIG_HOME=str(home / '.config'), XDG_CACHE_HOME=str(home / '.cache'),
                        XDG_DATA_HOME=str(home / '.local/share'), XDG_STATE_HOME=str(home / '.local/state'),
                        XDG_RUNTIME_DIR=str(home / 'runtime'), TMPDIR=str(home / 'tmp'), DISPLAY=display,
                        LANG='C.UTF-8', LC_ALL='C.UTF-8', TERM='xterm-kitty', COLORTERM='truecolor',
                        SHELL=shutil.which('bash') or '/bin/sh', LIBGL_ALWAYS_SOFTWARE='1',
                        DBUS_SESSION_BUS_ADDRESS='unix:path=' + str(home / 'no-session-bus'))
        for name in ('.config', '.cache', '.local/share', '.local/state', 'runtime', 'tmp'):
            (home / name).mkdir(parents=True, exist_ok=True)
        (home / 'runtime').chmod(0o700)
        self.write('glyph-field/src/FieldRenderer.ts', '''import { clamp, type GlyphField } from "./types";

// Ease every glyph toward the pointer.
const RADIUS = 0.35;
const MAX_GLYPHS = 4_096;

export class FieldRenderer {
  #frame = 0;

  constructor(private readonly field: GlyphField) {}

  async render(paused = false): Promise<number> {
    if (!this.field.gpu || paused) return this.fallback();
    for (let i = 0; i < MAX_GLYPHS; i++) {
      this.field.cells[i].id = `glyph-${i}`;
      this.field.cells[i].weight = clamp(i / MAX_GLYPHS, 0, RADIUS);
    }
    await this.field.animate({ opacity: 1, ease: "power3.out" });
    return ++this.#frame;
  }

  private fallback(): number {
    console.warn("WebGPU unavailable, drawing on canvas");
    return this.#frame;
  }
}
''')
        self.write('glyph-field/src/types.ts', 'export interface GlyphField { gpu: boolean; cells: { id: string; weight: number }[]; animate(props: object): Promise<void>; }\nexport const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));\n')
        self.write('glyph-field/README.md', '# Glyph field\n\nA tiny renderer for living, interactive typography.\n')
        self.write('glyph-field/package.json', '{"name":"glyph-field","version":"1.0.0","private":true,"type":"module"}\n')

    def write(self, name, content):
        path = self.home / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def copy(self, source, target):
        path = self.home / target
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(local_file(self.root, source), path)
        return path

    def run(self, command, **kwargs):
        return subprocess.run([str(x) for x in command], cwd=self.work, env=self.env, check=True,
                              text=True, capture_output=True, timeout=20, **kwargs).stdout

    def spawn(self, command):
        process = subprocess.Popen([str(x) for x in command], cwd=self.work, env=self.env,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        self.children.append(process)
        return process

    def terminal(self, command):
        colors = self.flavor['colors']
        role = lambda name: colors[self.flavor['roles'][name]]['hex']
        options = {'linux_display_server': 'x11', 'hide_window_decorations': 'yes', 'remember_window_size': 'no',
                   'initial_window_width': str(WIDTH), 'initial_window_height': str(HEIGHT),
                   'font_family': 'DejaVu Sans Mono', 'font_size': '26', 'window_padding_width': '24',
                   'cursor_blink_interval': '0', 'enable_audio_bell': 'no', 'allow_remote_control': 'yes',
                   'background': role('bg'), 'foreground': role('fg'), 'cursor': role('cursor'),
                   'selection_background': role('selection'), 'selection_foreground': role('fg')}
        for i, color in enumerate(self.flavor['ansi']['normal'] + self.flavor['ansi']['bright']):
            options[f'color{i}'] = color
        args = ['kitty', '--config', 'NONE', '--listen-on', f'unix:{self.socket}', '--title', 'Living Code capture', '--hold']
        for key, value in options.items():
            args += ['--override', f'{key}={value}']
        return self.spawn(args + [str(x) for x in command])

    def remote(self, *args):
        return self.run(['kitty', '@', '--to', f'unix:{self.socket}', *args])

    def text(self, ansi=False):
        return self.remote('get-text', '--extent', 'screen', *(['--ansi'] if ansi else []))

    def wait_text(self, pattern, timeout=30):
        deadline, last = time.monotonic() + timeout, ''
        while time.monotonic() < deadline:
            try:
                last = self.text()
                if re.search(pattern, last, re.I):
                    return last
            except (subprocess.CalledProcessError, FileNotFoundError):
                pass
            time.sleep(0.25)
        raise RuntimeError(f'Application did not reach {pattern!r}:\n{last[-5000:]}')

    def type(self, text):
        self.remote('send-text', '--bracketed-paste', 'disable', '--', text)

    def key(self, key):
        self.remote('send-key', key)

    def git_fixture(self):
        for args in (['init', '-b', 'main'], ['config', 'user.name', 'Living Code'],
                     ['config', 'user.email', 'capture@example.invalid'], ['add', '.'],
                     ['commit', '-m', 'feat: render an interactive glyph field']):
            self.run(['git', *args])
        with (self.work / 'src/FieldRenderer.ts').open('a') as file:
            file.write('\nexport const DEFAULT_RADIUS = 0.35;\n')
        self.write('glyph-field/src/pointer.ts', 'export const pointer = { x: 0, y: 0 };\n')

    def cleanup(self):
        for child in reversed(self.children):
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        time.sleep(0.1)
        for child in reversed(self.children):
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait(timeout=5)


def capture(root, force=False, only=None):
    try:
        if not force and not only:
            check(root)
            print('All application screenshots are current; use --force to recapture.')
            return
    except (ValueError, KeyError, FileNotFoundError):
        pass
    for binary in ('Xvfb', 'xdotool', 'kitty', 'magick'):
        if not shutil.which(binary):
            raise RuntimeError(f'Missing {binary}. Run pnpm screenshots through the pinned capture/flake.nix environment.')
    spec = importlib.util.spec_from_file_location('capture_app', local_file(root, 'capture/app.py'))
    app = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(app)
    manifest = json.loads(local_file(root, 'port.json').read_text())
    flavors = json.loads(local_file(root, 'palette/theme.json').read_text())['flavors']
    config = json.loads(local_file(root, 'capture/config.json').read_text())
    if (root / 'images').is_symlink() or {image['flavor']: image['path'] for image in manifest['images']} != {
            flavor: f'images/{flavor}.png' for flavor in manifest['flavors']}:
        raise ValueError('Capture outputs must be images/<supported-flavor>.png inside this repository')
    before = inputs(root)
    evidence = {}
    # Keep native Unix-domain socket paths below the OS's 108-byte limit, even inside nix develop.
    with tempfile.TemporaryDirectory(prefix='lc-shot-', dir='/tmp', ignore_cleanup_errors=True) as temporary:
        temporary = Path(temporary)
        display_file = temporary / 'display'
        with display_file.open('w+') as output:
            xvfb = subprocess.Popen(['Xvfb', '-displayfd', str(output.fileno()), '-screen', '0', f'{WIDTH}x{HEIGHT}x24',
                                     '-nolisten', 'tcp', '-ac'], pass_fds=(output.fileno(),), stderr=subprocess.DEVNULL)
            try:
                for _ in range(100):
                    if display_file.read_text().strip():
                        break
                    if xvfb.poll() is not None:
                        raise RuntimeError('Xvfb failed to start')
                    time.sleep(0.05)
                display = ':' + display_file.read_text().strip()
                for flavor in flavors:
                    id = flavor['id']
                    if id not in manifest['flavors'] or (only and id != only):
                        continue
                    home = temporary / id
                    home.mkdir()
                    context = Context(root, home, flavor, display)
                    try:
                        command = app.prepare(context)
                        version = context.run(config['versionCommand']).strip().splitlines()[0]
                        process = context.spawn(command) if getattr(app, 'GRAPHICAL', False) else context.terminal(command)
                        app.drive(context)
                        time.sleep(0.4)
                        if process.poll() is not None:
                            raise RuntimeError(f'Application window exited: {process.returncode}')
                        if not getattr(app, 'GRAPHICAL', False):
                            state = json.loads(context.remote('ls'))
                            application = Path(str(command[0])).name
                            if not has_application(state, application):
                                raise RuntimeError('Native application is not running in the terminal; refusing a shell/error-screen capture:\n' + context.text()[-3000:])
                        image = temporary / f'{id}.png'
                        context.run(['magick', 'import', '-window', 'root', '-depth', '8', '-strip', f'PNG:{image}'])
                        if os.environ.get('CAPTURE_DEBUG'):
                            debug = root / 'dist/capture-debug'
                            debug.mkdir(parents=True, exist_ok=True)
                            shutil.copyfile(image, debug / f'{id}.png')
                        if png_size(image) != (WIDTH, HEIGHT):
                            raise RuntimeError('Unexpected screenshot dimensions')
                        histogram = context.run(['magick', image, '-format', '%c', 'histogram:info:-']).lower()
                        colors = sorted({color['hex'].lower() for color in flavor['colors'].values()
                                         if color['hex'].lower() in histogram})
                        if len(colors) < 2:
                            raise RuntimeError('The screenshot does not contain the selected Living Code palette')
                        if not getattr(app, 'GRAPHICAL', False):
                            screen = context.text()
                            if re.search(r'(?i)(failed to (?:parse|deserialize|load config)|invalid (?:color|theme)|error loading theme|panicked at|server did not become ready|exited with (?:status|error)|error: nu::|Docker event stream returned error)', screen):
                                raise RuntimeError('Application reported a theme/configuration error:\n' + screen[-3000:])
                        name = next(image['path'] for image in manifest['images'] if image['flavor'] == id)
                        evidence[id] = {'path': name, 'sha256': digest(image), 'application': version, 'paletteColors': colors}
                        print(f'{manifest["name"]} {id}: captured the real application ({len(colors)} palette colors)', flush=True)
                    finally:
                        try:
                            if hasattr(app, 'cleanup'):
                                app.cleanup(context)
                        finally:
                            context.cleanup()
                if only:
                    destination = root / 'dist/capture-preview'
                    destination.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(temporary / f'{only}.png', destination / f'{only}.png')
                    print(f'Preview only: {destination / (only + ".png")}; committed captures were not changed.')
                    return
                if before != inputs(root):
                    raise RuntimeError('Capture inputs changed while applications were running; images were not replaced')
                if set(evidence) != set(manifest['flavors']):
                    raise RuntimeError('Not all supported flavors were captured; images were not replaced')
                for id, item in evidence.items():
                    destination = root / item['path']
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(temporary / f'{id}.png', destination)
                (root / 'images/capture.json').write_text(json.dumps({'schemaVersion': 1, 'scene': config['scene'],
                    'inputs': before, 'images': evidence}, indent=2) + '\n')
            finally:
                xvfb.terminate()
                xvfb.wait(timeout=5)
    check(root)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Offline freshness, integrity and flavor coverage validation')
    parser.add_argument('--force', action='store_true', help='Recapture even when inputs have not changed')
    parser.add_argument('--flavor', choices=['night', 'frost', 'paper', 'signal'], help='Preview one flavor in dist/, without changing published images')
    args = parser.parse_args([x for x in sys.argv[1:] if x != '--'])
    root = Path(__file__).resolve().parents[1]
    try:
        if args.check:
            check(root)
            print('All supported flavors have current, verified native application screenshots.')
        else:
            capture(root, args.force, args.flavor)
    except Exception as error:
        if os.environ.get('CAPTURE_DEBUG'):
            import traceback
            traceback.print_exc()
        print(f'Capture failed: {error}', file=sys.stderr)
        sys.exit(1)

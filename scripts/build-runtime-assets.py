#!/usr/bin/env python3
"""Build lossless runtime portraits without touching source artwork.

Requires Pillow with WebP support. Run: python3 scripts/build-runtime-assets.py
Existing content-addressed outputs are retained for cached deployed manifests.
"""
import argparse
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import tempfile
from PIL import Image, features

SIZES = {'portrait': 192, 'dossier': 384}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(repo, path):
    try:
        parts = path.relative_to(repo).parts
        path.resolve().relative_to(repo)
    except ValueError as error:
        raise ValueError('Asset paths must remain inside the repository') from error
    current = repo
    for part in parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f'Symlink asset path is not supported: {current}')
    return path


def write_asset(repo, path, data, immutable=True):
    safe_path(repo, path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if immutable and path.exists():
        if path.read_bytes() != data:
            raise ValueError(f'Existing content-addressed file has different bytes: {path}')
        return
    descriptor, temporary = tempfile.mkstemp(prefix='.runtime-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            output.write(data)
        if immutable:
            try:
                os.link(temporary, path)
            except FileExistsError:
                if path.read_bytes() != data:
                    raise ValueError(f'Existing content-addressed file has different bytes: {path}')
        else:
            os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def encode_variants(image):
    png = BytesIO()
    webp = BytesIO()
    image.save(png, format='PNG', optimize=True, compress_level=9)
    image.save(webp, format='WEBP', lossless=True, method=6, exact=True)
    return png.getvalue(), webp.getvalue()


def square_portrait(image, side):
    scale = side / max(image.size)
    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    # Copy pixels directly; compositing against transparency changes partial alpha.
    canvas.paste(resized, ((side - resized.width) // 2, (side - resized.height) // 2))
    return canvas


def build_assets(repo_root):
    if not features.check('webp'):
        raise RuntimeError('This build requires Pillow with lossless WebP support')
    repo = Path(repo_root).resolve()
    source_root = safe_path(repo, repo / 'data/assets/characters')
    output_root = safe_path(repo, repo / 'data/assets/runtime/characters')
    sources = sorted(source_root.rglob('*.png'))
    if not sources:
        raise ValueError('No source character PNG files were found')
    entries = {}
    for source in sources:
        safe_path(repo, source)
        source_data = source.read_bytes()
        source_src = source.relative_to(repo).as_posix()
        with Image.open(BytesIO(source_data)) as original:
            original.load()
            image = original.convert('RGBA')
        entry = {'source': {'src': source_src, 'width': image.width, 'height': image.height,
                            'bytes': len(source_data), 'sha256': sha256(source_data)}}
        for variant, side in SIZES.items():
            png, webp = encode_variants(square_portrait(image, side))
            extension, data = min([('png', png), ('webp', webp)], key=lambda pair: len(pair[1]))
            content_hash = sha256(data)
            output = output_root / source.relative_to(source_root).parent / f'{source.stem}.{side}.{content_hash[:16]}.{extension}'
            write_asset(repo, output, data)
            entry[variant] = {'src': output.relative_to(repo).as_posix(), 'width': side, 'height': side,
                              'bytes': len(data), 'sha256': content_hash}
        entries[source_src] = entry
    payload = {'schemaVersion': 1, 'entries': entries}
    canonical = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')
    manifest = {'schemaVersion': 1, 'version': sha256(canonical)[:16], 'entries': entries}
    manifest_data = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode('utf-8')
    write_asset(repo, output_root / f"manifest.{manifest['version']}.json", manifest_data)
    write_asset(repo, output_root / 'manifest.json', manifest_data, immutable=False)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo-root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    manifest = build_assets(args.repo_root)
    entries = list(manifest['entries'].values())
    print(json.dumps({'version': manifest['version'], 'sources': len(entries),
                      'sourceBytes': sum(e['source']['bytes'] for e in entries),
                      'portraitBytes': sum(e['portrait']['bytes'] for e in entries),
                      'dossierBytes': sum(e['dossier']['bytes'] for e in entries)}))


if __name__ == '__main__':
    main()

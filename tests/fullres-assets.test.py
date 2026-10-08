"""Full-resolution delivery uses the original pixels and preserves old releases."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('fullres_assets', ROOT / 'scripts/build-runtime-assets.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class FullResolutionAssetsTests(unittest.TestCase):
    def test_full_variant_references_exact_original_bytes_and_non_square_dimensions(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            source = repo / 'data/assets/characters/fool/fool_seq9.png'
            source.parent.mkdir(parents=True)
            image = Image.new('RGBA', (101, 53), (91, 41, 203, 0))
            image.putpixel((47, 31), (120, 240, 10, 127))
            image.putpixel((1, 1), (14, 44, 94, 255))
            image.save(source)
            original = source.read_bytes()
            digest = hashlib.sha256(original).hexdigest()
            key = source.relative_to(repo).as_posix()
            manifest = builder.build_assets(repo)
            self.assertEqual(manifest['entries'][key].get('full'), {
                'src': f'{key}?v={digest[:16]}', 'width': 101, 'height': 53,
                'bytes': len(original), 'sha256': digest,
            }, 'Full art must use the original PNG, with no resizing or re-encoding')
            self.assertEqual(source.read_bytes(), original)
            with Image.open(repo / manifest['entries'][key]['full']['src'].split('?')[0]) as delivered:
                self.assertEqual(delivered.convert('RGBA').tobytes(), image.tobytes())
            outputs = repo / 'data/assets/runtime/characters'
            before = {p.relative_to(outputs).as_posix(): p.read_bytes() for p in outputs.rglob('*') if p.is_file()}
            self.assertEqual(builder.build_assets(repo), manifest)
            self.assertEqual(before, {p.relative_to(outputs).as_posix(): p.read_bytes() for p in outputs.rglob('*') if p.is_file()})
            self.assertEqual(len(list(outputs.rglob('*.webp'))) + len(list(outputs.rglob('*.png'))), 2,
                             'Full-resolution delivery must not create duplicate image files')

    def test_all_242_originals_have_full_descriptors_and_old_release_is_untouched(self):
        manifest = json.loads((ROOT / 'data/assets/runtime/characters/manifest.json').read_text())
        originals = sorted((ROOT / 'data/assets/characters').rglob('*.png'))
        self.assertEqual(len(originals), 242)
        self.assertEqual(set(manifest['entries']), {p.relative_to(ROOT).as_posix() for p in originals})
        old = json.loads((ROOT / 'data/assets/runtime/characters/manifest.48d4e6b077a8c898.json').read_text())
        for source in originals:
            with self.subTest(source=source.name):
                key = source.relative_to(ROOT).as_posix()
                data = source.read_bytes()
                digest = hashlib.sha256(data).hexdigest()
                with Image.open(source) as image:
                    size = image.size
                self.assertEqual(manifest['entries'][key].get('full'), {
                    'src': f'{key}?v={digest[:16]}', 'width': size[0], 'height': size[1],
                    'bytes': len(data), 'sha256': digest,
                })
                self.assertEqual(old['entries'][key]['source']['sha256'], digest)
                for variant in ['portrait', 'dossier']:
                    self.assertEqual(old['entries'][key][variant], manifest['entries'][key][variant])


if __name__ == '__main__':
    unittest.main(verbosity=2)

"""Revised artwork can be selected without overwriting originals or logical IDs."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('art_assets', ROOT / 'scripts/build-runtime-assets.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class ArtworkOverrideTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.key = 'data/assets/characters/fool/fool_seq9.png'
        self.revised = 'data/assets/revisions/fool/fool_seq9.png'
        self.original = self.repo / self.key
        self.original.parent.mkdir(parents=True)
        Image.new('RGBA', (101, 53), (10, 20, 30, 255)).save(self.original)
        self.original_bytes = self.original.read_bytes()
        self.revision = self.repo / self.revised
        self.revision.parent.mkdir(parents=True)
        Image.new('RGBA', (53, 101), (90, 70, 50, 128)).save(self.revision)
        self.map_file = self.repo / 'data/assets/character-overrides.json'

    def select(self, mapping=None):
        self.map_file.write_text(json.dumps(mapping if mapping is not None else {self.key: self.revised}))

    def test_selected_revision_supplies_full_and_small_images_preserving_original(self):
        before = builder.build_assets(self.repo)
        self.select()
        after = builder.build_assets(self.repo)
        entry = after['entries'][self.key]
        digest = hashlib.sha256(self.revision.read_bytes()).hexdigest()
        self.assertEqual(set(after['entries']), {self.key})
        self.assertEqual(entry['source'], before['entries'][self.key]['source'])
        self.assertEqual(entry['artwork']['src'], self.revised)
        self.assertEqual(entry['full'], {**entry['artwork'], 'src': f'{self.revised}?v={digest[:16]}'})
        self.assertEqual((entry['full']['width'], entry['full']['height']), (53, 101))
        self.assertEqual(self.original.read_bytes(), self.original_bytes)
        for variant, side in builder.SIZES.items():
            with Image.open(self.revision) as image:
                expected = builder.square_portrait(image, side)
            with Image.open(self.repo / entry[variant]['src']) as actual:
                self.assertEqual(actual.convert('RGBA').tobytes(), expected.tobytes())
            self.assertTrue((self.repo / before['entries'][self.key][variant]['src']).is_file())
        self.assertNotEqual(before['version'], after['version'])
        self.assertEqual(builder.build_assets(self.repo), after)

    def test_unlisted_revision_is_not_selected(self):
        manifest = builder.build_assets(self.repo)
        self.assertNotIn('artwork', manifest['entries'][self.key])
        self.assertTrue(manifest['entries'][self.key]['full']['src'].startswith(self.key + '?v='))

    def test_hash_named_revision_keeps_previous_selected_source_unchanged(self):
        self.select()
        before = builder.build_assets(self.repo)
        old_bytes = self.revision.read_bytes()
        candidate = self.revision.with_suffix('.candidate')
        Image.new('RGBA', (67, 113), (40, 80, 120, 180)).save(candidate, format='PNG')
        digest = hashlib.sha256(candidate.read_bytes()).hexdigest()
        revision = self.revision.with_name(f'fool_seq9.{digest[:16]}.png')
        candidate.rename(revision)
        self.select({self.key: revision.relative_to(self.repo).as_posix()})
        after = builder.build_assets(self.repo)
        self.assertEqual(after['entries'][self.key]['artwork']['src'], revision.relative_to(self.repo).as_posix())
        self.assertEqual(after['entries'][self.key]['full']['sha256'], digest)
        self.assertEqual(self.revision.read_bytes(), old_bytes)
        self.assertEqual(self.original.read_bytes(), self.original_bytes)
        self.assertTrue((self.repo / f"data/assets/runtime/characters/manifest.{before['version']}.json").is_file())

    def test_hash_named_revision_rejects_a_filename_that_disagrees_with_its_bytes(self):
        revision = self.revision.with_name('fool_seq9.' + '0' * 16 + '.png')
        revision.write_bytes(self.revision.read_bytes())
        self.select({self.key: revision.relative_to(self.repo).as_posix()})
        with self.assertRaisesRegex(ValueError, 'hash'):
            builder.build_assets(self.repo)

    def test_empty_map_preserves_original_build(self):
        before = builder.build_assets(self.repo)
        self.select({})
        self.assertEqual(builder.build_assets(self.repo), before)

    def test_unknown_logical_source_is_rejected(self):
        self.select({'data/assets/characters/fool/fool_seq8.png': self.revised})
        with self.assertRaises(ValueError):
            builder.build_assets(self.repo)

    def test_wrong_identity_and_traversal_are_rejected(self):
        for bad in ['../outside.png', 'data/assets/revisions/error/error_seq9.png',
                    self.key, 'https://example.test/image.png', None]:
            with self.subTest(path=bad):
                self.select({self.key: bad})
                with self.assertRaises(ValueError):
                    builder.build_assets(self.repo)

    def test_non_object_map_is_rejected(self):
        self.select([self.key])
        with self.assertRaises(ValueError):
            builder.build_assets(self.repo)

    def test_missing_revision_is_rejected_without_silently_using_original(self):
        self.select()
        self.revision.rename(self.revision.with_suffix('.unused'))
        with self.assertRaises((ValueError, FileNotFoundError)):
            builder.build_assets(self.repo)

    def test_revision_symlink_is_rejected(self):
        self.revision.rename(self.revision.with_suffix('.unused'))
        self.revision.symlink_to(self.original)
        self.select()
        with self.assertRaises(ValueError):
            builder.build_assets(self.repo)


class PublishedArtworkTests(unittest.TestCase):
    def test_selected_revisions_are_active_and_fully_inside_transparent_canvases(self):
        overrides = json.loads((ROOT / 'data/assets/character-overrides.json').read_text())
        manifest = json.loads((ROOT / 'data/assets/runtime/characters/manifest.json').read_text())
        self.assertTrue(overrides, 'Approved outliers must be selected in the game')
        for key, revision in overrides.items():
            with self.subTest(character=key):
                entry = manifest['entries'][key]
                self.assertEqual(entry['artwork']['src'], revision)
                self.assertEqual(entry['artwork']['sha256'], hashlib.sha256((ROOT / revision).read_bytes()).hexdigest())
                self.assertEqual(entry['full']['src'], f"{revision}?v={entry['artwork']['sha256'][:16]}")
                with Image.open(ROOT / revision) as image:
                    self.assertEqual(image.size, (1254, 1254))
                    alpha = image.convert('RGBA').getchannel('A')
                    self.assertEqual(alpha.getextrema(), (0, 255))
                    edges = [alpha.crop((0, 0, image.width, 1)), alpha.crop((0, image.height - 1, image.width, image.height)),
                             alpha.crop((0, 0, 1, image.height)), alpha.crop((image.width - 1, 0, image.width, image.height))]
                    self.assertLessEqual(max(edge.getextrema()[1] for edge in edges), 32, 'No visible art may touch a canvas edge')
        for key, entry in manifest['entries'].items():
            if key not in overrides:
                self.assertNotIn('artwork', entry)
                self.assertEqual(entry['full']['src'].split('?')[0], key)


if __name__ == '__main__':
    unittest.main(verbosity=2)

"""Runtime art stays lossless, immutable, bounded and reproducible."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts' / 'build-runtime-assets.py'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class RuntimeAssetBuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.builder = None
        if SCRIPT.exists():
            spec = importlib.util.spec_from_file_location('runtime_assets', SCRIPT)
            cls.builder = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.builder)

    def setUp(self):
        self.assertIsNotNone(self.builder, 'Runtime portraits need a repeatable asset build script')
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.sources = self.repo / 'data/assets/characters/fool'
        self.sources.mkdir(parents=True)
        self.original = self.sources / 'fool_seq9.png'
        self.mythical = self.sources / 'fool_mythical.png'
        image = Image.new('RGBA', (101, 53), (0, 0, 0, 0))
        # Include semitransparent edge pixels and colored transparent pixels.
        for x in range(10, 91):
            for y in range(6, 47):
                image.putpixel((x, y), ((231, 91, 17, 255) if x < 50 else (44, 101, 92, 128)))
        image.putpixel((11, 7), (90, 40, 160, 1))
        image.putpixel((0, 0), (120, 60, 20, 0))
        image.save(self.original)
        Image.new('RGBA', (53, 101), (12, 44, 80, 255)).save(self.mythical)
        self.before = {p.relative_to(self.repo).as_posix(): digest(p) for p in self.sources.glob('*.png')}
        self.manifest = self.builder.build_assets(self.repo)

    def test_original_bytes_are_never_modified(self):
        self.assertEqual(self.before, {p.relative_to(self.repo).as_posix(): digest(p) for p in self.sources.glob('*.png')})

    def test_every_source_has_portrait_and_dossier(self):
        self.assertEqual(set(self.manifest['entries']), set(self.before))
        for source_path, entry in self.manifest['entries'].items():
            self.assertEqual(entry['source']['src'], source_path)
            self.assertEqual(entry['source']['sha256'], self.before[source_path])
            for variant, side in [('portrait', 192), ('dossier', 384)]:
                self.assertEqual((entry[variant]['width'], entry[variant]['height']), (side, side))
                path = self.repo / entry[variant]['src']
                self.assertTrue(path.is_file())
                self.assertEqual(path.stat().st_size, entry[variant]['bytes'])
                self.assertEqual(digest(path), entry[variant]['sha256'])
                self.assertIn(entry[variant]['sha256'][:16], path.name)

    def test_resizing_keeps_exact_rgba_colors_and_crisp_edges(self):
        with Image.open(self.original) as original:
            original_colors = set(original.convert('RGBA').get_flattened_data()) | {(0, 0, 0, 0)}
        for variant in ['portrait', 'dossier']:
            with Image.open(self.repo / self.manifest['entries'][self.original.relative_to(self.repo).as_posix()][variant]['src']) as resized:
                self.assertEqual(resized.mode, 'RGBA')
                self.assertTrue(set(resized.get_flattened_data()) <= original_colors)
                self.assertEqual(resized.getpixel((0, resized.height - 1))[3], 0)
                self.assertEqual(resized.getpixel((resized.width - 1, 0))[3], 0)

    def test_non_square_images_keep_aspect_and_centered_padding(self):
        for variant, side in [('portrait', 192), ('dossier', 384)]:
            entry = self.manifest['entries'][self.mythical.relative_to(self.repo).as_posix()][variant]
            with Image.open(self.repo / entry['src']) as image:
                bbox = image.getbbox()
                self.assertEqual(bbox[3] - bbox[1], side)
                self.assertLessEqual(abs((bbox[2] - bbox[0]) / side - 53 / 101), 1 / side)
                self.assertLessEqual(abs(bbox[0] - (side - bbox[2])), 1)

    def test_build_is_byte_identical_and_versioned(self):
        runtime = self.repo / 'data/assets/runtime/characters'
        snapshot = {p.relative_to(runtime).as_posix(): digest(p) for p in runtime.rglob('*') if p.is_file()}
        second = self.builder.build_assets(self.repo)
        self.assertEqual(self.manifest, second)
        self.assertEqual(snapshot, {p.relative_to(runtime).as_posix(): digest(p) for p in runtime.rglob('*') if p.is_file()})
        latest = runtime / 'manifest.json'
        versioned = runtime / f"manifest.{self.manifest['version']}.json"
        self.assertEqual(latest.read_bytes(), versioned.read_bytes())
        self.assertEqual(json.loads(latest.read_text()), self.manifest)

    def test_changed_input_keeps_previous_version_files(self):
        old_paths = [self.repo / entry[v]['src'] for entry in self.manifest['entries'].values() for v in ['portrait', 'dossier']]
        old_hashes = {p: digest(p) for p in old_paths}
        Image.new('RGBA', (101, 53), (90, 80, 70, 255)).save(self.original)
        changed = self.builder.build_assets(self.repo)
        self.assertNotEqual(changed['version'], self.manifest['version'])
        self.assertEqual(old_hashes, {p: digest(p) for p in old_paths})
        old_manifest = self.repo / 'data/assets/runtime/characters' / f"manifest.{self.manifest['version']}.json"
        self.assertTrue(old_manifest.is_file())

    def test_smaller_lossless_supported_encoding_is_selected(self):
        for entry in self.manifest['entries'].values():
            for variant in ['portrait', 'dossier']:
                path = self.repo / entry[variant]['src']
                with Image.open(path) as image:
                    png, webp = self.builder.encode_variants(image.convert('RGBA'))
                self.assertEqual(path.read_bytes(), min([png, webp], key=len))

    def test_original_source_symlinks_are_rejected(self):
        outside = self.repo / 'outside.png'
        Image.new('RGBA', (4, 4), (1, 2, 3, 255)).save(outside)
        (self.sources / 'fool_seq8.png').symlink_to(outside)
        with self.assertRaises(ValueError):
            self.builder.build_assets(self.repo)

    def test_runtime_directory_symlink_is_rejected(self):
        other = self.repo / 'other'
        other.mkdir()
        # The normal generated directory exists; use a second source-only fixture.
        second = self.repo / 'second'
        second_sources = second / 'data/assets/characters/fool'
        second_sources.mkdir(parents=True)
        Image.new('RGBA', (4, 4)).save(second_sources / 'fool_seq9.png')
        (second / 'data/assets/runtime').symlink_to(other, target_is_directory=True)
        with self.assertRaises(ValueError):
            self.builder.build_assets(second)
        self.assertEqual(list(other.iterdir()), [])

    def test_empty_source_tree_is_rejected_without_an_empty_manifest(self):
        empty = self.repo / 'empty'
        empty.mkdir()
        with self.assertRaises(ValueError):
            self.builder.build_assets(empty)
        self.assertFalse((empty / 'data/assets/runtime/characters/manifest.json').exists())

    def test_a_runtime_file_symlink_cannot_overwrite_its_target(self):
        output = self.repo / next(iter(self.manifest['entries'].values()))['portrait']['src']
        outside = self.repo / 'protected.txt'
        outside.write_text('protected')
        output.unlink()
        output.symlink_to(outside)
        with self.assertRaises(ValueError):
            self.builder.build_assets(self.repo)
        self.assertEqual(outside.read_text(), 'protected')

    def test_paths_outside_the_repository_are_rejected(self):
        outside_temp = tempfile.TemporaryDirectory()
        self.addCleanup(outside_temp.cleanup)
        outside = Path(outside_temp.name) / 'external.png'
        Image.new('RGBA', (4, 4)).save(outside)
        (self.sources / 'fool_seq8.png').symlink_to(outside)
        with self.assertRaises(ValueError):
            self.builder.build_assets(self.repo)

    def test_missing_webp_support_fails_without_silent_format_changes(self):
        with patch.object(self.builder.features, 'check', return_value=False):
            with self.assertRaises(RuntimeError):
                self.builder.build_assets(self.repo)

    def test_a_build_cannot_replace_existing_hash_named_bytes(self):
        entry = next(iter(self.manifest['entries'].values()))['portrait']
        output = self.repo / entry['src']
        output.write_bytes(b'corrupt existing immutable output')
        with self.assertRaises(ValueError):
            self.builder.build_assets(self.repo)
        self.assertEqual(output.read_bytes(), b'corrupt existing immutable output')


class RepositoryAssetCoverageTests(unittest.TestCase):
    def test_all_22_pathways_and_242_sources_have_exact_lossless_runtime_versions(self):
        manifest_path = ROOT / 'data/assets/runtime/characters/manifest.json'
        self.assertTrue(manifest_path.exists(), 'All original characters need generated runtime portraits')
        manifest = json.loads(manifest_path.read_text())
        originals = sorted((ROOT / 'data/assets/characters').rglob('*.png'))
        self.assertEqual(len(originals), 22 * 11)
        self.assertEqual(set(manifest['entries']), {p.relative_to(ROOT).as_posix() for p in originals})
        for original in originals:
            with self.subTest(original=original.name):
                entry = manifest['entries'][original.relative_to(ROOT).as_posix()]
                self.assertEqual(entry['source']['sha256'], digest(original))
                with Image.open(original) as source:
                    image = source.convert('RGBA')
                for variant, side in [('portrait', 192), ('dossier', 384)]:
                    runtime = ROOT / entry[variant]['src']
                    self.assertTrue(runtime.is_file())
                    self.assertEqual(entry[variant]['sha256'], digest(runtime))
                    self.assertEqual(entry[variant]['bytes'], runtime.stat().st_size)
                    self.assertLess(runtime.stat().st_size, original.stat().st_size)
                    scale = side / max(image.size)
                    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.NEAREST)
                    expected = Image.new('RGBA', (side, side), (0, 0, 0, 0))
                    expected.paste(resized, ((side - resized.width) // 2, (side - resized.height) // 2))
                    with Image.open(runtime) as actual:
                        self.assertEqual(actual.size, (side, side))
                        self.assertEqual(actual.convert('RGBA').tobytes(), expected.tobytes(), 'Lossless exact nearest-neighbor pixels')


if __name__ == '__main__':
    unittest.main(verbosity=2)

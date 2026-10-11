"""Selected corrections preserve every prior source and leave matching designs unchanged."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
    'fool': [0], 'door': [9, 8, 7, 6, 0], 'giant': [0],
    'sun': [9, 8, 7, 6, 5, 4, 3], 'death': [9, 8, 7, 6, 2],
    'visionary': [5], 'demoness': [8, 7, 3],
    'moon': [9, 8, 7, 6, 5, 4, 3, 2, 'mythical'],
    'mother': [9, 8, 7, 6, 4, 3, 2], 'white_tower': [2, 1, 0],
    'hangedman': [6, 1], 'black_emperor': [6], 'chained': [4],
    'redpriest': list(range(9, -1, -1)), 'tyrant': list(range(9, -1, -1)),
}


class CorrectedArtworkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.before = json.loads((ROOT / 'reports/art-consistency/review.json').read_text())
        cls.manifest = json.loads((ROOT / 'data/assets/runtime/characters/manifest.json').read_text())
        cls.targets = {f'{folder}_mythical' if rank == 'mythical' else f'{folder}_seq{rank}'
                       for folder, ranks in TARGETS.items() for rank in ranks}

    def test_all_originals_and_first_pass_sources_remain_byte_identical(self):
        for row in self.before:
            with self.subTest(character=row['id']):
                for path, sha in [(row['source'], row['originalSha256']), (row['selected'], row['selectedSha256'])]:
                    self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), sha)

    def test_only_approved_outliers_change_active_selection(self):
        self.assertEqual(len(self.targets), 66)
        self.assertEqual(len(self.before), 242)
        for row in self.before:
            with self.subTest(character=row['id']):
                entry = self.manifest['entries'][row['source']]
                selected = entry.get('artwork', entry['source'])
                if row['id'] in self.targets:
                    self.assertNotEqual(selected['sha256'], row['selectedSha256'], 'Approved correction is not selected')
                else:
                    self.assertEqual(selected['src'], row['selected'])
                    self.assertEqual(selected['sha256'], row['selectedSha256'])

    def test_fool_sequence_zero_cannot_reuse_the_known_revision_with_legs(self):
        key = 'data/assets/characters/fool/fool_seq0.png'
        entry = self.manifest['entries'][key]
        bad = next(row['selectedSha256'] for row in self.before if row['id'] == 'fool_seq0')
        self.assertNotEqual(entry['full']['sha256'], bad, 'The revision with legs must not remain selected')


if __name__ == '__main__':
    unittest.main(verbosity=2)

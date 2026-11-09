"""Fast tests independent of the private data cache."""
import unittest
import numpy as np

from data_mathwriting import linear_label
from train_line import features


class LineDataTest(unittest.TestCase):
    def test_supported_latex(self):
        for source, expected in [(r'5+1=', '5+1='), (r'\frac{12}{3}', '(12)/(3)'),
                (r'x^{12}', 'x^(12)'), (r'2\times3\cdot4\div2', '2×3·4÷2'),
                (r'\left[2,5\right]', '[2,5]')]:
            self.assertEqual(linear_label(source), expected)

    def test_never_silently_strip_unsupported_structure(self):
        for source in [r'\sin{x}', 'x_2', r'\sum{x}', '{2', '2}', r'\frac{2}']:
            self.assertIsNone(linear_label(source))

    def test_sampling_invariance(self):
        a = features([[[0, 0], [20, 40]], [[25, 0], [40, 40]]])
        b = features([[[100, 200], [140, 280]], [[150, 200], [180, 280]]])
        np.testing.assert_allclose(a, b, atol=1e-6)
        self.assertEqual(a.shape[1], 6)
        self.assertEqual(int(a[:, 4].sum()), 2)
        self.assertTrue(np.isfinite(a).all())


if __name__ == '__main__':
    unittest.main()

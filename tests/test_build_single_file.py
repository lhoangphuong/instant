import os
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class BuildSingleFileTest(unittest.TestCase):
    def test_build_single_file_inlines_assets(self):
        env = {**os.environ, "APP_VERSION": "v-test"}

        subprocess.run(
            ["python3", "scripts/build-single-file.py"],
            cwd=ROOT,
            env=env,
            check=True,
            capture_output=True,
            text=True,
        )

        output = ROOT / "dist" / "snake-v-test.html"
        self.assertTrue(output.exists())

        html = output.read_text(encoding="utf-8")
        self.assertIn("<style>", html)
        self.assertIn("<script>", html)
        self.assertNotIn('href="styles.css"', html)
        self.assertNotIn('src="game.js"', html)
        self.assertIn("v2.7", html)
        self.assertIn("SnakeGameCore", html)


if __name__ == "__main__":
    unittest.main()

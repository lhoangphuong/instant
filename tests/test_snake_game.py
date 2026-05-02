import json
import os
import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which("node"), "node not installed — skip Snake tests")
class SnakeGameNodeTest(unittest.TestCase):
    def test_game_core_rules_via_node(self) -> None:
        proc = subprocess.run(
            ["node", "tests/game-tests-runner.mjs"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        out = proc.stdout.strip() or proc.stderr.strip()
        self.assertTrue(out, "no output from game-tests-runner.mjs")

        suite = json.loads(out)
        self.assertEqual(
            suite["exitCode"],
            0,
            f"tests failed: {suite}",
        )
        self.assertGreater(suite["passed"], 0)

# Snake v2.5

A lightweight static Snake game served by nginx and deployed to Fly.io.

## What's in v2.5

- **Testable game rules** in `game-core.js` (`SnakeGameCore`) shared by the playable app and automated tests.
- **Unit tests**: Python `unittest` discovers `tests/test_*.py` (build sanity + Node rule runner when Node is available).
- **Browser test page**: open `tests.html` (via local server) for a visible pass/fail summary of the same rule checks.
- **CI**: GitHub Actions workflow `Tests` runs on pushes and pull requests to `main`.

Previous v2.4 features remain:

- Prism arcade theme, hazards, combos, bonus fruit, level speed, swipe, pause, best score.

## Controls

- Arrow keys: move
- Swipe on the board: move
- On-screen d-pad: move
- `Space` or `P`: pause/resume

## Run locally

```sh
python3 -m http.server 8080
```

- Game: <http://localhost:8080>
- **Test results UI**: <http://localhost:8080/tests.html>

## Run tests locally

```sh
python3 -m unittest discover -s tests -p "test_*.py" -v
```

When [Node.js](https://nodejs.org/) is installed:

```sh
node tests/game-tests-runner.mjs
```

Install Node to run the Snake rule tests on your machine (CI always has Node).

## Deploy

The app is configured for Fly.io in `fly.toml` and is deployed from GitHub Actions when changes land on `main`.

Required repository secrets:

- `FLY_API_TOKEN`
- `SLACK_WEBHOOK_URL` for deploy notifications

## Release download

Release packaging is manual. Run the **Release** GitHub Actions workflow, enter the version to build (default `v2.5`), and choose whether to publish the GitHub release. The workflow uploads a single playable `snake-<version>.html`; a GitHub Release is created only when `publish_release` is `true`.

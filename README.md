# Snake v2.3

A lightweight static Snake game served by nginx and deployed to Fly.io.

## What's in v2.3

- Refreshed orchard-style theme with clearer cards, score chips, and mobile controls.
- Persistent best score saved in the browser with `localStorage`.
- Keyboard, d-pad, and swipe controls.
- Pause and resume with `Space` or `P`.
- Bonus fruit gameplay: every fifth point can spawn a timed golden fruit worth extra points.
- Progressive pace: the game speeds up as the level increases.
- Fly.io deployment workflow with Slack deploy notifications.

## Controls

- Arrow keys: move
- Swipe on the board: move
- On-screen d-pad: move
- `Space` or `P`: pause/resume

## Run locally

This is a static app. Any local static server works:

```sh
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Deploy

The app is configured for Fly.io in `fly.toml` and is deployed from GitHub Actions when changes land on `main`.

Required repository secrets:

- `FLY_API_TOKEN`
- `SLACK_WEBHOOK_URL` for deploy notifications

The deploy workflow posts start, success, and failure messages to Slack with the app URL, commit SHA, commit author, commit message, workflow actor, and deploy duration when available.

## Release download

Tagged releases publish a single playable HTML file named `snake-<tag>.html`, such as `snake-v2.3.html`. Download it from the GitHub release page and open it in a browser; no server or extra files are required.

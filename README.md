# Snake v2.4

A lightweight static Snake game served by nginx and deployed to Fly.io.

## What's in v2.4

- Refreshed prism arcade theme with richer canvas graphics and mobile controls.
- Persistent best score saved in the browser with `localStorage`.
- Keyboard, d-pad, and swipe controls.
- Pause and resume with `Space` or `P`.
- Bonus fruit gameplay: every fifth point can spawn a timed golden fruit worth extra points.
- Progressive pace: the game speeds up as the level increases.
- Combo scoring: collect fruit quickly to stack extra points.
- Prism hazards appear as levels increase.
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

Release packaging is manual. Run the "Release" GitHub Actions workflow, enter the version to build, and choose whether to publish the GitHub release. The workflow always builds a single playable HTML artifact named `snake-<version>.html`; it only creates/updates a GitHub Release when `publish_release` is set to `true`.

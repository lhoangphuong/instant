#!/usr/bin/env bash
# Posts to Slack Incoming Webhook (e.g. #cursor-chat). Requires SLACK_WEBHOOK_URL.
# Usage: slack-notify.sh {start|success|failure} [duration_seconds]
set -euo pipefail

if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
  echo "SLACK_WEBHOOK_URL not set — skipping Slack"
  exit 0
fi

phase="${1:-}"
duration_raw="${2:-}"

RUN_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
SHORT_SHA="${GITHUB_SHA:0:7}"
REPO="${GITHUB_REPOSITORY}"
COMMIT_AUTHOR="$(git log -1 --pretty=format:'%an <%ae>' "$GITHUB_SHA" 2>/dev/null || echo "${GITHUB_ACTOR}")"
COMMIT_MESSAGE="$(git log -1 --pretty=format:'%s' "$GITHUB_SHA" 2>/dev/null || echo "Commit message unavailable")"
commit_line="*Commit:* \`${SHORT_SHA}\` by ${COMMIT_AUTHOR}
*Message:* ${COMMIT_MESSAGE}"

fly_app=""
fly_base_url=""
url_line=""
if [[ -f fly.toml ]]; then
  line="$(grep -m1 '^app[[:space:]]*=' fly.toml)" || true
  if [[ "$line" =~ \'([^\']+)\' ]]; then
    fly_app="${BASH_REMATCH[1]}"
  elif [[ "$line" =~ \"([^\"]+)\" ]]; then
    fly_app="${BASH_REMATCH[1]}"
  elif [[ "$line" =~ =[[:space:]]*([^[:space:]#]+) ]]; then
    fly_app="${BASH_REMATCH[1]}"
  fi
  if [[ -n "$fly_app" ]]; then
    fly_base_url="https://${fly_app}.fly.dev"
    url_line="*Fly app:* <${fly_base_url}|${fly_app}.fly.dev>"
  fi
fi

format_duration() {
  local sec="$1"
  if [[ ! "$sec" =~ ^[0-9]+$ ]]; then
    echo "—"
    return
  fi
  if ((sec < 60)); then
    echo "${sec}s"
  else
    local m=$((sec / 60)) r=$((sec % 60))
    echo "${m}m ${r}s"
  fi
}

duration_line=""
if [[ -n "$duration_raw" && "$duration_raw" =~ ^[0-9]+$ ]]; then
  duration_line="*Deploy duration:* $(format_duration "$duration_raw")"
fi

case "$phase" in
  start)
    HDR="Fly deploy starting"
    ICO=":rocket:"
    BODY="*\`${REPO}\`* • branch \`${GITHUB_REF_NAME}\` • \`${GITHUB_ACTOR}\`
${commit_line}
Building and deploying to Fly.io…"
    if [[ -n "$url_line" ]]; then
      BODY+="
${url_line}"
    fi
    BODY+="
<${RUN_URL}|View workflow run>"
    FOOT="Deploy *started* · #cursor-chat (webhook channel)"
    ;;
  success)
    HDR="Fly deploy finished"
    ICO=":white_check_mark:"
    BODY="*\`${REPO}\`* is live on Fly.io
\`${GITHUB_REF_NAME}\` • \`${GITHUB_ACTOR}\`
${commit_line}"
    if [[ -n "$duration_line" ]]; then
      BODY+="
${duration_line}"
    fi
    if [[ -n "$url_line" ]]; then
      BODY+="
${url_line}"
    fi
    BODY+="
<${RUN_URL}|View workflow run>"
    FOOT="Deploy *succeeded* · #cursor-chat (webhook channel)"
    ;;
  failure)
    HDR="Fly deploy failed"
    ICO=":x:"
    BODY="*\`${REPO}\`* deploy did not finish
\`${GITHUB_REF_NAME}\` • \`${GITHUB_ACTOR}\`
${commit_line}"
    if [[ -n "$duration_line" ]]; then
      BODY+="
${duration_line}"
    fi
    if [[ -n "$url_line" ]]; then
      BODY+="
${url_line}"
    fi
    BODY+="
<${RUN_URL}|View workflow run>"
    FOOT="Deploy *failed* · #cursor-chat (webhook channel)"
    ;;
  *)
    echo "usage: $0 {start|success|failure} [duration_seconds]" >&2
    exit 1
    ;;
esac

PAYLOAD=$(jq -n \
  --arg username "GitHub Actions" \
  --arg icon "$ICO" \
  --arg hdr "$HDR" \
  --arg body "$BODY" \
  --arg foot "$FOOT" \
  '{
    username: $username,
    icon_emoji: $icon,
    blocks: [
      { type: "header", text: { type: "plain_text", text: $hdr, emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: $body } },
      { type: "context", elements: [ { type: "mrkdwn", text: $foot } ] }
    ]
  }')

curl -sS -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-Type: application/json; charset=utf-8' \
  -d "$PAYLOAD"

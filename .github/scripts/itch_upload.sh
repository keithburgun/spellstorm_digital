#!/usr/bin/env bash
# Upload Spellstorm to itch.io with butler.  Usage: itch_upload.sh <apk> <exe> <html-zip or ""> <version>
# Needs BUTLER_API_KEY and ITCH_GAME (user/game). Every butler error is reported as a GitHub annotation
# and in the job summary, so problems are visible without opening the raw log.
set -u
APK="$1"; EXE="$2"; HTML="$3"; VERSION="$4"; FAILED=0
summary(){ echo "$1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; }
if [ ! -x ./butler/butler ]; then
  curl -sSL -o butler.zip https://broth.itch.zone/butler/linux-amd64/LATEST/archive/default && unzip -qo butler.zip -d butler && chmod +x butler/butler || { echo "::error title=itch.io::Couldn't download butler"; exit 1; }
fi
./butler/butler -V
summary "### itch.io upload — $ITCH_GAME, version $VERSION"
# 1. Can the key see the game? (catches a wrong key or a wrong ITCH_GAME before any upload)
out=$(./butler/butler status "$ITCH_GAME" 2>&1); rc=$?; echo "$out"
if [ $rc -ne 0 ]; then
  msg=$(echo "$out" | grep -v '^\s*$' | tail -4 | tr '\n' ' ' | cut -c1-600)
  echo "::error title=itch.io: can't access $ITCH_GAME::$msg"; summary "- ❌ Can't access **$ITCH_GAME**: \`$msg\`"; exit 1
fi
summary "- ✅ API key works and can see **$ITCH_GAME**"
push(){ local file="$1" ch="$2"
  if [ -z "$file" ] || [ ! -f "$file" ]; then summary "- ⏭ $ch: no file"; return; fi
  out=$(./butler/butler push "$file" "$ITCH_GAME:$ch" --userversion "$VERSION" 2>&1); rc=$?; echo "$out"
  if [ $rc -ne 0 ]; then FAILED=1; msg=$(echo "$out" | grep -v '^\s*$' | tail -4 | tr '\n' ' ' | cut -c1-600)
    echo "::error title=itch.io upload failed: $ch::$msg"; summary "- ❌ **$ch** ($(basename "$file")): \`$msg\`"
  else summary "- ✅ **$ch**: $(basename "$file") uploaded as $VERSION"; fi; }
push "$APK" android
push "$EXE" windows
push "$HTML" html5
./butler/butler status "$ITCH_GAME" 2>&1 | tee /tmp/itch_status.txt
summary ""; summary '```'; cat /tmp/itch_status.txt >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; summary '```'
exit $FAILED

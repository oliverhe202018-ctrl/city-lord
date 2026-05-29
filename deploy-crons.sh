#!/bin/bash

# ==============================================================================
# City Lord Game - Cron Jobs VPS Deployment Script
# ==============================================================================
# This script configures Linux system crontab to execute game scheduled tasks
# against Next.js API endpoints on the local or production VPS.
# ==============================================================================

# Exit on any error
set -e

# Default settings
DEFAULT_APP_URL="http://localhost:3000"
DEFAULT_CRON_SECRET="aaa021300"
LOG_DIR="$HOME/.citylord/logs"
LOG_FILE="$LOG_DIR/crons.log"

echo "=============================================================================="
echo "          City Lord Scheduled Tasks Crontab Installer (VPS)"
echo "=============================================================================="

# Read existing configuration if present in environment or prompt
APP_URL="${APP_URL:-$DEFAULT_APP_URL}"
CRON_SECRET="${CRON_SECRET:-$DEFAULT_CRON_SECRET}"

if [ -z "$CRON_SECRET" ]; then
    echo "⚠️  [Warning]: CRON_SECRET is empty. Please enter your secret token:"
    read -r -s -p "Enter CRON_SECRET: " user_secret
    echo ""
    CRON_SECRET="$user_secret"
fi

if [ -z "$CRON_SECRET" ]; then
    echo "❌ [Error]: CRON_SECRET cannot be empty. Aborting deployment."
    exit 1
fi

echo "ℹ️  Using Target App URL: $APP_URL"
echo "ℹ️  Cron Log File Path : $LOG_FILE"

# Create log directory if not exists
mkdir -p "$LOG_DIR"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE"

# Prepare unique identifier boundaries
START_MARKER="# === CITYLORD CRONS START ==="
END_MARKER="# === CITYLORD CRONS END ==="

# Get current crontab, filtering out previous citylord crons block
TMP_CRON=$(mktemp)
crontab -l 2>/dev/null | sed "/$START_MARKER/,/$END_MARKER/d" > "$TMP_CRON" || true

# Append the new cron block
cat << EOF >> "$TMP_CRON"
$START_MARKER
# City Lord Scheduled API Jobs - Deployed $(date)
# Logs are rotated/saved to: $LOG_FILE

# 1. stamina-recovery (Every 5 minutes - High Frequency)
*/5 * * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/stamina-recovery" >> "$LOG_FILE" 2>&1

# 2. territory-stats-worker (Every 1 minute - Concurrency Safe with Advisory Lock)
* * * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/territory-stats-worker" >> "$LOG_FILE" 2>&1

# 3. update-faction-stats (Every 5 minutes - High Frequency)
*/5 * * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/update-faction-stats" >> "$LOG_FILE" 2>&1

# 4. update-province (Every 1 hour - Medium Frequency)
0 * * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/update-province" >> "$LOG_FILE" 2>&1

# 5. activity-reminder (Every 1 hour at the 30-minute mark)
30 * * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/activity-reminder" >> "$LOG_FILE" 2>&1

# 6. npc-invasion (Every 12 hours - Medium Frequency)
0 */12 * * * curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/npc-invasion" >> "$LOG_FILE" 2>&1

# 7. leaderboard-snapshot (Daily at midnight 00:00)
0 0 * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/leaderboard-snapshot" >> "$LOG_FILE" 2>&1

# 8. reset-missions (Daily at midnight 00:00)
0 0 * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/reset-missions" >> "$LOG_FILE" 2>&1

# 9. faction-settlement (Daily at midnight 00:05 - Buffered offset)
5 0 * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/faction-settlement" >> "$LOG_FILE" 2>&1

# 10. daily-stats (Daily at midnight 00:10 - Buffered offset)
10 0 * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/daily-stats" >> "$LOG_FILE" 2>&1

# 11. territory-decay-monitor (Daily at 02:00 AM - Off-peak hour)
0 2 * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/territory-decay-monitor" >> "$LOG_FILE" 2>&1

# 12. territory-reconcile (Daily at 03:00 AM - Off-peak hour)
0 3 * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/territory-reconcile" >> "$LOG_FILE" 2>&1

# 13. cleanup-invitations (Daily at 04:00 AM - Off-peak hour)
0 4 * * * curl -sS -X GET -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/cleanup-invitations" >> "$LOG_FILE" 2>&1
$END_MARKER
EOF

# Install new crontab
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

echo "=============================================================================="
echo "✅ Deployed City Lord Crontabs Successfully!"
echo "ℹ️  Run 'crontab -l' to inspect."
echo "ℹ️  Logs will be output to: tail -f $LOG_FILE"
echo "=============================================================================="

#!/usr/bin/env bash
# Render title cards for the bakmark series: blurred frame from the footage,
# left-aligned sans title, thin accent bar. 4K, 3 s, fade in/out.
# Usage: scripts/make-titles.sh
set -euo pipefail

# Footage lives outside the repo, so that a project tree stays safe to delete.
# Override FOOTAGE_DIR when the footage sits somewhere else.
FOOTAGE_DIR="${FOOTAGE_DIR:-$HOME/footage}"
SRC="$FOOTAGE_DIR/bron/edit"
OUT="$FOOTAGE_DIR/titels"
SANS=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
BOLD=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
mkdir -p "$OUT"

# slug | title | source clip | frame position
mk() {
  slug=$1; title=$2; src=$3; pos=$4
  ffmpeg -v error -y -ss "$pos" -i "$SRC/$src" -frames:v 1 \
    -vf "scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,boxblur=42:2,eq=brightness=-0.12:saturation=0.9,vignette=PI/4" \
    "/tmp/bg-$slug.png"

  ffmpeg -v error -y -loop 1 -i "/tmp/bg-$slug.png" -t 3 -r 30 \
    -vf "drawbox=x=220:y=1085:w=120:h=7:color=0xa1471b@1:t=fill,\
drawtext=fontfile=$SANS:text='BAKMARK.NL':x=220:y=1120:fontsize=44:fontcolor=0xf6e7c8@0.8,\
drawtext=fontfile=$BOLD:text='$title':x=216:y=1180:fontsize=168:fontcolor=0xfffaf1,\
fade=t=in:st=0:d=0.6,fade=t=out:st=2.4:d=0.6" \
    -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p "$OUT/titel-$slug.mp4"
  echo "  titel-$slug.mp4"
}

mk banketbakkersroom "Banketbakkersroom" 01-banketbakkersroom-cfr30.mp4 00:05:30
mk slagroom "Slagroom" 03-slagroom-b-cfr30.mp4 00:02:00
mk soezenbeslag "Soezenbeslag" 04-soezenbeslag-cfr30.mp4 00:06:00
mk soesjes "Soesjes" 05-soesjes-portret-cfr30.mp4 00:00:50
mk zwitserse-room "Zwitserse room" 03-slagroom-b-cfr30.mp4 00:04:00
mk soesjes-met-zwitserse-room "Soesjes met room" 05-soesjes-portret-cfr30.mp4 00:09:30
echo "klaar"

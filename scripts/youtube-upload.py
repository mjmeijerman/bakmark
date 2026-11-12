#!/usr/bin/env python3
"""Upload one bakmark recipe video to YouTube, with its metadata from the repo.

    scripts/youtube-upload.py banketbakkersroom --check
    scripts/youtube-upload.py banketbakkersroom

Reads, and never writes back into, these:
    ~/.config/bakmark/youtube-client.json    OAuth desktop client (not in the repo)
    ~/.config/bakmark/youtube-token.json     cached token, made on the first run
    $FOOTAGE_DIR/<slug>/<slug>-4k.mp4        the render
    $FOOTAGE_DIR/<slug>/thumb-youtube-final-1280x720.jpg
    $FOOTAGE_DIR/<slug>/transcript.srt       as Dutch subtitles (language "nl")
    $FOOTAGE_DIR/<slug>/transcript.<lang>.srt  any further track, e.g. transcript.en.srt
    $FOOTAGE_DIR/<slug>/youtube-beschrijving.txt   printed by: npm run chapters -- <slug>
    recipes/<slug>.json                      title, subtitle, tags

Quota: one upload costs 1600 of the 10,000 units a day, so six a day at most.
An unaudited project gets its uploads locked to private; flip them in Studio.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
# Renders and footage live outside the repo, so deleting the checkout never
# takes the videos with it. Same default as scripts/make-titles.sh.
FOOTAGE = Path(os.environ.get("FOOTAGE_DIR") or Path.home() / "bakmark-footage")
CONF = Path.home() / ".config" / "bakmark"
CLIENT = CONF / "youtube-client.json"
TOKEN = CONF / "youtube-token.json"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]
CATEGORY_HOWTO = "26"

# The language code in the filename is the only thing that decides the track;
# the name is what a viewer sees in the YouTube subtitle menu.
CAPTION_LANGUAGES = {
    "nl": "Nederlands",
    "en": "English",
    "de": "Deutsch",
    "fr": "Français",
    "es": "Español",
}


def fail(message: str) -> None:
    raise SystemExit(f"[youtube] {message}")


def first_existing(*paths: Path) -> Path | None:
    for path in paths:
        if path.exists():
            return path
    return None


def caption_tracks(folder: Path) -> list[dict]:
    """Every transcript in the folder: transcript.srt is Dutch, transcript.<lang>.srt the rest."""
    tracks: list[dict] = []
    default = folder / "transcript.srt"
    if default.exists():
        tracks.append({"path": default, "language": "nl", "name": CAPTION_LANGUAGES["nl"]})
    seen = {track["language"] for track in tracks}
    for path in sorted(folder.glob("transcript.*.srt")):
        language = path.name.split(".")[1].lower()
        if language in seen:
            continue
        seen.add(language)
        tracks.append(
            {"path": path, "language": language, "name": CAPTION_LANGUAGES.get(language, language)}
        )
    return tracks


def plan(slug: str) -> dict:
    folder = FOOTAGE / slug
    recipe_path = BASE / "recipes" / f"{slug}.json"
    if not recipe_path.exists():
        fail(f"no recipe at {recipe_path}")
    recipe = json.loads(recipe_path.read_text())

    video = first_existing(folder / f"{slug}-4k.mp4", folder / f"{slug}-1080p.mp4")
    thumbnail = first_existing(folder / "thumb-youtube-final-1280x720.jpg")
    captions = caption_tracks(folder)
    description_file = first_existing(folder / "youtube-beschrijving.txt")

    missing = [
        name
        for name, value in (
            ("render", video),
            ("thumbnail", thumbnail),
            ("description", description_file),
        )
        if value is None
    ]
    if missing:
        fail(f"missing in {folder}: {', '.join(missing)}")
    if "Recept met dezelfde stappen" not in description_file.read_text():
        fail(
            f"{description_file} does not look generated; run: "
            f"SITE_URL=https://bakmark.nl npm run chapters -- {slug}"
        )

    return {
        "slug": slug,
        "recipe": recipe,
        "video": video,
        "thumbnail": thumbnail,
        "captions": captions,
        "description": description_file.read_text().strip(),
        "title": f"{recipe['title']} maken",
        "tags": recipe.get("tags", []),
    }


def credentials():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow

    if not CLIENT.exists():
        fail(f"no OAuth client at {CLIENT}; see the README in docs/shotcut-manual.md")

    creds = None
    if TOKEN.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if creds and creds.valid:
        return creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        if not CLIENT.exists():
            fail(f"no client at {CLIENT}")
        flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT), SCOPES)
        print("[youtube] a browser opens for consent; pick your own account", flush=True)
        creds = flow.run_local_server(port=0, open_browser=True)

    TOKEN.write_text(creds.to_json())
    TOKEN.chmod(0o600)
    return creds


def upload(info: dict, privacy: str) -> str:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    youtube = build("youtube", "v3", credentials=credentials())

    body = {
        "snippet": {
            "title": info["title"][:100],
            "description": info["description"][:5000],
            "tags": [tag[:100] for tag in info["tags"]][:30],
            "categoryId": CATEGORY_HOWTO,
            "defaultLanguage": "nl",
            "defaultAudioLanguage": "nl",
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
            "license": "youtube",
            "embeddable": True,
        },
    }

    size = info["video"].stat().st_size
    media = MediaFileUpload(str(info["video"]), chunksize=32 * 1024 * 1024, resumable=True)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    print(f"[youtube] uploading {size / 1e9:.2f} GB", flush=True)
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"  {int(status.progress() * 100):3d}%", flush=True)

    video_id = response["id"]
    print(f"[youtube] video {video_id}  https://youtu.be/{video_id}", flush=True)

    # A custom thumbnail needs a verified channel. A failure here costs a
    # click in Studio, not the upload, so it must not abort the run.
    try:
        youtube.thumbnails().set(
            videoId=video_id, media_body=MediaFileUpload(str(info["thumbnail"]))
        ).execute()
        print("[youtube] thumbnail set", flush=True)
    except Exception as error:  # noqa: BLE001 - reported, not raised
        print(f"[youtube] thumbnail NOT set: {error}", flush=True)

    if info["captions"]:
        for track in info["captions"]:
            try:
                youtube.captions().insert(
                    part="snippet",
                    body={
                        "snippet": {
                            "videoId": video_id,
                            "language": track["language"],
                            "name": track["name"],
                            "isDraft": False,
                        }
                    },
                    media_body=MediaFileUpload(str(track["path"])),
                ).execute()
                print(f"[youtube] subtitles {track['language']} set", flush=True)
            except Exception as error:  # noqa: BLE001 - reported, not raised
                print(f"[youtube] subtitles {track['language']} NOT set: {error}", flush=True)
    else:
        print("[youtube] no transcript.srt, skipping subtitles", flush=True)

    return video_id


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slug")
    parser.add_argument("--privacy", default="private", choices=["private", "unlisted", "public"])
    parser.add_argument("--title", help="override the title")
    parser.add_argument("--check", action="store_true", help="validate the files and stop")
    args = parser.parse_args()

    info = plan(args.slug)
    if args.title:
        info["title"] = args.title

    print(f"[youtube] title:       {info['title']}")
    print(f"[youtube] render:      {info['video']}")
    print(f"[youtube] thumbnail:   {info['thumbnail']}")
    tracks = ", ".join(track["language"] for track in info["captions"]) or "-"
    print(f"[youtube] subtitles:   {tracks}")
    print(f"[youtube] description: {len(info['description'])} chars, "
          f"{info['description'].count(chr(10) + '0') + info['description'].count(chr(10) + '1') + info['description'].count(chr(10) + '2')} chapters")
    print(f"[youtube] tags:        {', '.join(info['tags'][:5])}")
    print(f"[youtube] privacy:     {args.privacy}")

    if args.check:
        print("[youtube] check only, nothing uploaded")
        return

    video_id = upload(info, args.privacy)
    print(f"[youtube] done: https://youtu.be/{video_id}", flush=True)


if __name__ == "__main__":
    main()

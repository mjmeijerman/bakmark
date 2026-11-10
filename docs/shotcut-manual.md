# Shotcut manual — bakmark video workflow

Shotcut is free, open source, **no watermark, no paid tier, no export limits**. Nothing is ever stamped on your video.

> **Lees §14 eerst.** Een groot deel van dit handwerk — projecten opzetten, titels, filters, exporteren — kan Pi voor je doen zonder dat je in Shotcut klikt. Dat scheelt uren.

---

## 1. Install

```bash
sudo apt install shotcut        # Ubuntu/Mint
```
Or download the AppImage from shotcut.org (any distro, no install needed).

Also install `ffmpeg` — needed for some codecs and for extracting audio.

---

## 2. Project setup (do this first, every video)

1. Make a folder `~/footage/bakken-aflevering-01/` and put in it: raw footage, `logo.png` (transparent PNG), `music.mp3`, the `.mlt` project file. **Footage never goes inside the git checkout** — a repo has to stay safe to delete. `FOOTAGE_DIR` overrides the location; the scripts default to `~/footage`.
2. Open Shotcut → **New Project** → save the `.mlt` into that folder.
3. Settings → **Video Mode** → `UHD 2160p 30 fps`. Your source is 4K — a 4K timeline keeps the full zoom range (see §8). Set this before dragging anything in; changing it later shifts every clip.
4. Settings → **Proxy → Use Proxy Files**, and **Preview Scaling → 540p**. Builds half-res copies so 4K scrubs without stutter. Preview only — the export always uses your originals. Proxies build in the background after import; wait for the task bar to finish before judging playback.
5. Settings → **Use Hardware Decoder** if the source is H.265/HEVC. Large playback speedup.
6. Timeline tracks (right-click timeline → **Add Audio/Video Track**):
   - **V2** = logo + text overlays
   - **V1** = main video
   - **A1** = voice/original sound
   - **A2** = music

---

## 3. Intro screen (colored background + text)

1. **Open Other → Color** → pick your brand color → drag onto **V2** at 0:00.
2. Drag the clip's right edge to 3–4 seconds.
3. Select it → **Filters (+)** → **Text: Simple**:
   - Text: `Deel 1: Banketbakkersroom`
   - Font size ~90, center, white
4. Same clip → add filter **Fade In Video** and **Fade Out Video** (1 s each).
5. Optional: add **Text: Simple** again lower down for a subtitle line.

Intro should be **max 4 seconds**. Longer intros lose viewers.

---

## 4. Logo watermark

1. Drag `logo.png` onto **V2** (above the video). It snaps at the top.
2. Select the logo **track** head (left side) → **Blend mode: Screen** if the PNG has a white background. Skip if your PNG is truly transparent.
3. Right-click the logo clip → **Properties** → set **Duration** to your full video length (e.g. `00:09:30:00`). Or copy the logo clip and paste along the timeline.
4. Select logo clip → **Filters (+)** → **Size, Position & Rotate** → **Size** `15%`, **Position** preset `Top Right`, margin 32 px.
5. Optional: **Opacity** filter → `70%` so it sits behind the picture content.

One logo, top-right, one position, whole video. Don't animate it.

---

## 5. Text over the video ("bakproces 10x versneld")

1. Move the playhead to where you want the text.
2. **Open Other → Text** → type `Bakproces 10× versneld` → drag onto **V2**.
3. Drag the edges so it lasts exactly as long as the fast section.
4. Filters → **Text: Simple** → size ~60, white, drop shadow on (so it reads over any footage), position bottom-center.

Same clip can be reused: copy it, paste, edit the text.

---

## 6. Cut out parts

1. Play the timeline. Press **`S`** to split at the playhead (do it at the start and end of the bad part).
2. Click the middle piece → **`Delete`**.
3. Everything after it leaves a gap — click a gap → **Ripple Delete** (`Ctrl+Shift+Delete`... or right-click → Ripple Delete) to close it.
4. `Ctrl+Z` undoes anything.

Shortcut cheat sheet: `S` split · `Delete` remove · `Space` play/pause · `←/→` one frame · `J/K/L` rewind/stop/fast-forward.

---

## 7. Speed up a part (10x)

1. Select the clip → **Properties** panel → **Speed** field → type `1000` (that's 1000% = 10×).
2. The clip becomes 1/10th as long. Tick **Ripple** if you want the rest of the timeline to shift up.
3. Put the "bakproces 10× versneld" text on top of it (section 5).

Fine-grained control: instead of Properties, right-click the clip → **Filters → Time Remap** and keyframe speed per segment.

Audio pitch goes up at 10× — mute A1 for that section and let the music cover it.

---

## 8. Zoom, pan and rotate

Use **Size, Position & Rotate**, with keyframes.

1. Select the clip → **Filters (+)** → **Size, Position & Rotate**.
2. Move the playhead to where the zoom starts. Click the **keyframe** button (stopwatch icon) next to **Size** and **Position**.
3. Move the playhead to where the zoom should be done (e.g. 1.5 s later). Set **Size** to `180%`, drag the image so the important part is centered. A new keyframe is created automatically.
4. Press play — it now eases from wide to zoomed.
5. To pan across, add a third keyframe further along and drag **Position** to a new spot.

**You have 4K source, so zoom freely.** Export at 1080p always: 4K → 1080p is a 2× downscale, so a `200%` zoom is still pixel-perfect, `300%` is acceptable, past `400%` it turns to mush. The preview looks soft while proxies are active — the export is sharp.

If one source clip is only 1080p, Shotcut upscales it into the 4K timeline. That's fine, but that clip's zoom ceiling is 200%.

Optional: **Smooth** checkbox in the filter to make keyframes ease instead of linear.

### Rotate a whole clip (phone footage shot sideways)

1. Same filter: **Size, Position & Rotate** → **Rotation** `90` (or `-90`, `180`).
2. Rotation exposes empty corners, so **you must raise Size to refill the frame**. A 90° turn needs **`178%`** — a 4K 16:9 clip turned upright is only 2160 px wide, and you need 3840.
3. Result is a heavy crop: you keep the middle third of the original. Shoot properly next time, or accept it.
4. If the footage is portrait phone video, better plan: make a **separate 9:16 project** for Shorts/Reels (`Settings → Video Mode → Vertical HD 1080p 30`) and upload that as its own video. Don't rotate portrait footage into a landscape episode.

### Rotate only part of a clip

Filters apply to the whole clip, so split first: move the playhead to the start of the part, press **`S`**, move to the end, press **`S`**. Select only the middle piece and apply the filter to that. The neighbours are untouched.

To change the angle *during* a clip, keyframe **Rotation** the same way as Size in step 2–3 above.

### Straighten a tilted shot (0.5–3°)

The common case: your camera sat slightly crooked on the tripod and the countertop runs downhill.

1. **Rotation** `2.5` (positive tilts clockwise, negative counter-clockwise).
2. **Size** `108%` — mandatory. Any angle other than 90/180/270° leaves black wedges in the corners, and the extra size crops them out.

Shotcut also asks *"Convert to Edit-friendly?"* on import when phone footage carries a rotation flag. Answer **Yes** — it bakes the rotation in and you never need the filter.

---

## 9. Remove noise (mixer sounds, hum, fridge)

Two filters, in this order:

1. **High Pass** filter → frequency `120 Hz`. Kills rumble, mixer motor, table thumps, wind. Do this first.
2. **Reduce Noise: Simple** → `20%`. Quick, no setup.
   - Better result: **Reduce Noise: Advanced** → select a 1-second silent stretch → click **Analyze** → then **Apply**. This learns your room's actual noise floor.
3. Check with headphones. Too much reduction = underwater/robotic voice. If it sounds hollow, back off to 15%.
4. **Gain / Volume** filter to bring speech to a consistent level.

For future recordings: record on a separate phone/recorder placed near the talking person, sync it in Shotcut with **Detach Audio** + align the waveform. Cleaner source beats any filter.

---

## 10. Background music

Free, no attribution required: **Pixabay Music**, **Mixkit**, **Free Music Archive** (filter CC0). Avoid CC-BY unless you're willing to credit in the description.

1. Drag the track onto **A2**. It will be louder than intended — that's normal.
2. **Filters (+)** → **Gain / Volume** → **Level** `-18 dB` (music should sit under the voice).
3. Add **Fade In Audio** and **Fade Out Audio**, 2 s each.
4. Add **Duck** manually: for each speaking section, split the music clip (`S`) and drop the volume another `-6 dB` on those pieces. Shotcut also has a **Compressor: Makeup** + **Duck** filter combo, but manual volume is faster to learn.
5. Music must not loop awkwardly — cut at a musical beat, or set **Properties → Speed** to fit the length.

### The music for this series

One artist for the whole series, so every episode sounds like the same channel:

**TungArt7** — <https://pixabay.com/users/tungart7-38741244/?tab=music&order=latest&pagi=1>

- Solo piano, modern classical, instrumental, no vocals. Exactly what sits under a talking baking video without masking words.
- First pick: **Long distance love** (4:00). Save it as `TungArt7-Long-Distance-Love.mp3`.
- Grab **two more** from that same page and rotate one per section (ingredienten / banketbakkersroom / zwitserse room). One 4-minute track cannot cover a 10-minute episode without looping audibly.
- Level it at **-20 dB**, not -18. Piano occupies the same frequencies as speech and masks it sooner than pads or strings do.
- Licence: **Pixabay Content License** — commercial use, no credit required, but you may not re-upload the track standalone as a music video.
- Artist name in the filename (`TungArt7-Long-Distance-Love.mp3`) is your credits record, for free. Keep it.
- Solo nostalgic piano is the most common style on cooking channels — safe rather than distinctive. That is the correct trade if the goal is "no trouble".

**Before publishing any episode**, upload it **unlisted** and open YouTube Studio → Content → the **Copyright** column. Empty after 15 minutes = clear. A claim is not a strike, but a claimed video earns you nothing, so swap the track instead of disputing it.

---

## 11. Three separate videos *and* one combined video

You want each part as its own upload **and** all three merged. That flips the usual rule: **edit each part first, combine last.** "Combine first" exists to avoid duplicate work — you're accepting some duplication to get 4 videos out of one shoot.

1. One folder, four projects:
```
~/footage/zwitserse-room/
  raw/                      01-slagroom.mp4  02-banketbakkersroom.mp4  03-zwitserse-room.mp4
  part1-slagroom.mlt
  part2-banketbakkersroom.mlt
  part3-zwitserse-room.mlt
  master-alles.mlt
  logo.png   music.mp3
```
2. Edit each part **completely** in its own project: cuts, speed, zooms, overlay text, logo, its own intro card (`Deel 1: Slagroom`), music with fade in/out. Each part must be an uploadable video on its own before you move on.
3. Export each part → 1080p. Those are 3 of your 4 uploads. Done, you already have them.
4. Open `master-alles.mlt` → **File → Open MLT XML As Clip** → pick `part1-slagroom.mlt`. It loads into the Source player → append to timeline. Repeat for parts 2 and 3.
   - This reuses the **originals**, so there is **no quality loss** and no re-encode of your edits.
   - Changed a part afterwards? Edit the part project, save, then re-add that clip in the master.
5. In the master only: overall intro card, transitions at the two joints (drag the later clip left to overlap ~15 frames → automatic crossfade), end card.
6. Add **Markers** (`M`) at the part boundaries — those become your YouTube chapter timestamps. Export → 4th upload.

What will bite you:
- **Video Mode must be `UHD 2160p 30` in all four projects.** If the master's mode differs, it resamples the parts and softens them.
- **Intro count:** 4 cards total — one per part, one for the master. Never put the master intro inside a part.
- **Music:** each part gets its own track with fades, so the combined version pauses naturally between parts. You cannot run one continuous track across three independent projects.
- **Fallback** if your version lacks *Open MLT XML As Clip*: export each part to a high-bitrate 4K master (Quality `75%`), then combine those in the master project. Simpler, costs one generation of quality.

Do not cut or zoom the raw files inside the master. The master is for assembly only.

---

## 12. Export

1. **Export** panel → preset **YouTube** (or **H.264 High Profile**).
2. Advanced:
   - Resolution `1920×1080` — the downscale is what makes your zooms sharp. Don't export 2160p unless you want a 4 GB file for no visible gain on YouTube.
   - Frame rate `30`, matching your project
   - Codec `libx264`, **Quality** `65%` (visually lossless enough, roughly 1 GB per 10 min)
   - Audio `AAC 192 kbps`
   - Tick **Parallel processing**
3. **Export File**. A 10-minute video from a 4K timeline: 20–60 minutes depending on CPU. Don't edit during the render.

Watch the finished file start-to-finish at 1× before uploading. Renders hide glitches that playback doesn't.

---

## 13. Before you upload to YouTube

Ranked, do them in this order:

1. **Audio level.** Target average **-14 LUFS**, peaks never above **-1 dB**. YouTube normalizes everything to -14 LUFS, so louder just gets turned down and quieter sounds weak. Check with `ffmpeg -i out.mp4 -af loudnorm=print_format=summary -f null -`.
2. **Thumbnail.** 1280×720, readable at 120 px wide. Show the end result (the pastry), not your kitchen.
3. **First 3 seconds.** No logo animation, no "hey guys welcome back". Start on the food or a strong statement.
4. **Chapter markers.** Put timestamps in the description (`00:00 Intro`, `00:45 Ingredienten`, `01:20 Banketbakkersroom`). YouTube turns them into chapters automatically.
5. **Subtitles.** YouTube auto-captioning mangles Dutch baking terms (banketbakkersroom, roomboter). Export an SRT from Shotcut (**Subtitle panel → Export**) and upload it manually.

Also worth doing, later: end screen (5 s of static card with subscribe), description with recipe link, pin a comment, and check the video plays on a phone.

---

## Time estimates

| Task | First time | After practice |
|---|---|---|
| Install + setup | 20 min | 2 min |
| Intro + logo | 25 min | 5 min |
| Cuts + speed | 30 min | 10 min |
| Zooms | 20 min per shot | 5 min |
| Noise + music | 20 min | 8 min |
| Combine finished parts | 15 min | 5 min |
| Export + check | 60 min (4K) | 45 min |

A 10-minute episode from three recordings: **first attempt ≈ 4 hours, experienced ≈ 1 hour of editing.** Budget an extra hour per part when exporting all four outputs.

---

## Order of operations (saves the most time)

1. Edit and finish part 1 → export it. Repeat for each part: cuts, then speed, then zooms, text, logo, intro, audio, music.
2. Combine the finished parts in the master project (`Open MLT XML As Clip`), add master intro + transitions, export.

Never do the logo or intro before cutting; you'll redo them.

---

## Should you switch to DaVinci Resolve?

Not yet. Resolve is better at motion polish (bezier keyframe easing, real retime curves), text styling, hardware export speed, and it has a tidier "new timeline from clips" flow.

But the single hard problem in baking videos is **mixer and kitchen noise**, and Resolve's good tool for that — Voice Isolation — is **Studio-only, $295 one-time**. Free Resolve's denoising is weaker than Shotcut's noise-profile filter. Resolve also costs roughly 4 hours of learning before your first cut, and it wants 16 GB+ RAM and a real GPU for 4K.

Switch when: you commit to 10+ episodes, or you find yourself unable to get a zoom or speed ramp to feel smooth. Until then the extra quality is invisible to viewers on a kitchen video.

If you do switch, `ffmpeg` still does your loudness check and audio extraction — keep it installed either way.
---

## 14. Wat Pi voor je kan doen (zonder dat je klikt)

Een Shotcut-project is platte XML (`.mlt`). Alles wat je met de muis doet, staat daar in — dus het meeste kan ook geschreven worden. Getest met Shotcut 25.03.31 / MLT 7.30.0.

Vuistregel: **jij beslist, Pi typt.** Je zegt wat je wil, Pi past het `.mlt` aan, jij doet **File → Open** en kijkt.

### Wat Pi doet zonder dat jij klikt

1. **Project opzetten.** Tracks (V2/V1/A1/A2), clips op de tijdlijn met in/out, volgorde, projectprofiel. Een nieuw Shotcut-project heeft **nul tracks** — daarom lijkt "Add Video Track" soms niets te doen. Pi zet ze direct in het bestand.
2. **Titel- en eindkaarten.** Gerenderd met ffmpeg in huisstijl (#a1471b, crème #fffaf1, 4K, 3 s, fade in/out). Zes kant-en-klare kaarten staan in `~/footage/titels/`.
3. **Filters.** Logo (Size/Position/Opacity, Screen-blend), tekst over beeld, Gain/Volume (-20 dB muziek), High Pass 120 Hz, Reduce Noise, Speed 1000% voor 10×-secties, keyframes voor zoom en pan.
4. **Transities en markers.** Crossfades bij de join, markers voor YouTube-chapters.
5. **Exporteren, zonder GUI.** Dit werkt en is getest:

~~~
melt project.mlt -consumer avformat:out.mp4 \
  vcodec=libx264 crf=18 preset=medium pix_fmt=yuv420p r=30 \
  acodec=aac ab=192k ar=48000 channels=2 rescale=bicubic
~~~

   **`r=30` is verplicht.** Zonder die vlag rendert melt 25 fps en klopt de duur niet meer.
6. **Audio nameten** (LUFS, peaks), **SRT** genereren, **thumbnail** (1280×720) uit een frame renderen.
7. **Schermafbeelding van je Shotcut-venster.** `scripts/shotcut-window.py` zoekt het venster zelf op — geen coördinaten, werkt ook na verslepen of op een ander scherm.
8. **Bronmateriaal klaarzetten.** VFR → CFR (anders blijft Shotcut om "Convert to edit-friendly" vragen), proxies, rotatie, nette bestandsnamen.

Bewijs uit deze aflevering: 5 clips geconverteerd naar CFR 30, 6 titelkaarten gerenderd, 4 tracks in het project gezet, clip in V1, twee test-renders met melt. Nul klikken.

### Wat Pi niet doet

1. **Bepalen wat eruit moet.** Knippen is creatief. Pi kan een contactsheet van frames maken of stilstaande secties opsporen, jij kiest.
2. **Audio op gehoor beoordelen.** Niveaus meten kan; "klinkt hol" niet.
3. **YouTube-upload en thumbnail-keuze.**
4. **Werken in een project dat open staat.** Shotcut overschrijft het `.mlt` bij opslaan. Volgorde: **Ctrl+S → Shotcut sluiten → Pi patcht → File → Open.**

### Valkuil: transparante overlays

Een transparante PNG (logo) op een bovenste track rendert met melt correct, maar Shotcut's eigen preview schildert hem als een zwart vlak over de hele video. Het beeld lijkt dan weg terwijl het geluid doorspeelt. Zet zulke overlays dus niet op de tijdlijn; brand ze in bij de export.

Algemene les: een melt-render bewijst dat het bestand klopt, niet dat Shotcut het goed toont. Controleer visueel in Shotcut zelf voordat je iets "klaar" noemt.

### Projectstructuur van een `.mlt`

~~~
<mlt producer="main_bin">
  <profile width="3840" height="2160" frame_rate_num="30" frame_rate_den="1"/>
  <chain id="chain0">…</chain>            <!-- bronclip; shotcut:hash koppelt de proxy -->
  <playlist id="main_bin">…</playlist>    <!-- het Playlist-panel -->
  <playlist id="playlist0">               <!-- V1 -->
    <property name="shotcut:video">1</property>
    <property name="shotcut:name">V1</property>
    <entry producer="chain0" in="00:00:00.000" out="00:21:42.833"/>
  </playlist>
  <playlist id="playlist1">…V2…</playlist>
  <playlist id="playlist2">…A1…</playlist>
  <playlist id="playlist3">…A2…</playlist>
  <tractor id="tractor0" out="00:21:42.833">   <!-- de tijdlijn -->
    <track producer="background"/>
    <track producer="playlist0"/>   <!-- V1 -->
    <track producer="playlist1"/>   <!-- V2 -->
    <track producer="playlist2"/>   <!-- A1 -->
    <track producer="playlist3"/>   <!-- A2 -->
    <transition …mlt_service=mix, b_track=1…/>
    <transition …mlt_service=frei0r.cairoblend, b_track=1, disable=1…/>
    …
  </tractor>
</mlt>
~~~

Regels die je moet respecteren:

1. Volgorde in de tractor is **onder → boven**: background, V1, V2, A1, A2. In de UI staat V2 bovenaan.
2. Per track één mix-transitie **en** één frei0r.cairoblend-transitie, anders doen audio en compositing het niet.
3. Alleen width, height, frame_rate_num en frame_rate_den van het profile tellen. `description` is cosmetisch.
4. Proxy's staan in `<project>/proxies/<shotcut:hash>.mp4`. Die hash is niet reproduceerbaar — laat Shotcut ze bouwen (Settings → Proxy → Use Proxy Files, één keer aanzetten).

### Export-pijplijn die werkt (4K)

Nooit blind de hele render starten. Drie stappen:

1. **Sample eerst.** Tien seconden uit het midden van de tijdlijn, en kijk één frame na:
   ~~~
   melt project.mlt in=600 out=899 -consumer avformat:/tmp/sample.mp4 f=mp4 \
     vcodec=libx264 crf=18 preset=medium pix_fmt=yuv420p s=3840x2160 progressive=1 r=30 \
     acodec=aac ab=256k ar=48000 channels=2 rescale=lanczos
   ~~~
   Zwart beeld, geen audio, verkeerde resolutie? Niet doorrenderen, eerst fixen.
2. **Volledige render naar een tussenbestand** (crf 16, 4K). Dit is de tijdlijn mét titel en muziek, zonder logo.
3. **Logo + loudness in één ffmpeg-pass**: logo overlay (PNG met alpha, 576 px, 72 px marge, 80% opacity) en loudnorm twee-pass met I=-14 LUFS en TP=-1 dB. Video opnieuw encoderen (NVENC of x264), audio AAC 192 kbps.

Twee encode-stappen kost één generatie kwaliteit. Bij crf 16 voor de tussenstap is dat onzichtbaar.

### Uploaden naar YouTube (via de API)

De video hoeft niet met de hand omhoog. `scripts/youtube-upload.py` zet bestand, titel, beschrijving met hoofdstukken, tags, thumbnail en Nederlandse ondertitels in één keer neer.

Eenmalig, alleen jij kunt dit doen:

1. Google Cloud Console → nieuw project → **YouTube Data API v3** aanzetten.
2. **Google Auth Platform → Branding**: app-naam, support-e-mail, audience **External**.
3. **Audience → Test users**: je eigen YouTube-account toevoegen. Vergeet je dit, dan krijg je `Error 403: access_denied`.
4. **Data Access**: scope `youtube.upload` toevoegen.
5. **Clients → Create client → Desktop app** → JSON bewaren als `~/.config/bakmark/youtube-client.json`.

Dan:

~~~
SITE_URL=https://bakmark.nl npm run chapters -- <slug> > ~/footage/<slug>/youtube-beschrijving.txt
scripts/youtube-upload.py <slug> --check     # laat zien wat er omhoog gaat
scripts/youtube-upload.py <slug>             # echte upload, vraagt eenmalig om toestemming
~~~

Wat je moet weten:

1. **1600 van de 10.000 quota per upload.** Zes per dag is het maximum.
2. **Niet-geaudit project → uploads blijven privé.** Openbaar zetten doe je in Studio; de API mag dat niet.
3. **Testing-mode token verloopt na 7 dagen.** Daarna één keer opnieuw autoriseren.
4. **Een kanaal zonder verificatie weigert video's boven 15 minuten en custom thumbnails.** Beide werken pas na verificatie.

### Twee valkuilen die tijd kosten

1. **melt negeert het profiel van het project** bij avformat-exports. Zonder `s=` en `r=` krijg je 720x576 op 25 fps. Altijd beide meegeven.
2. **Een transparante PNG als clip op een track wordt zwart** — in Shotcut's preview én in melt zodra de consumer-afmeting van het profiel afwijkt. Een logo hoort dus niet op de tijdlijn; brand het in met ffmpeg.

### Tijdschatting

| Aanpak | Tijd |
|---|---|
| Pi bouwt de aflevering op, jij kijkt en keurt | 10–20 min wachten op renders + 5 min keuzes |
| Zelf klikken volgens de hoofdstukken 2–13 | ≈ 4 uur de eerste keer |

---

## 15. Waar de bestanden staan

Buiten de repo: `~/footage`. Het git-checkout moet veilig weg te gooien zijn, en een
render of project hoort daar niet in. `FOOTAGE_DIR` verzet de hele map; de scripts
(`scripts/make-titles.sh`, `scripts/youtube-upload.py`) gebruiken die variabele of
vallen terug op `~/footage`.

~~~
~/footage/
  bron/          5 bronclips
    edit/        CFR 30 H.264 4K — deze gebruik je in Shotcut
  titels/        6 titelkaarten, 4K, 3 s, huisstijl
  muziek/        23 TungArt7-tracks (-20 dB)
  banketbakkersroom/banketbakkersroom/
    banketbakkersroom.mlt     het project
    proxies/                  door Shotcut gebouwde proxy's
~~~

De 0-byte stubs `~/footage/zwitserse-room/part1-slagroom.mlt` en `raw/01-slagroom.mp4` zijn resten van een ouder plan; negeren of opruimen.


# Show Builder for Yamaha · Scribble Labs

Build a labelled, colour-coded, routed show on a Yamaha digital desk in a couple of minutes, from a laptop or tablet on the same network.

Pick your inputs (lectern mics, handhelds, playback…), pick your speaker zones (Main L/R, front fills, delays, ceiling…), tick what goes where, and push it to the desk.

## Run it

Needs Node.js 18 or newer. Nothing to install, and it works fully offline: no internet connection is needed at any point.

```bash
cd tools/yamaha-show-builder
npm start
```

Open http://localhost:8080. Other devices on the network (an iPad at FOH, say) can use `http://<laptop IP>:8080`.

## Desk model

Pick your desk from the **Desk model** dropdown at the top. The app then checks your show fits that desk: mono input channels and mix buses, counting from **First channel** and **First mix**. On TF desks it also warns when a zone lands on mixes 9–20, which are stereo pairs. "Other / not sure" skips these checks.

| Model | Mono inputs | Mixes |
|---|---|---|
| TF1 | 32 | 20 (8 mono + 6 stereo pairs) |
| TF3 / TF5 | 40 | 20 (8 mono + 6 stereo pairs) |
| DM3 / DM3 Standard | 16 | 6 |
| QL1 / QL5 | 32 / 64 | 16 |
| CL1 / CL3 / CL5 | 48 / 64 / 72 | 24 |
| DM7 Compact / DM7 | 72 / 120 | 48 |
| RIVAGE PM, DSP-RX engine | 120 | 48 |
| RIVAGE PM, DSP-RX-EX engine | 288 | 72 |
| RIVAGE PM10, DSP-R10 engine | 144 | 72 |
| RIVAGE PM7 (CSD-R7) | 144 (unconfirmed) | 60 |

Only mono input channels are counted. The desks' stereo inputs and FX returns aren't used, because stereo sources here take a pair of mono channels. RIVAGE capacity depends on the DSP engine, not the control surface, so pick your engine.

These figures come from Yamaha's spec tables and reference manuals (checked October 2026). If your desk differs, edit `MODELS` in `public/plan.js`.

## Desk setup

1. Connect the desk's network port to the same network as the laptop and give it a fixed IP (Setup → Network on the desk).
2. Enter that IP in **Send to desk** and press **Test connection**. It should show the desk's model name.
3. **Store a backup scene first.** The push changes the current scene's names, colours, sends and faders.
4. Press **Push show to desk**, then store the result as a new scene.

The app talks to the desk using Yamaha's remote control protocol (TCP port 49280), which CL, QL, TF, DM3, DM7 and RIVAGE PM desks all support.

## What gets set

| Thing | How |
|---|---|
| Inputs | Channel names, colours, input faders at -∞ (switch off "Reset faders" to leave levels alone) |
| HPF | High-pass filter on and set per input (see below), or off |
| Stereo sources | Use two mono channels (L/R) panned hard left and right |
| Main L/R zone | The stereo bus. Inputs ticked for Main are assigned to it |
| Other zones | One mix bus each (front fill = Mix 1, and so on). Named, coloured, master at 0 dB, not routed to the stereo bus |
| Sends | 0 dB to each ticked zone (-3 dB per side for stereo sources into a mono zone), off and -∞ everywhere else |
| Send point | Post-fade for speaker zones (front fills, delays, ceiling, record), pre-fade for monitor zones (wedges, IEMs). Click Post/Pre under a zone's name to switch it |

Use **First channel** and **First mix** to start somewhere other than channel 1 or Mix 1.

## Processing defaults

Every input type comes with a high-pass filter default, which you can change per row in the **HPF Hz** column (blank = off):

| Input | HPF |
|---|---|
| Lectern, headset, handheld and vocal mics | 180 Hz |
| Kick, bass | 30 Hz |
| Tom | 60 Hz |
| Snare | 80 Hz |
| Electric and acoustic guitar | 100 Hz |
| Overheads | 150 Hz |
| Hi-hat | 200 Hz |
| Keys, other instruments, laptop, playback, background music | off |

## Packages

One click adds a whole mic list. The packages are defined in `PACKAGES` in `public/plan.js`, so they're easy to change or extend.

**Full band (24 channels)**

| Ch | Name | Ch | Name |
|---|---|---|---|
| 1 | Kick In | 13–14 | Gtr 1 L / R |
| 2 | Kick Out | 15–16 | Gtr 2 L / R |
| 3 | Snare T | 17–18 | Keys 1 L / R |
| 4 | Snare B | 19–20 | Keys 2 L / R |
| 5 | Hi Hat | 21 | Vox 1 |
| 6 | R Tom 1 | 22 | Vox 2 |
| 7 | R Tom 2 | 23 | Vox 3 |
| 8 | F Tom | 24 | MD TB |
| 9–10 | OH L / R | | |
| 11 | Bass DI | | |
| 12 | Bass Mic | | |

These channel numbers are for the package on its own. After other inputs it moves down, keeping this order. MD TB (the MD's talkback) goes to the foldback zones only, never the PA.

**Drum kit (10 channels):** the first ten channels above.

## Typing what you need

Type into the box under the input buttons, for example *"full band, 4 wedges and 2 handhelds"*, then press **Preview** (or Enter). It shows what will be added, then **Add to show** adds it. This runs entirely in the browser with no internet. It works on trigger words:

| Kind | Words it understands |
|---|---|
| Packages | full band, band, drum kit, drums |
| Speech | lectern, podium, headset, lapel, lav, handheld, radio mic, HH |
| Band | kick, snare, hi hat, tom, overhead, OH, bass, guitar, gtr, acoustic, keys, keyboard, piano, synth, vocal, vox, singer, talkback, TB, instrument |
| Playback | laptop, playback, PB, BGM, background music |
| Zones | wedge, monitor, foldback, IEM, in-ear, delay, front fill, ceiling, record, stream |

- **Counts:** a number or number word in front sets how many: "4 wedges", "two handhelds", "a kick".
- **Numbering:** new inputs carry on from ones already in the show (HH 5, HH 6).
- **Unknown words:** listed under the box, so nothing is silently ignored.
- **Adding words:** edit `TRIGGERS` in `public/plan.js`.

**Stereo:** tick **St** on any row to make it an L/R pair, like the guitars in the band package.

## Channel order

With **Auto order channels** on (the default), inputs are grouped by type:

1. Lectern mics
2. Headset mics
3. Handheld mics
4. Laptop audio
5. Stereo playback
6. Background music

Inputs of the same type stay in the order you added them. Stereo pairs always start on an odd channel, so they line up with the desk's odd/even channel pairing; when that needs a gap, the spare channel is listed under the grid and left untouched on the desk.

Turn auto order off to set the order by hand with the ↑ ↓ arrows on each row.

## What you still do on the desk

- **Physical patching.** Input sockets and Dante patching to channels, and mix buses to output sockets or amps. The **Patch sheet** button exports a CSV listing what goes where.
- **Bus type.** Set the zone mixes as FIXED or post-fader in Bus Setup so the input faders drive every zone.
- **Speaker processing.** Delay times, EQ and limiting for the fills, delays and ceiling (on the bus or in the amp or DSP).

## Files

- **Save / Open**: the show as a `.show.json` file, so you can reuse templates between jobs. The page also autosaves in the browser.
- **Patch sheet**: a CSV of every input channel and output bus.

## Testing without a desk

```bash
npm run mock    # pretend desk on 127.0.0.1:49280, prints every command
npm start       # in another terminal; use 127.0.0.1 as the desk IP
npm test        # unit tests for the routing logic
```

## Desk notes

- **Parameter names** come from the desks' own `prminfo` replies, as collected in the open-source [Bitfocus Companion Yamaha RCP module](https://github.com/bitfocus/companion-module-yamaha-rcp) (`schemas/`). Those lists cover a selection of each desk's parameters:
  - **Confirmed directly:** names, colours, fader level and on/off, mix sends and pan on every family. HPF on and frequency (sent as Hz × 10) on DM7 and RIVAGE.
  - **Not in the lists, so not yet confirmed:** HPF on CL/QL/TF/DM3. Stereo bus on/off (`ToSt/On`) on CL/QL/TF/RIVAGE (it is listed for DM3/DM7).
- **Pre/post:** `InCh/ToMix/PrePost` is confirmed on CL/QL, TF, DM3 and RIVAGE, but the lists don't say which value is pre. The app sends 0 = pre and 1 = post (`SEND_POINT` in `public/plan.js`). After the first push, check one wedge send on the desk and swap the two values if they're reversed. On CL/QL, the zone mixes must be VARI buses (Bus Setup) for sends to have a level and send point.
- **Colours:** TF desks call two colours SkyBlue and Pink where the others say Cyan and Magenta. The app translates automatically.

- **Name length:** older CL, QL and TF firmware shows up to 8 characters. Raise **Name length** for DM7 or RIVAGE.
- **Rejected commands:** if a desk rejects a command (some parameter names differ between models or firmware), the push carries on and the log lists the rejected lines in red. Send those so the generator can be adjusted.

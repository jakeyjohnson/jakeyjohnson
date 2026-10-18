# Show Builder for Yamaha · KobiKlang

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

1. Connect the desk's network port to the same network as the laptop, and give the desk a fixed IP (Setup → Network on the desk).
2. At the top of the app, type the desk's IP into **Desk** and press **Connect** (or Enter). The port is 49280 unless you've changed it on the desk.
3. When the light goes green, it says which desk it found, and the **Desk model** dropdown switches to match. RIVAGE desks need you to pick the DSP engine yourself.
4. **Store a backup scene first.** Pushing changes the current scene's names, colours, sends and faders.
5. Press **Push show to desk**, then store the result as a new scene.

**The connection light:**
- **Grey:** not connected.
- **Amber, pulsing:** connecting.
- **Green:** connected.
- **Red:** the desk has gone. The app checks every 5 seconds, so a pulled cable shows up within a few seconds. Press **Reconnect** once it's back.

The app talks to the desk using Yamaha's remote control protocol (TCP port 49280), which CL, QL, TF, DM3, DM7 and RIVAGE PM desks all support. It only connects to local network addresses (192.168.x.x, 10.x.x.x, 172.16–31.x.x).

## Find devices

Press **Find devices** in the Desk bar to see what's on the network, grouped as Desks, Stage boxes, Radio mics, Amps, Playback and Other. On a Yamaha desk, **Use this desk** fills in its IP and connects.

It works offline and only looks at local addresses:
- **Control ports:** it checks every address in this computer's network (the /24 around each local IP, plus this computer) for:
  - Yamaha remote control (49280): asks the desk or Rio/Tio for its model.
  - Shure command strings (2202): asks ULX-D, QLX-D, Axient Digital and SLX-D receivers for their model and name.
  - QLab (53000) and AES70 (30013, d&b and others): an open port only, so these say "probably".
- **Announcements (mDNS/Bonjour):** Dante devices, QLab, OSC, AES70 and Sennheiser Sound Control. Dante only gives a name, so the type is guessed from it (ULXD4Q-…, Rio3224-…, LabGruppen-D20…); anything it can't place goes under Other.

A scan takes around 10 seconds. If the laptop is on more than one network, or the kit is on another range, type it into **Other network** (like 192.168.1) and press **Scan again**. Hover a device to see how it was found. Devices with remote control turned off, or on a different network with no route, won't show up.

## Routing to everything

In the routing grid, the **All** column ticks every output for that input in one go (untick it to clear them all). It shows ticked when the input goes to every output.

## What gets set

| Thing | How |
|---|---|
| Inputs | Channel names, colours, input faders at -∞ (switch off "Reset faders" to leave levels alone) |
| HPF | High-pass filter on and set per input (see below), or off |
| Stereo sources | Use two mono channels (L/R) panned hard left and right |
| Main L/R zone | The stereo bus. Inputs ticked for Main are assigned to it |
| Other zones | One mix bus each (front fill = Mix 1, and so on). Named, coloured, master at 0 dB, not routed to the stereo bus |
| Sends | 0 dB to each ticked speaker output and -3 dB to each ticked monitor output (a stereo source summed into a mono output drops a further 3 dB per side). Off and -∞ everywhere else |
| Send point | Pre-fade for monitor outputs (Foldback, Mono IEM, Stereo IEM, or any output with "monitor" in its name). Post-fade for everything else: Main L/R, front fills, delays, ceiling, record. Click Post/Pre under an output's name to override it |
| Stereo IEM | Takes an odd/even pair of mixes. Stereo inputs are panned hard left/right into it, mono inputs centre. On a TF it goes on the stereo mixes (9/10 up) and mono outputs fill mixes 1–8; on other desks, set the pair as stereo in Bus Setup (the app reminds you) |

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
| Outputs | main, main L/R, PA, wedge, monitor, foldback, mono IEM, stereo IEM, IEM (stereo), in-ear, delay, front fill, ceiling, record, stream |

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

## Patch

Step 4 plans which socket each input plugs into and which socket each output comes out of. Ports are grouped into banks:

- **Analogue:** the desk's own sockets (Omni on CL/QL)
- **Card 1, Card 2…:** expansion slots
- **Dante**

**Auto patch** fills the banks in order, starting from **Inputs start at** and **Outputs start at**:
- Inputs go in channel order, and a stereo input takes two neighbouring ports.
- Outputs start with Main L/R (two ports), then each mix; a stereo IEM takes two ports.
- When a bank is full, the patch moves on to the next one.
- Any row can be set by hand instead (bank and port number); the auto patch flows around it.
- Clashes, ports the desk doesn't have, and running out of ports are all flagged.

**What reaches the desk** (from the desks' own parameter lists):

| Desk | Output patch | Input patch |
|---|---|---|
| CL / QL | Sent: Omni, Dante and card slot 1–2 outputs (untick **Send the output patch to the desk** to skip) | Read-only over the network: patch by hand |
| TF, DM3, DM7, RIVAGE | Patch by hand | Patch by hand |

The patch sheet now lists the port for every input and output, so it doubles as the patching list.

**Sockets per desk** (`io` in `MODELS`, `public/plan.js`):

| Desk | Analogue in / out | Cards | Dante |
|---|---|---|---|
| TF1 / TF3 / TF5 | 16/8, 24/16, 32/16 | 1 × 32 | via card |
| DM3 | 16 / 8 | none | 16 |
| QL1 / QL5 | 16/8, 32/16 | 2 × 16 | 64 |
| CL1 / CL3 / CL5 | 8 / 8 (Omni) | 3 × 16 | 64 |
| DM7 Compact / DM7 | 16/16, 32/16 | none | 144 |
| RIVAGE | none (I/O racks) | none | 144 |

The DM7 Compact figures come from Yamaha's spec page. The others are from memory and need checking against your desk.

## Prep tools

### Paste an input list
Open **Paste an input list** under the typing box and paste the band's or client's list from a rider, spreadsheet or email: one line per channel.
- **Names** stay as written.
- **Channel numbers** at the start of a line are ignored.
- **Other columns** (mic model, stand) become the channel's note.
- **48V** or "phantom" on a line switches phantom power on.
- **Stereo:** neighbouring "Keys L" / "Keys R" lines become one stereo input.
- **Order:** tick **Keep the list's channel order** (the default) to keep the rider's order; it turns auto order off.

### Your templates
**Save as template** (top of the page) saves the whole show, routing included, as a chip under **Yours** next to the packages. Click it to add it to any show. Templates are saved in the browser on this computer, and × deletes one.

### Back up, then check
- **Back up first:** under **Send to desk**, **Back up the desk's current scene to scene N** stores the desk's state before every push. The default is the desk's last scene number (300 on CL/QL, 100 on the others), and it overwrites that scene. If the desk refuses the backup, nothing else is sent.
- **Check the desk** reads every setting back after a push and lists any that don't match.

### Line check
Section 6 lists every channel with its socket, mic note, 48V and gain, with a tick box for each.
- **Solo** (CL/QL, DM3, DM7 and RIVAGE) solos the channel on the desk's cue.
- **Ticking a soloed channel** moves the solo on to the next unticked one, so you can walk the stage.
- **Your ticks** are saved with the show.

### DCAs and mute groups
Made automatically from the input types (Speech, Drums, Band, Vox, Playback, BGM), with only the groups that have channels. The pills under the routing grid show what each holds.

### Only send what's changed
After the first push to a desk, later pushes send only the lines that changed, so a rename mid-show takes one line. **Send everything next time** forgets the last push.

### Gain and 48V
Every input type has a starting gain and 48V setting, which you can change per row in the routing grid:
- **48V on:** lectern goosenecks, overheads, hi-hat and active DIs.
- **48V off:** radio mic receivers and dynamic mics.

### Monitors
- **Give each singer their own monitor:** pairs the vocal mics (then speech mics) with the monitor outputs in order, so Vox 1 starts in Wedge 1.
- **Monitor desk show:** saves a second show file with the same inputs and input patch but only the monitor outputs, ready to open on the monitor desk's laptop.

### Paperwork
**Paperwork** opens a print-ready page:
- the input list (socket, mic, 48V, HPF, group, outputs)
- the outputs and their sockets
- a line-check sheet with tick boxes
- desk tape strips to stick above the faders
- stage-box labels

### What reaches each desk
From the desks' own parameter lists (see Desk notes):

| | CL / QL | TF | DM3 | DM7 | RIVAGE |
|---|---|---|---|---|---|
| Scene backup | ✓ | ✓ | ✓ | ✓ | ✓ |
| DCA names / assignments | ✓ / ✓ | ✓ / by hand | none | ✓ / ✓ | ✓ / ✓ |
| Mute group names | ✓ | ✓ | none | by hand | by hand |
| Gain / 48V | ✓ / by hand | by hand | ✓ / ✓ | ✓ / by hand | ✓ / by hand |
| Solo for line check | ✓ | by hand | ✓ | ✓ | ✓ |

The scene store commands (`ssupdate_ex` / `ssupdatet_ex`) follow the Companion module. Test the backup on a spare scene before relying on it at a show.

## Starting over

- **New show:** wipes the page back to empty: no inputs, no outputs, every option back to default. The typing box, preview and push log clear too. Only the desk model and desk IP are kept, since they describe your hardware. It asks first unless the page is already empty.
- **Example:** loads the conference example (2 lecterns, 4 handhelds, 4 playbacks, fills, delays and ceiling).
- **Main L/R:** after a new show, add it with the Main L/R button, or type "main" or "PA".

## Version and licence

The footer shows the version and licence number. Both live in `public/about.js`: change `VERSION` there for each release (and the `version` in `package.json` to match; a test checks they agree), and `LICENCE` for each copy you hand out.

## Files

- **Save / Open**: the show as a `.show.json` file, so you can reuse templates between jobs. The page also autosaves in the browser.
- **Patch sheet**: a CSV of every input channel and output bus.

## Testing without a desk

```bash
npm run mock    # pretend desk on 127.0.0.1:49280, prints every command
                # (DESK_MODEL=QL5 npm run mock to pretend to be a QL5)
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

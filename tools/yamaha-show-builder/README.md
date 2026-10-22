# Show Builder for Yamaha · KobiKraken

Build a labelled, colour-coded, routed show on a Yamaha digital desk in a couple of minutes, from a laptop or tablet on the same network.

Pick your inputs (lectern mics, handhelds, playback…), pick your speaker zones (Main L/R, front fills, delays, ceiling…), tick what goes where, and push it to the desk.

## Licence keys and demo mode

The app opens on a lock screen.
- **Licence key:** each customer gets their own 20-character key, `SB-XXXXX-XXXXX-XXXXX-XXXXX`. Type or paste it in (dashes, spaces and capitals don't matter; O and 0, I and 1 are read the same) to unlock the real app. The app's own server checks it, offline, and won't talk to any desk, amp or radio mic until it's unlocked. **Remember on this computer** skips the lock screen next time. The lock button in the header bar locks it again. The footer shows the licence number the key belongs to (e.g. `KK-SB-0001`).
- **Try the demo:** opens the same app with a pretend desk, amps, radio mics and network. Demo shows are kept apart from real ones. **Demo · Exit** in the header goes back to the lock screen.

To issue a key:
```bash
node issue-licence.mjs --name "Venue or customer"                        # never ends
node issue-licence.mjs --name "Hire company" --expires 2027-12-31        # ends that day
```
Every key issued is logged in `~/.kobikraken/licences.csv` with its number, name and dates, so numbers never repeat. Keep that file.

**How strong is it?** A short key carries the licence number, the end day and a 70-bit check made with a secret the app holds (it has to, to check keys offline). Typos and made-up keys don't pass, but someone who digs the secret out of the app's files could make keys. The older long keys (`KK1-…`, 120 characters) are signed with KobiKraken's private key, so the app can check them but can't make them; they still work, and `--long` issues one (it needs `~/.kobikraken/kobikraken-licence-private.pem`). Either way it isn't copy protection: someone with the app's files could take the lock out.

`KK_UNLOCKED=1 npm start` runs without the lock, for working on the app itself.

This keeps people out of the app and away from your kit.

## Mac app

There's a Mac app with the bridge built in: download, drag to Applications, open. See [`mac/README.md`](mac/README.md) for installing it, and for building it yourself.

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
| DM3 (analogue only) | 16 | 6 |
| DM3 Dante | 16 | 6 |
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
5. Press **Send to desk** and confirm, then store the result as a new scene.

**The connection light:**
- **Grey:** not connected.
- **Blue, pulsing:** connecting.
- **Green:** connected.
- **Red:** the desk has gone. The app checks every 5 seconds, so a pulled cable shows up within a few seconds. Press **Reconnect** once it's back.

The app talks to the desk using Yamaha's remote control protocol (TCP port 49280), which CL, QL, TF, DM3, DM7 and RIVAGE PM desks all support. It only connects to local network addresses (192.168.x.x, 10.x.x.x, 172.16–31.x.x).

## Three tabs: Desk, Amplifiers, RF

- **Desk:** the show for the Yamaha desk and its Rio stage boxes: inputs, outputs, routing, patch, sending and line check.
- **Amplifiers:** which d&b amp channel drives each speaker output, with its input and speaker setup.
- **RF:** Shure radio mics and PSM IEMs, or Sennheiser Spectera, with a starting frequency plan.

All three work from the same show, so a new output on the Desk tab shows up on the other two.

## Safe start

Everything starts at its lowest, so nothing is loud when the system comes up. It's on by default:
- **Desk:** every head-amp at -6 dB, the lowest a Yamaha head-amp goes, and every fader at -∞: inputs, every output master and Main L/R. Rio sockets are included, because their gain comes from the desk.
- **Shure receivers:** gain at -18 dB, their lowest.
- **Spectera:** mic gain at its lowest (-6 dB on a bodypack, -10 dB on a handheld), and headphone level right down.
- **d&b amps and PSM transmitters:** listed as "Muted, lowest" for you to set, because the app can't send to them yet.

The gain on each row in the routing grid is then a **target**: line check and the paperwork show it as "Bring gain to". To send the targets instead, untick **Safe start** in step 5.

## Stage boxes (Rio)

In step 4 (Patch), add your Rio or Tio units in the order they sit on the desk's Dante channels. Each one becomes a bank of its own sockets ("Rio 1 · 5"), so you can start the input patch on Rio 1. The desk's own Dante channels follow on after them, numbered as the desk numbers them.
- **Gain and 48V:** set from the desk, so safe start covers them.
- **Dante subscriptions:** set them up in Dante Controller or on the desk's Dante patch screen. The Paperwork pack lists every one.
- **On the Rio:** set its UNIT ID to match the order.

## Racks: the right settings to the right unit

Amps (Amplifiers tab) and Shure receivers and IEM transmitters (RF tab) live in **racks**, drawn the way they sit in the real rack, top to bottom. One rack can hold amps, RF units and everything else in it.
- **Racks tab:** the whole rack at true height (amps 2U, Shure units 1U, change any unit's height beside it), with each unit's IP labelled beside it. Drag anything to where it sits. **Add to rack** puts in the rest of the rack: blank and vent panels, power distro, network switch, patch panel, shelf, drawer, or anything else (click its name to rename it). Set each rack's height (or **Fit**) to see the free space, and drop units into it. Each rack has a **logo plate** at the top (2U) with the KobiKraken K and wordmark, the K alone, or no plate. On a phone the plate shows the K, since the wordmark needs more width than a phone has.
- **The order matters:** units fill in rack order. The top amp of the first rack takes the first speaker outputs (Main L/R first), the next amp the next ones, and so on; receivers take the radio mics in desk channel order the same way. Under each unit you can see what each of its channels carries (A Main L, B Main R…, or 1 HH 1, 2 HH 2…), so the screen matches the rack.
- **Arranging:** drag a unit by its face to where it sits (onto another unit puts it above that one; onto the dashed line puts it at the bottom), or use ↑ ↓. **Add rack** for a second rack; drag units across. Rename a rack by clicking its name.
- **From Find devices:** amps and Shure units that were found and aren't racked yet sit under **On the network** below the racks: drag one into a rack at its height, or **Add** puts it at the bottom. In the Find devices list, **Rack it…** does the same, or says which unit it is (**Is Amp 2**) for a unit already in the rack without its IP.
- **Same unit, every time:** a racked unit remembers the box it was racked as: an amp's serial number, a Shure unit's model and device ID. Before anything is read from or sent to it, the app asks the box at that address who it is, and refuses if it's a different one ("answers as D80 · Fills · serial 10511, not the unit racked here"). A unit typed in by hand learns who it is the first time it's checked. **Check rack** asks every unit and marks each **Checked**, **Wrong unit** or **No answer**. Two units with the same IP are marked **Same IP**.
- **Flash** (Shure units) flashes the front panel so you can find it in the rack.

## Amplifiers (d&b)

1. Pick an amp model and press **Fill from outputs**, or add them one at a time with **Add amp**. Supported: D80, D40, D20, D90, 40D, 30D, 10D, 5D, D12 and D6.
2. Each speaker output gets its own channel, filled in order: one per side for Main L/R, then its subs if they come from main, then front fills, delays, ceiling, subs and wedges. IEM and record outputs don't need one.
3. **Amp mode**, per amp (pick it on the amp, or for the amps Add and Fill make):
   - **Dual channel:** every channel drives its own output.
   - **Sub/Top** (d&b Mix TOP/SUB): channels A+B take one output, the top on A and its sub on B, both from A's input; C+D the next output. The sub's setup is guessed from the top (Y10P → Y-SUB, V → V-SUB, Q/T → Q-SUB, GSL/KSL → SL-SUB). A Subs output on a Sub/Top pair runs both channels as subs.
4. The table shows which desk socket feeds each amp channel, the amp input (A1–A4 for analogue, D1–D4 for AES, Network for Dante/Milan), a guessed speaker setup (Y10P for main, 44S for fills, M4 for wedges; type any d&b setup) and a target gain.
5. Set each amp's IP, or rack the amps that **Find devices** finds (d&b amps answer on AES70, port 30013). See [Racks](#racks-the-right-settings-to-the-right-unit): the rack order decides which amp gets which output.

**Read amp:** each amp with an IP has a **Read** button. It connects over AES70 (TCP 30013), reads the amp's whole control list (every object, its role, and the current mute, gain, input and name values) and saves it as a file. It only reads: nothing on the amp changes. From a terminal, `node amp-read.mjs 192.168.0.60` does the same (add a port number if the amp doesn't use 30013). The AES70 client (`oca-link.js`) is written from the published AES70 standard. `mock-amp.js` is a pretend 4-channel amp for testing.

Once a real d&b amp's file has been read, its controls can be mapped and the app can send channel names, input routing and safe start (muted, gain lowest) itself. Until then, the app **can't send settings to d&b amps**: d&b doesn't publish the control list for its AES70 interface. Set the amps up in R1 from this table, or from the Amplifiers page in Paperwork. Everything there starts muted with its gain right down.

## RF (Shure and Sennheiser Spectera)

**Radio mics:** handhelds and headsets count as radio by default; tick or untick **Radio** for any mic. Then pick the system:
- **Shure receivers** (ULXD4, ULXD4D, ULXD4Q, QLXD4, AD4D, AD4Q, SLXD4, SLXD4D): **Fill** adds receivers for every radio mic, filling their channels in desk channel order, in rack order. Give each receiver its IP, or rack the ones Find devices finds.
- **Spectera:** handhelds go on SKMs, headsets on SEK bodypacks.

**IEMs:** each mono or stereo IEM output on the Desk tab goes on either:
- **Shure PSM** (P10T, two channels; P9T, one).
- **Spectera** SEK bodypacks.

**Frequencies:** the app plans one frequency for every Shure mic and IEM channel:
- **Ranges:** mics and IEMs each have their own. Type them or pick a preset, such as UK channel 38 (606.500–613.500 MHz) or G50 (470–534 MHz).
- **The rules:** a 25 kHz grid, mics at least 400 kHz apart, IEMs 600 kHz apart, and clear of the third-order intermod products (2A−B) of every transmitter together.
- **Spectera:** put in its RF channel and the Shure plan keeps clear of it.
- **Your own frequency:** type one in any row to fix it, and the rest plan around it.

It's a starting plan only. Scan the room and check the plan in Wireless Workbench before the show.

**Send to RF:**
- **Shure receivers:**
  - **Send to receivers** sends each channel its name (8 letters), frequency and gain at -18 dB, over the receiver's command strings (TCP port 2202).
  - **Check receivers** reads them back.
- **Spectera:**
  1. Turn on third-party access on the base station and set its password.
  2. Put in the base station's IP and password, then press **Read packs**.
  3. Match each mic or IEM to a paired pack.
  4. Press **Send names and safe gains**.

  This uses Sennheiser's HTTPS API (SSCv2). The password is only kept until the page closes, never in the show file.
- **PSM transmitters:** not sent from here, because Shure's PSM control strings aren't confirmed yet. Set them in Wireless Workbench from the RF table.

## Find devices

Press **Find devices** (right of the tabs) to see what's on the network, grouped as Desks, Stage boxes, Radio mics, Amps, Playback and Other. On a Yamaha desk, **Connect** fills in its IP and connects. Amps and Shure units go into a rack with **Rack it…**, or by dragging them in from **On the network** under the racks.

It works offline and only looks at local addresses:
- **Control ports:** it checks every address in this computer's network (the /24 around each local IP, plus this computer) for:
  - Yamaha remote control (49280): asks the desk or Rio/Tio for its model.
  - Shure command strings (2202): asks ULX-D, QLX-D, Axient Digital and SLX-D receivers for their model and name.
  - QLab (53000) and AES70 (30013, d&b and others): an open port only, so these say "probably".
- **Announcements (mDNS/Bonjour):** Dante devices, QLab, OSC, AES70 and Sennheiser Sound Control. Dante only gives a name, so the type is guessed from it (ULXD4Q-…, Rio3224-…, LabGruppen-D20…); anything it can't place goes under Other.

A scan takes around 10 seconds. If the laptop is on more than one network, or the kit is on another range, type it into **Other range** (like 192.168.1) and press **Scan**. Hover a device to see how it was found. Devices with remote control turned off, or on a different network with no route, won't show up.

## Subs with the main PA

Under **Main LR** in the routing grid, pick how its subs are fed:
- **No subs.**
- **Subs on an aux:** adds a **Subs** output (its own mix), taking what the main takes apart from speech mics. Route anything else to it in the grid. Switching away removes it again.
- **Subs from main:** the subs run off Main L and R. They get their own amp channels (Main LR L sub, Main LR R sub), fed from the same desk outputs as the tops, or, on a **Sub/Top** amp, the sub half of the pair, with no extra channels.

You can also add a **Subs** output yourself from the Outputs list.

## Routing to everything

In the routing grid, the **All** column ticks every output for that input in one go (untick it to clear them all). It shows ticked when the input goes to every output.

## What gets set

| Thing | How |
|---|---|
| Inputs | Channel names, colours, input faders at -∞ (switch off "Reset faders" to leave levels alone) |
| HPF | High-pass filter on and set per input (see below), or off |
| Stereo sources | Use two mono channels (L/R) panned hard left and right |
| Main L/R zone | The stereo bus. Inputs ticked for Main are assigned to it |
| Other zones | One mix bus each (front fill = Mix 1, and so on). Named, coloured, master at -∞ with safe start (0 dB without), not routed to the stereo bus |
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

With **Auto order** on (the default, in the Routing header), inputs are grouped by type:

1. Lectern mics
2. Headset mics
3. Handheld mics
4. Laptop audio
5. Stereo playback
6. Background music

Inputs of the same type stay in the order you added them. Stereo pairs always start on an odd channel, so they line up with the desk's odd/even channel pairing; when that needs a gap, the spare channel is listed under the grid and left untouched on the desk.

Turn auto order off to set the order by hand with the ↑ ↓ arrows on each row.

## What you still do on the desk

- **Physical patching.** Input sockets and Dante patching to channels, and mix buses to output sockets or amps. **Export → Patch sheet** exports a CSV listing what goes where.
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
| DM3 | 16 / 8 | none | none |
| DM3 Dante | 16 / 8 | none | 16 |
| QL1 / QL5 | 16/8, 32/16 | 2 × 16 | 64 |
| CL1 / CL3 / CL5 | 8 / 8 (Omni) | 3 × 16 | 64 |
| DM7 Compact / DM7 | 16/16, 32/16 | none | 144 |
| RIVAGE | none (I/O racks) | none | 144 |

The DM7 Compact figures come from Yamaha's spec page. The others are from memory and need checking against your desk.

## Prep tools

### Paste an input list
Press **Paste input list** next to the typing box and paste the band's or client's list from a rider, spreadsheet or email: one line per channel.
- **Names** stay as written.
- **Channel numbers** at the start of a line are ignored.
- **Other columns** (mic model, stand) become the channel's note.
- **48V** or "phantom" on a line switches phantom power on.
- **Stereo:** neighbouring "Keys L" / "Keys R" lines become one stereo input.
- **Order:** **Keep the list's order** (on by default) to keep the rider's order; it turns auto order off.

### Your templates
**Export → Save as template** saves the whole show, routing included, as a chip under **Yours** next to the packages. Click it to add it to any show. Templates are saved in the browser on this computer, and × deletes one.

### Back up, then check
- **Back up first:** under **Send to desk**, **Back up the desk's current scene to scene N** stores the desk's state before every push. The default is the desk's last scene number (300 on CL/QL, 100 on the others), and it overwrites that scene. If the desk refuses the backup, nothing else is sent.
- **Check desk** reads every setting back after a push and lists any that don't match.

### Line check
Section 6 lists every channel with its socket, mic note, 48V and gain, with a tick box for each.
- **Solo** (CL/QL, DM3, DM7 and RIVAGE) solos the channel on the desk's cue.
- **Ticking a soloed channel** moves the solo on to the next unticked one, so you can walk the stage.
- **Your ticks** are saved with the show.

### System check
Section 7 walks pink noise through every speaker, one at a time: Main L, Main R, then each mix (both sides of a stereo one). Each step shows the bus, the desk output socket and the amp channel it feeds, so you can listen at each box and tick it off. The fader sets the level as you move it.
- **The fader** is vertical, like a desk fader: 0 dB at the top, more travel near the top than the bottom, off at the very bottom. Drag the cap, click the track, scroll, or use the arrow keys (Page Up/Down for bigger steps).
- **Input channel:** feed pink noise into a channel (a playback channel by default). Only that channel's sends change: it goes to the output under test, whose send and master go to 0 dB. The fader is the channel's fader, starting at −40 dB.
- **Desk oscillator:** on the desk, turn the oscillator on (pink noise) and assign it to every output. The app opens one output master at a time with the rest down, and uses the output's balance for its L and R. The fader is that output's master, starting at −40 dB. CL/QL, TF and DM desks don't offer the oscillator over the network (it isn't in the parameter list they report), so it's switched on at the desk. RIVAGE does offer it, so there the app also switches it on and sets pink noise.
- **Next / Back**, or tap any speaker in the list.
- **Stop** puts every setting the check touched back exactly as it was, oscillator included. It reads them all from the desk before starting, and keeps that list in the browser, so if the page closes mid-check it offers **Put it back** next time.
- Nothing coming out? Check DCAs, mute groups, and the amp.

### DCAs and mute groups
Made automatically from the input types (Speech, Drums, Band, Vox, Playback, BGM), with only the groups that have channels. The pills under the routing grid show what each holds.

### Only send what's changed
After the first push to a desk, later pushes send only the lines that changed, so a rename mid-show takes one line. **Reset** (next to Only changes) forgets the last push.

### Gain and 48V
Every input type has a target gain and a 48V setting, which you can change per row in the routing grid. With safe start (the default) the desk gets the lowest gain and you bring it up to the target at line check:
- **48V on:** lectern goosenecks, overheads, hi-hat and active DIs.
- **48V off:** radio mic receivers and dynamic mics.

### Monitors
- **Pair singers with monitors:** pairs the vocal mics (then speech mics) with the monitor outputs in order, so Vox 1 starts in Wedge 1.
- **Export → Monitor desk show:** saves a second show file with the same inputs and input patch but only the monitor outputs, ready to open on the monitor desk's laptop.

### Paperwork
**Export → Paperwork** opens a print-ready page:
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

- **New → Empty show:** wipes the page back to empty: no inputs, no outputs, every option back to default. The typing box, preview and push log clear too. Only the desk model and desk IP are kept, since they describe your hardware. It asks first unless the page is already empty.
- **New → From the desk:** reads the connected desk into a new show: channel and mix names, colours, high-pass and routing, keeping the desk's channel and mix numbers. Only named channels and mixes come across ("ch 12" and "MX 4" are left out). Stereo pairs named "Keys L"/"Keys R" become one stereo input, and an IEM on an odd/even mix pair one stereo IEM. Input types are guessed from the names. Nothing on the desk changes.
- **New → From the desk, amps and radio mics:** reads the desk as above, then every amp and Shure receiver that has an IP (and the Spectera packs, once the base station password is in). Amps: every control the amp reports (names, mutes, gains, inputs) is kept with the show and listed under **From the amps** on the Amplifiers tab. Receivers: each channel's name, frequency and gain. Each one goes to the mic with that name (else the mic on that receiver channel); its frequency is fixed in the RF plan and its gain kept as the mic's gain, and the RF tab shows what each receiver held. Without a desk connected, it reads just the amps and receivers into this show. **Save** then keeps the whole lot in one show file.
- **Reading keeps your kit:** amps, receivers, transmitters, stage boxes and their IPs stay when a show is read from the desk.
- **New → Conference example:** loads the conference example (2 lecterns, 4 handhelds, 4 playbacks, fills, delays and ceiling).
- **Main L/R:** after a new show, add it with the Main L/R button, or type "main" or "PA".

## Version and licence

The footer shows the version and the licence number of the key that unlocked it. `VERSION` lives in `public/about.js`: change it for each release (and the `version` in `package.json` to match; a test checks they agree).

## Files

- **Save / Open**: the show as a `.show.json` file, so you can reuse templates between jobs. The page also autosaves in the browser.
- **Export → Patch sheet**: a CSV of every input channel and output bus.
- **Export → Paperwork**: adds Amplifiers, RF and Dante patch pages when the show has them.
- **Export → Prep sheet**: for the warehouse and the load-in. A sign-off line (job, prepped by, checked by, back in by); a **pick list** with Out and Back tick boxes: desk and stage boxes, racks and what's in them, amps by model and mode, speakers by setup (with the channels each one feeds; count the boxes per channel), receivers, transmitters and IEM packs, wired mics by type, DIs (stereo where the input is), and cables (XLR per wired input, speaker cable per amp channel, network cable per networked unit); **each rack** top to bottom with U numbers, what every unit carries and its IP; and the **input patch** and **output and amp patch** with tick boxes.

## Demo

`demo/` runs the real app in a web page with nothing to install. `public/demo-bridge.js` (also used for the app's own demo mode) stands in for the app's server: a pretend desk you can watch fill up, pretend Shure receivers, a pretend Spectera base station and a pretend network for Find devices. Build the page with `node demo/build.mjs`, which takes `public/index.html` and swaps in the bridge, then publish `demo/index.html` with everything in `public/` alongside it. The web demo has no server, so it skips the lock screen.

## Testing without a desk

```bash
npm run mock    # pretend desk on 127.0.0.1:49280, prints every command
                # (DESK_MODEL=QL5 npm run mock to pretend to be a QL5)
npm start       # in another terminal; use 127.0.0.1 as the desk IP
npm test        # unit tests for the routing logic
node mock-shure.js   # pretend Shure ULXD4Q on 127.0.0.1:2202; put 127.0.0.1 on a receiver
```

## Desk notes

- **Parameter names** come from the desks' own `prminfo` replies, as collected in the open-source [Bitfocus Companion Yamaha RCP module](https://github.com/bitfocus/companion-module-yamaha-rcp) (`schemas/`). Those lists cover a selection of each desk's parameters:
  - **Confirmed directly:** names, colours, fader level and on/off, mix sends and pan on every family. HPF on and frequency (sent as Hz × 10) on DM7 and RIVAGE.
  - **Not in the lists, so not yet confirmed:** HPF on CL/QL/TF/DM3. Stereo bus on/off (`ToSt/On`) on CL/QL/TF/RIVAGE (it is listed for DM3/DM7). The stereo master fader (`St/Fader/Level`) that safe start closes. If a desk rejects it, pull the Main L/R master down by hand.
- **Pre/post:** `InCh/ToMix/PrePost` is confirmed on CL/QL, TF, DM3 and RIVAGE, but the lists don't say which value is pre. The app sends 0 = pre and 1 = post (`SEND_POINT` in `public/plan.js`). After the first push, check one wedge send on the desk and swap the two values if they're reversed. On CL/QL, the zone mixes must be VARI buses (Bus Setup) for sends to have a level and send point.
- **Colours:** TF desks call two colours SkyBlue and Pink where the others say Cyan and Magenta. The app translates automatically.

- **Name length:** older CL, QL and TF firmware shows up to 8 characters. Raise **Name length** for DM7 or RIVAGE.
- **Rejected commands:** if a desk rejects a command (some parameter names differ between models or firmware), the push carries on and the log lists the rejected lines in red. Send those so the generator can be adjusted.

## RF and amp notes

- **Shure:** the command strings (`CHAN_NAME`, `FREQUENCY` in kHz, `AUDIO_GAIN` 0–60 for -18 to +42 dB) match the open-source [Bitfocus Companion Shure wireless module](https://github.com/bitfocus/companion-module-shure-wireless). Not yet tested on a real receiver. Frequency changes drop the link for a moment, so send them during prep, not in the show.
- **Spectera:** the paths and fields (`/api/mts/paired/all/{id}`, `name`, `micPreampGain`, `headphoneVolume`, user `controlSennheiser`) match the [Bitfocus Companion Spectera module](https://github.com/bitfocus/companion-module-sennheiser-spectera), which needs base station firmware 1.4.1 or newer. Not yet tested on a real base station.
- **PSM1000 and d&b:** neither has a public, confirmed control list the app can use, so both are paperwork only for now.

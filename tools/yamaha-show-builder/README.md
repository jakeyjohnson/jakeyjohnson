# Yamaha Show Builder

Build a labelled, colour-coded, routed show on a Yamaha digital desk in a couple of minutes, from a laptop or tablet on the same network.

Pick your inputs (lectern mics, handhelds, playback…), pick your speaker zones (Main L/R, front fills, delays, ceiling…), tick what goes where, and push it to the desk.

## Run it

Needs Node.js 18 or newer. There is nothing to install.

```bash
cd tools/yamaha-show-builder
npm start
```

Open http://localhost:8080. Other devices on the network (an iPad at FOH, say) can use `http://<laptop IP>:8080`.

## Desk model

Pick your desk from the **Desk model** dropdown at the top. The app then checks your show fits that desk: mono input channels and mix buses, counting from **First channel** and **First mix**. On TF desks it also warns when a zone lands on mixes 9–20, which are stereo pairs. "Other / not sure" skips these checks.

| Model | Mono inputs | Mixes |
|---|---|---|
| TF1 / TF3 / TF5 | 32 | 20 (9–20 stereo) |
| DM3 / DM3 Standard | 16 | 6 |
| QL1 / QL5 | 32 / 64 | 16 |
| CL1 / CL3 / CL5 | 48 / 64 / 72 | 24 |
| DM7 Compact / DM7 | 72 / 120 | 48 |
| RIVAGE PM3, PM7 / PM5, PM10 | 120 / 144 | 60 / 72 |

These come from Yamaha's spec sheets. If your desk's firmware differs, edit `MODELS` in `public/plan.js`.

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
| Stereo sources | Use two mono channels (L/R) panned hard left and right |
| Main L/R zone | The stereo bus. Inputs ticked for Main are assigned to it |
| Other zones | One mix bus each (front fill = Mix 1, and so on). Named, coloured, master at 0 dB, not routed to the stereo bus |
| Sends | 0 dB to each ticked zone (-3 dB per side for stereo sources into a mono zone), off and -∞ everywhere else |

Use **First channel** and **First mix** to start somewhere other than channel 1 or Mix 1.

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

- **Name length:** older CL, QL and TF firmware shows up to 8 characters. Raise **Name length** for DM7 or RIVAGE.
- **Rejected commands:** if a desk rejects a command (some parameter names differ between models or firmware), the push carries on and the log lists the rejected lines in red. Send those so the generator can be adjusted.

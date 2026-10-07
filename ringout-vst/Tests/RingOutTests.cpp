// Offline tests for the RingOut DSP. Exit code 0 = all passed.

#include "../Source/dsp/RingOutEngine.h"

#include <cmath>
#include <cstdio>
#include <random>
#include <vector>

using namespace ringout;

namespace
{
constexpr double sr = 48000.0;
constexpr int block = 256;
int failures = 0;

void check (bool ok, const char* what)
{
    std::printf ("  [%s] %s\n", ok ? "PASS" : "FAIL", what);
    if (! ok)
        ++failures;
}

float rmsDb (const std::vector<float>& x, size_t from, size_t to)
{
    double acc = 0.0;
    for (size_t i = from; i < to; ++i)
        acc += (double) x[i] * x[i];
    return (float) (10.0 * std::log10 (acc / (double) (to - from) + 1.0e-20));
}

void printNotches (NotchBank& bank)
{
    for (const auto& n : bank.getNotches())
        if (n.active)
            std::printf ("      notch %8.1f Hz  %6.1f dB%s\n", n.frequencyHz, n.currentDb, n.fixed ? "  (fixed)" : "");
}

/** Sine + noise with no feedback path: the sine should be found and notched. */
void testFindsSteadyTone()
{
    std::puts ("Steady 2.5 kHz tone over noise");
    RingOutEngine engine;
    engine.prepare (sr, block);
    engine.setParams ({});

    std::mt19937 rng (1);
    std::normal_distribution<float> noise (0.0f, 0.03f);
    std::vector<float> buf (block);
    double phase = 0.0;

    for (int b = 0; b < (int) (2.0 * sr / block); ++b)
    {
        for (auto& s : buf)
        {
            s = 0.1f * (float) std::sin (phase) + noise (rng);
            phase += 2.0 * juce::MathConstants<double>::pi * 2500.0 / sr;
        }
        float* ch[] = { buf.data() };
        engine.process (ch, 1, block);
    }

    printNotches (engine.getBank());
    int active = 0, onTarget = 0;
    for (const auto& n : engine.getBank().getNotches())
    {
        if (! n.active) continue;
        ++active;
        if (std::abs (n.frequencyHz - 2500.0f) < 15.0f && n.currentDb < -5.0f) ++onTarget;
    }
    check (onTarget == 1, "one notch within 15 Hz of 2.5 kHz");
    check (active == 1, "no false notches on the noise");
}

/** Plucked, decaying harmonic notes (music-like) should not be notched. */
void testIgnoresMusic()
{
    std::puts ("Decaying harmonic notes (music-like)");
    RingOutEngine engine;
    engine.prepare (sr, block);
    engine.setParams ({});

    std::mt19937 rng (7);
    std::normal_distribution<float> noise (0.0f, 0.005f);
    std::uniform_int_distribution<int> midi (45, 76);
    std::vector<float> buf (block);

    const int noteLen = (int) (0.35 * sr);
    int pos = 0;
    double f0 = 220.0, t = 0.0;

    for (int b = 0; b < (int) (8.0 * sr / block); ++b)
    {
        for (auto& s : buf)
        {
            if (pos++ % noteLen == 0)
            {
                f0 = 440.0 * std::pow (2.0, (midi (rng) - 69) / 12.0);
                t = 0.0;
            }

            const double env = std::exp (-t * 6.0); // ~52 dB/s decay
            double v = 0.0;
            for (int h = 1; h <= 6; ++h)
                v += std::sin (2.0 * juce::MathConstants<double>::pi * f0 * h * t) / h;
            s = (float) (0.15 * env * v) + noise (rng);
            t += 1.0 / sr;
        }
        float* ch[] = { buf.data() };
        engine.process (ch, 1, block);
    }

    printNotches (engine.getBank());
    check (engine.getBank().getNumActive() == 0, "no notches placed on music");
}

/** The same bass note struck over and over (pure tone, fast decay) is not feedback. */
void testIgnoresRepeatedNote()
{
    std::puts ("Repeated 110 Hz bass note");
    RingOutEngine engine;
    engine.prepare (sr, block);
    engine.setParams ({});

    std::mt19937 rng (5);
    std::normal_distribution<float> noise (0.0f, 0.01f);
    std::vector<float> buf (block);
    double t = 0.0;

    for (int b = 0; b < (int) (8.0 * sr / block); ++b)
    {
        for (auto& s : buf)
        {
            s = (float) (0.1 * std::sin (2.0 * juce::MathConstants<double>::pi * 110.0 * t) * std::exp (-std::fmod (t, 0.5) * 6.0))
              + noise (rng);
            t += 1.0 / sr;
        }
        float* ch[] = { buf.data() };
        engine.process (ch, 1, block);
    }

    printNotches (engine.getBank());
    check (engine.getBank().getNumActive() == 0, "no notch on a repeated note");
}

/** Sustained sung notes with natural vibrato should not be notched. */
void testIgnoresSungVibrato()
{
    std::puts ("Sustained sung notes with vibrato");
    RingOutEngine engine;
    engine.prepare (sr, block);
    engine.setParams ({});

    std::mt19937 rng (11);
    std::normal_distribution<float> noise (0.0f, 0.005f);
    std::vector<float> buf (block);
    const double notes[] = { 196.0, 261.6, 329.6, 392.0 };
    double phase = 0.0, t = 0.0;

    for (int b = 0; b < (int) (8.0 * sr / block); ++b)
    {
        for (auto& s : buf)
        {
            const double f0 = notes[(int) (t / 2.0) % 4] * (1.0 + 0.02 * std::sin (2.0 * juce::MathConstants<double>::pi * 5.5 * t));
            phase += 2.0 * juce::MathConstants<double>::pi * f0 / sr;
            double v = 0.0;
            for (int h = 1; h <= 8; ++h)
                v += std::sin (phase * h) / (h * h);
            s = (float) (0.2 * v) + noise (rng);
            t += 1.0 / sr;
        }
        float* ch[] = { buf.data() };
        engine.process (ch, 1, block);
    }

    printNotches (engine.getBank());
    check (engine.getBank().getNumActive() == 0, "no notches placed on vibrato vocals");
}

/**
    Closed acoustic loop: mic = source + room(speaker output, delayed).
    The room has a resonance that pushes loop gain to ~+6 dB, so it howls.
*/
float runLoop (bool withEngine, Mode mode, RingOutEngine* engineOut = nullptr)
{
    RingOutEngine local;
    RingOutEngine& engine = engineOut != nullptr ? *engineOut : local;
    engine.prepare (sr, block);
    RingOutEngine::Params p;
    p.mode = mode;
    engine.setParams (p);

    const int delay = 480; // 10 ms speaker -> mic
    const double seconds = 6.0;
    const int total = (int) (seconds * sr);

    std::vector<float> out ((size_t) total + delay, 0.0f);
    std::mt19937 rng (3);
    std::normal_distribution<float> noise (0.0f, 0.01f);

    // Room resonance: +9 dB peak at 1.2 kHz, Q 4, overall gain 0.7.
    const double A = std::pow (10.0, 9.0 / 40.0), w0 = 2.0 * juce::MathConstants<double>::pi * 1200.0 / sr;
    const double alpha = std::sin (w0) / 8.0, a0 = 1.0 + alpha / A;
    const double b0 = (1.0 + alpha * A) / a0, b1 = -2.0 * std::cos (w0) / a0, b2 = (1.0 - alpha * A) / a0;
    const double a1 = b1, a2 = (1.0 - alpha / A) / a0;
    double z1 = 0.0, z2 = 0.0;

    std::vector<float> buf (block);

    for (int start = 0; start < total; start += block)
    {
        for (int n = 0; n < block; ++n)
        {
            const double spk = out[(size_t) (start + n)]; // already delayed by `delay`
            const double room = b0 * spk + z1;
            z1 = b1 * spk - a1 * room + z2;
            z2 = b2 * spk - a2 * room;
            // tanh = the PA running out of headroom, keeps the runaway case finite.
            buf[(size_t) n] = (float) std::tanh (0.7 * room + noise (rng));
        }

        if (withEngine)
        {
            float* ch[] = { buf.data() };
            engine.process (ch, 1, block);
        }

        for (int n = 0; n < block; ++n)
            out[(size_t) (start + n + delay)] = buf[(size_t) n];
    }

    return rmsDb (out, (size_t) (total - sr), (size_t) total);
}

void testBreaksFeedbackLoop()
{
    std::puts ("Closed feedback loop (room resonance at 1.2 kHz, +6 dB loop gain)");
    const float without = runLoop (false, Mode::live);

    RingOutEngine engine;
    const float with = runLoop (true, Mode::live, &engine);
    std::printf ("      last-second output: without %.1f dBFS, with %.1f dBFS (source -40 dBFS)\n", without, with);
    printNotches (engine.getBank());

    check (without > -6.0f, "loop howls without the plug-in");
    check (with < -25.0f, "loop is stable with the plug-in");
    check (engine.getBank().getNumActive() <= 4, "used only a handful of notches");
}

void testRingOutLearnsAndFreezeHolds()
{
    std::puts ("Ring-out mode learns fixed notches");
    RingOutEngine engine;
    runLoop (true, Mode::ringOut, &engine);
    int fixed = 0;
    for (const auto& n : engine.getBank().getNotches())
        fixed += (n.active && n.fixed) ? 1 : 0;
    check (fixed >= 1, "notches placed in ring-out mode are fixed");

    engine.clearLive();
    std::vector<float> silence (block, 0.0f);
    float* ch[] = { silence.data() };
    for (int i = 0; i < (int) (sr / block); ++i)
        engine.process (ch, 1, block);
    int stillFixed = 0;
    for (const auto& n : engine.getBank().getNotches())
        stillFixed += (n.active && n.fixed) ? 1 : 0;
    check (stillFixed == fixed, "fixed notches survive Clear Live");
}
} // namespace

int main()
{
    testFindsSteadyTone();
    testIgnoresMusic();
    testIgnoresSungVibrato();
    testIgnoresRepeatedNote();
    testBreaksFeedbackLoop();
    testRingOutLearnsAndFreezeHolds();

    std::printf ("\n%s (%d failure%s)\n", failures == 0 ? "ALL PASSED" : "FAILED", failures, failures == 1 ? "" : "s");
    return failures == 0 ? 0 : 1;
}

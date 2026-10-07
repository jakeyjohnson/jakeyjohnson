#include "NotchBank.h"

#include <algorithm>
#include <cmath>

namespace ringout
{

void NotchBank::prepare (double newSampleRate)
{
    sampleRate = newSampleRate;

    // ~15 ms glide on gain changes so deepening a notch never clicks.
    const double chunkSeconds = chunkSize / sampleRate;
    smoothingCoeff = (float) std::exp (-chunkSeconds / 0.015);

    reset();
}

void NotchBank::reset()
{
    for (int i = 0; i < maxNotches; ++i)
    {
        notches[(size_t) i] = Notch {};
        coeffs[(size_t) i] = Coeffs {};
        coeffDb[(size_t) i] = 0.0f;
        states[(size_t) i].fill (State {});
    }
}

void NotchBank::clearLive()
{
    for (auto& n : notches)
        if (n.active && ! n.fixed)
            n.targetDb = 0.0f; // glide out rather than snap, then the slot frees itself
}

int NotchBank::getNumActive() const noexcept
{
    return (int) std::count_if (notches.begin(), notches.end(), [] (const Notch& n) { return n.active; });
}

void NotchBank::addFixedNotch (float frequencyHz, float depthDb)
{
    for (auto& n : notches)
    {
        if (! n.active)
        {
            n = Notch {};
            n.active = n.fixed = true;
            n.frequencyHz = frequencyHz;
            n.targetDb = -std::abs (depthDb);
            n.lastHitSeconds = nowSeconds;
            return;
        }
    }
}

void NotchBank::onDetection (const Detection& d)
{
    if (settings.mode == Mode::freeze)
        return;

    if (d.frequencyHz < 20.0f || d.frequencyHz > (float) sampleRate * 0.45f)
        return;

    const bool learn = settings.mode == Mode::ringOut;

    // 1. Already notched nearby?  Deepen it and nudge it onto the new estimate.
    Notch* nearest = nullptr;
    float nearestDist = mergeOctaves;

    for (auto& n : notches)
    {
        if (! n.active)
            continue;

        const float dist = std::abs (std::log2 (d.frequencyHz / n.frequencyHz));
        if (dist < nearestDist)
        {
            nearestDist = dist;
            nearest = &n;
        }
    }

    if (nearest != nullptr)
    {
        nearest->targetDb = std::max (-settings.maxDepthDb, std::min (nearest->targetDb, nearest->currentDb) - deepenStepDb);
        nearest->frequencyHz *= std::pow (d.frequencyHz / nearest->frequencyHz, 0.3f);
        nearest->lastHitSeconds = nowSeconds;
        nearest->fixed = nearest->fixed || learn;
        ++nearest->hits;
        return;
    }

    // 2. Free slot within the user's notch limit?
    Notch* slot = nullptr;

    if (getNumActive() < settings.notchLimit)
    {
        for (auto& n : notches)
            if (! n.active) { slot = &n; break; }
    }
    else
    {
        // 3. Recycle the floating notch that has been quiet the longest.
        for (auto& n : notches)
            if (n.active && ! n.fixed && (slot == nullptr || n.lastHitSeconds < slot->lastHitSeconds))
                slot = &n;
    }

    if (slot == nullptr)
        return; // every notch is a learnt one; nothing to give

    const auto index = (size_t) (slot - notches.data());
    states[index].fill (State {});
    coeffDb[index] = 0.0f;
    coeffs[index] = Coeffs {};

    *slot = Notch {};
    slot->active = true;
    slot->fixed = learn;
    slot->frequencyHz = d.frequencyHz;
    slot->targetDb = -std::min (initialDepthDb, settings.maxDepthDb);
    slot->lastHitSeconds = nowSeconds;
    slot->hits = 1;
}

NotchBank::Coeffs NotchBank::makePeak (float freq, float gainDb) const noexcept
{
    // RBJ cookbook peaking EQ.
    const double A = std::pow (10.0, gainDb / 40.0);
    const double w0 = 2.0 * juce::MathConstants<double>::pi * freq / sampleRate;
    const double alpha = std::sin (w0) / (2.0 * settings.q);
    const double cosw = std::cos (w0);
    const double a0 = 1.0 + alpha / A;

    Coeffs c;
    c.b0 = (float) ((1.0 + alpha * A) / a0);
    c.b1 = (float) ((-2.0 * cosw) / a0);
    c.b2 = (float) ((1.0 - alpha * A) / a0);
    c.a1 = (float) ((-2.0 * cosw) / a0);
    c.a2 = (float) ((1.0 - alpha / A) / a0);
    return c;
}

void NotchBank::updateNotch (int index, float chunkSeconds)
{
    auto& n = notches[(size_t) index];

    n.targetDb = std::max (n.targetDb, -settings.maxDepthDb);

    if (settings.mode == Mode::live && ! n.fixed && nowSeconds - n.lastHitSeconds > settings.holdSeconds)
        n.targetDb = std::min (0.0f, n.targetDb + settings.releaseDbPerSecond * chunkSeconds);

    n.currentDb = n.targetDb + (n.currentDb - n.targetDb) * smoothingCoeff;

    if (n.targetDb >= -0.01f && n.currentDb > -0.05f)
    {
        n.active = false;
        n.fixed = false;
        coeffs[(size_t) index] = Coeffs {};
        coeffDb[(size_t) index] = 0.0f;
        states[(size_t) index].fill (State {});
        return;
    }

    // Gain, frequency and Q can all move, so refresh every chunk (cheap: one
    // sin/cos/pow per active notch every 32 samples).
    coeffs[(size_t) index] = makePeak (n.frequencyHz, n.currentDb);
    coeffDb[(size_t) index] = n.currentDb;
}

void NotchBank::process (float* const* channels, int numChannels, int numSamples)
{
    numChannels = std::min (numChannels, maxChannels);
    const float chunkSeconds = (float) (chunkSize / sampleRate);

    for (int start = 0; start < numSamples; start += chunkSize)
    {
        const int len = std::min (chunkSize, numSamples - start);

        for (int i = 0; i < maxNotches; ++i)
        {
            if (! notches[(size_t) i].active)
                continue;

            updateNotch (i, chunkSeconds);

            if (! notches[(size_t) i].active)
                continue;

            const auto c = coeffs[(size_t) i];

            for (int ch = 0; ch < numChannels; ++ch)
            {
                auto& s = states[(size_t) i][(size_t) ch];
                float* x = channels[ch] + start;
                float z1 = s.z1, z2 = s.z2;

                for (int n = 0; n < len; ++n)
                {
                    const float in = x[n];
                    const float out = c.b0 * in + z1;
                    z1 = c.b1 * in - c.a1 * out + z2;
                    z2 = c.b2 * in - c.a2 * out;
                    x[n] = out;
                }

                // Flush denormals.
                s.z1 = std::abs (z1) < 1.0e-20f ? 0.0f : z1;
                s.z2 = std::abs (z2) < 1.0e-20f ? 0.0f : z2;
            }
        }

        nowSeconds += len / sampleRate;
    }
}

} // namespace ringout

#include "FeedbackDetector.h"

#include <algorithm>
#include <cmath>

namespace ringout
{

void FeedbackDetector::prepare (double newSampleRate)
{
    sampleRate = newSampleRate;

    // Keep bin spacing around 12 Hz whatever the sample rate, so low-mid
    // feedback (the most common kind on stage) is resolved.
    fftOrder = sampleRate <= 50000.0 ? 12 : (sampleRate <= 100000.0 ? 13 : 14);
    fftSize = 1 << fftOrder;
    hopSize = fftSize / 4;
    numBins = fftSize / 2 + 1;
    binHz = (float) (sampleRate / fftSize);

    fft = std::make_unique<juce::dsp::FFT> (fftOrder);
    ring.assign ((size_t) fftSize, 0.0f);
    fftBuffer.assign ((size_t) fftSize * 2, 0.0f);
    spectrumDb.assign ((size_t) numBins, -120.0f);
    prefixDb.assign ((size_t) numBins + 1, 0.0);

    window.resize ((size_t) fftSize);
    for (int i = 0; i < fftSize; ++i)
        window[(size_t) i] = 0.5f - 0.5f * std::cos (2.0f * juce::MathConstants<float>::pi * (float) i / (float) fftSize);

    updateThresholds();
    reset();
}

void FeedbackDetector::reset()
{
    std::fill (ring.begin(), ring.end(), 0.0f);
    std::fill (spectrumDb.begin(), spectrumDb.end(), -120.0f);
    writePos = 0;
    hopCounter = 0;
    numCandidates = 0;
    numDetections = 0;

    for (auto& t : tracks)
        t = Track {};
}

void FeedbackDetector::setSettings (const Settings& newSettings)
{
    settings = newSettings;
    updateThresholds();
}

void FeedbackDetector::updateThresholds()
{
    const float s = juce::jlimit (0.0f, 1.0f, settings.sensitivity);

    narrowThresholdDb     = juce::jmap (s, 22.0f, 10.0f);
    prominenceThresholdDb = juce::jmap (s, 30.0f, 12.0f);
    absoluteFloorDb       = juce::jmap (s, -60.0f, -80.0f);

    const float persistenceMs = juce::jmap (s, 500.0f, 110.0f);
    persistenceFrames = std::max (2, (int) std::lround (persistenceMs * 0.001 * sampleRate / hopSize));
}

void FeedbackDetector::analyseFrame()
{
    numDetections = 0;
    const int mask = fftSize - 1;

    for (int i = 0; i < fftSize; ++i)
        fftBuffer[(size_t) i] = ring[(size_t) ((writePos + i) & mask)] * window[(size_t) i];

    std::fill (fftBuffer.begin() + fftSize, fftBuffer.end(), 0.0f);
    fft->performFrequencyOnlyForwardTransform (fftBuffer.data(), true);

    // Normalise so a full-scale sine centred on a bin reads 0 dBFS.
    const float norm = 4.0f / (float) fftSize;
    prefixDb[0] = 0.0;

    for (int k = 0; k < numBins; ++k)
    {
        const float mag = fftBuffer[(size_t) k] * norm;
        const float db = 10.0f * std::log10 (mag * mag + 1.0e-14f);
        spectrumDb[(size_t) k] = db;
        prefixDb[(size_t) k + 1] = prefixDb[(size_t) k] + db;
    }

    ++frameCounter;

    findCandidates();
    flagHarmonics();
    updateTracks();
}

void FeedbackDetector::findCandidates()
{
    numCandidates = 0;

    const int kLo = std::max (8, (int) std::ceil (settings.minFreqHz / binHz));
    const int kHi = std::min (numBins - 9, (int) std::floor (std::min (settings.maxFreqHz, (float) sampleRate * 0.45f) / binHz));
    const auto& db = spectrumDb;

    for (int k = kLo; k <= kHi; ++k)
    {
        const float d = db[(size_t) k];

        if (d < absoluteFloorDb || ! (d > db[(size_t) k - 1] && d >= db[(size_t) k + 1]))
            continue;

        // Narrowness: a windowed sinusoid has fallen > 30 dB by four bins out.
        const float shoulder = std::max ({ db[(size_t) k - 4], db[(size_t) k + 4],
                                           db[(size_t) k - 5], db[(size_t) k + 5] });
        if (d - shoulder < narrowThresholdDb)
            continue;

        // Prominence over the local floor (about +/- 1/8 octave, peak excluded).
        const int halfWidth = std::max (12, (int) ((float) k * 0.09f));
        const int a = std::max (1, k - halfWidth);
        const int b = std::min (numBins - 1, k + halfWidth);
        const double sum = (prefixDb[(size_t) b + 1] - prefixDb[(size_t) a])
                         - (prefixDb[(size_t) k + 4] - prefixDb[(size_t) k - 3]);
        const int count = (b - a + 1) - 7;
        const float prominence = d - (float) (sum / count);

        if (prominence < prominenceThresholdDb)
            continue;

        // Parabolic interpolation for a sub-bin frequency estimate.
        const float l = db[(size_t) k - 1], r = db[(size_t) k + 1];
        const float denom = l - 2.0f * d + r;
        const float offset = std::abs (denom) > 1.0e-6f ? juce::jlimit (-0.5f, 0.5f, 0.5f * (l - r) / denom) : 0.0f;

        Candidate c { (float) k + offset, d, prominence, false };

        if (numCandidates < maxCandidates)
        {
            candidates[(size_t) numCandidates++] = c;
        }
        else
        {
            // Replace the quietest candidate if this one is louder.
            auto quietest = std::min_element (candidates.begin(), candidates.end(),
                                              [] (const Candidate& x, const Candidate& y) { return x.db < y.db; });
            if (quietest->db < c.db)
                *quietest = c;
        }
    }
}

void FeedbackDetector::flagHarmonics()
{
    for (int i = 0; i < numCandidates; ++i)
    {
        for (int j = 0; j < numCandidates; ++j)
        {
            if (i == j)
                continue;

            const float lo = candidates[(size_t) i].bin, hi = candidates[(size_t) j].bin;
            if (hi <= lo * 1.5f)
                continue;

            const float n = std::round (hi / lo);
            if (n >= 2.0f && n <= 8.0f && std::abs (hi - n * lo) < 1.0f + 0.01f * hi)
            {
                candidates[(size_t) i].harmonic = true;
                candidates[(size_t) j].harmonic = true;
            }
        }
    }
}

void FeedbackDetector::updateTracks()
{
    for (auto& t : tracks)
        t.matched = false;

    for (int c = 0; c < numCandidates; ++c)
    {
        const auto& cand = candidates[(size_t) c];
        Track* best = nullptr;
        float bestDist = 1.5f;

        for (auto& t : tracks)
        {
            if (! t.active || t.matched)
                continue;

            const float dist = std::abs (t.bin - cand.bin);
            if (dist < bestDist)
            {
                bestDist = dist;
                best = &t;
            }
        }

        if (best == nullptr)
        {
            for (auto& t : tracks)
            {
                if (! t.active)
                {
                    t = Track {};
                    t.active = true;
                    t.bin = cand.bin;
                    t.lastDb = cand.db;
                    t.restartWindow();
                    best = &t;
                    break;
                }
            }

            if (best == nullptr)
                continue; // all tracks busy
        }

        best->matched = true;
        best->missed = 0;
        best->bin = cand.bin;
        best->minBin = std::min (best->minBin, cand.bin);
        best->maxBin = std::max (best->maxBin, cand.bin);
        best->lastDb = cand.db;
        best->prominence = cand.prominence;
        best->maxDb = std::max (best->maxDb, cand.db);
        best->minDb = std::min (best->minDb, cand.db);
        best->harmonicFrames += cand.harmonic ? 1 : 0;
        ++best->age;
    }

    for (auto& t : tracks)
    {
        if (! t.active)
            continue;

        if (! t.matched)
        {
            if (++t.missed > 2)
                t.active = false;
            continue;
        }

        const bool mostlyHarmonic = t.harmonicFrames * 2 > t.age;
        const int required = persistenceFrames * (mostlyHarmonic ? 3 : 1);

        if (t.age < required)
            continue;

        // Howl wanders by well under half a bin (a little more while a notch is
        // being dropped in, as that shifts the loop's phase). Vibrato on even a
        // low 200 Hz voice moves ~0.6 bins, and more on every harmonic above it,
        // so peaks that belong to a harmonic series get the stricter limit.
        const float maxWobbleBins = mostlyHarmonic ? 0.3f : 0.6f;
        const bool steadyPitch = t.maxBin - t.minBin < maxWobbleBins;
        // Steady or rising, and no dip in the middle of the window (a dip means
        // the same note was struck again, not a sustained ring).
        const bool notDecaying = t.lastDb >= t.maxDb - 3.0f
                              && t.minDb >= std::min (t.firstDb, t.lastDb) - 3.0f;

        if (steadyPitch && notDecaying && numDetections < maxDetectionsPerFrame)
            detections[(size_t) numDetections++] = { t.bin * binHz, t.lastDb, t.prominence };

        // Re-arm: if it is still ringing after the next window, we fire again
        // and the notch bank deepens the cut.
        t.restartWindow();
    }
}

} // namespace ringout

#pragma once

#include "FeedbackDetector.h"
#include "NotchBank.h"
#include <vector>

namespace ringout
{

/**
    The whole effect without any plug-in plumbing: notch the signal, then analyse
    what is actually being sent to the speakers, so a cut stops deepening as soon
    as it has broken the feedback loop.
*/
class RingOutEngine
{
public:
    struct Params
    {
        Mode mode = Mode::live;
        float sensitivity = 0.6f;
        float minFreqHz = 80.0f, maxFreqHz = 16000.0f;
        int notchLimit = 12;
        float maxDepthDb = 24.0f;
        float q = 25.0f;
        float holdSeconds = 4.0f;
    };

    void prepare (double sampleRate, int maxBlockSize)
    {
        detector.prepare (sampleRate);
        bank.prepare (sampleRate);
        mono.assign ((size_t) std::max (1, maxBlockSize), 0.0f);
    }

    void reset()
    {
        detector.reset();
        bank.reset();
    }

    void clearLive() { bank.clearLive(); }

    void setParams (const Params& p)
    {
        detector.setSettings ({ p.sensitivity, p.minFreqHz, p.maxFreqHz });

        NotchBank::Settings s;
        s.mode = p.mode;
        s.notchLimit = p.notchLimit;
        s.maxDepthDb = p.maxDepthDb;
        s.q = p.q;
        s.holdSeconds = p.holdSeconds;
        bank.setSettings (s);
    }

    void process (float* const* channels, int numChannels, int numSamples)
    {
        if (numChannels <= 0)
            return;

        bank.process (channels, numChannels, numSamples);

        const int blockLen = (int) mono.size();

        for (int start = 0; start < numSamples; start += blockLen)
        {
            const int len = std::min (blockLen, numSamples - start);
            const float scale = 1.0f / (float) numChannels;

            for (int n = 0; n < len; ++n)
            {
                float sum = 0.0f;
                for (int ch = 0; ch < numChannels; ++ch)
                    sum += channels[ch][start + n];
                mono[(size_t) n] = sum * scale;
            }

            detector.push (mono.data(), len, [this] (const Detection& d) { bank.onDetection (d); });
        }
    }

    FeedbackDetector& getDetector() noexcept { return detector; }
    NotchBank& getBank() noexcept { return bank; }

private:
    FeedbackDetector detector;
    NotchBank bank;
    std::vector<float> mono;
};

} // namespace ringout

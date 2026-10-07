#pragma once

#include "FeedbackDetector.h"
#include <array>

namespace ringout
{

enum class Mode
{
    live = 0,    // notches float: they are placed on demand and released when the feedback is gone
    ringOut,     // "learn" the room: every new notch is fixed and kept
    freeze       // keep everything exactly as it is, place nothing new
};

/**
    A bank of up to maxNotches peaking (cut) biquads that are placed, deepened
    and released in response to detections. Minimum-phase IIR, so zero latency.
*/
class NotchBank
{
public:
    static constexpr int maxNotches = 24;
    static constexpr int maxChannels = 8;

    struct Notch
    {
        bool active = false, fixed = false;
        float frequencyHz = 1000.0f;
        float targetDb = 0.0f, currentDb = 0.0f;
        double lastHitSeconds = 0.0;
        int hits = 0;
    };

    struct Settings
    {
        Mode mode = Mode::live;
        int notchLimit = 12;
        float maxDepthDb = 24.0f;
        float q = 25.0f;
        float holdSeconds = 4.0f;
        float releaseDbPerSecond = 6.0f;
    };

    void prepare (double sampleRate);
    void reset();          // remove every notch
    void clearLive();      // remove only the floating notches
    void setSettings (const Settings& s) noexcept { settings = s; }

    void onDetection (const Detection& d);

    /** Restore a learnt notch (e.g. from saved plug-in state). */
    void addFixedNotch (float frequencyHz, float depthDb);

    void process (float* const* channels, int numChannels, int numSamples);

    const std::array<Notch, maxNotches>& getNotches() const noexcept { return notches; }
    int getNumActive() const noexcept;

    static constexpr float initialDepthDb = 6.0f;
    static constexpr float deepenStepDb = 3.0f;
    static constexpr float mergeOctaves = 0.04f;   // ~half a semitone

private:
    struct Coeffs { float b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0; };
    struct State { float z1 = 0, z2 = 0; };

    void updateNotch (int index, float chunkSeconds);
    Coeffs makePeak (float freq, float gainDb) const noexcept;

    static constexpr int chunkSize = 32;

    double sampleRate = 48000.0;
    double nowSeconds = 0.0;
    float smoothingCoeff = 0.0f;
    Settings settings;

    std::array<Notch, maxNotches> notches {};
    std::array<Coeffs, maxNotches> coeffs {};
    std::array<float, maxNotches> coeffDb {};
    std::array<std::array<State, maxChannels>, maxNotches> states {};
};

} // namespace ringout

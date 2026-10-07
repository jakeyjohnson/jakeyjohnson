#pragma once

#include <juce_dsp/juce_dsp.h>
#include <array>
#include <memory>
#include <vector>

namespace ringout
{

/** A frequency that the detector believes is ringing / howling. */
struct Detection
{
    float frequencyHz = 0.0f;
    float levelDb = -120.0f;     // level of the peak, dBFS (sine-calibrated)
    float prominenceDb = 0.0f;   // how far the peak stands above its local spectral floor
};

/**
    Spectral feedback detector.

    Runs a 75%-overlapped Hann STFT on a mono signal and looks for the signature
    of acoustic feedback, which differs from musical content in four ways:

      1. Narrowness  - feedback is an almost pure sinusoid, so its energy sits
                       inside the window's main lobe with nothing a few bins away.
      2. Prominence  - it stands far above the local spectral floor.
      3. Persistence - it holds the same frequency, to a fraction of a bin, for
                       hundreds of milliseconds (vibrato and glides in voices and
                       instruments wobble by more than that).
      4. Non-decay   - it sustains or grows; plucked / struck notes decay, and
                       repeated notes dip between hits.

    Peaks that sit in a harmonic series with other peaks (typical of voices and
    instruments, rare for feedback) must persist three times as long.

    Detections are emitted from push() through a callback so nothing allocates
    on the audio thread.
*/
class FeedbackDetector
{
public:
    struct Settings
    {
        float sensitivity = 0.6f;   // 0..1
        float minFreqHz = 80.0f;
        float maxFreqHz = 16000.0f;
    };

    void prepare (double sampleRate);
    void reset();
    void setSettings (const Settings& newSettings);

    template <typename Callback>
    void push (const float* samples, int numSamples, Callback&& onDetection)
    {
        for (int i = 0; i < numSamples; ++i)
        {
            ring[(size_t) writePos] = samples[i];
            writePos = (writePos + 1) & (fftSize - 1);

            if (++hopCounter >= hopSize)
            {
                hopCounter = 0;
                analyseFrame();

                for (int d = 0; d < numDetections; ++d)
                    onDetection (detections[(size_t) d]);
            }
        }
    }

    /** Latest magnitude spectrum in dBFS, one value per bin (fftSize / 2 + 1). */
    const std::vector<float>& getSpectrumDb() const noexcept { return spectrumDb; }
    uint32_t getFrameCounter() const noexcept { return frameCounter; }
    float getBinHz() const noexcept { return binHz; }
    int getFftSize() const noexcept { return fftSize; }

private:
    static constexpr int maxCandidates = 12;
    static constexpr int maxTracks = 24;
    static constexpr int maxDetectionsPerFrame = 4;

    struct Candidate
    {
        float bin = 0.0f, db = 0.0f, prominence = 0.0f;
        bool harmonic = false;
    };

    struct Track
    {
        bool active = false, matched = false;
        float bin = 0.0f, minBin = 0.0f, maxBin = 0.0f;
        float lastDb = -120.0f, firstDb = -120.0f, minDb = -120.0f, maxDb = -120.0f, prominence = 0.0f;
        int age = 0, missed = 0, harmonicFrames = 0;

        void restartWindow() noexcept
        {
            age = 0;
            harmonicFrames = 0;
            minBin = maxBin = bin;
            firstDb = minDb = maxDb = lastDb;
        }
    };

    void analyseFrame();
    void findCandidates();
    void flagHarmonics();
    void updateTracks();
    void updateThresholds();

    double sampleRate = 48000.0;
    int fftOrder = 12, fftSize = 4096, hopSize = 1024, numBins = 2049;
    float binHz = 11.72f;

    std::unique_ptr<juce::dsp::FFT> fft;
    std::vector<float> ring, window, fftBuffer, spectrumDb;
    std::vector<double> prefixDb;
    int writePos = 0, hopCounter = 0;
    uint32_t frameCounter = 0;

    Settings settings;
    float narrowThresholdDb = 14.0f, prominenceThresholdDb = 18.0f;
    float absoluteFloorDb = -75.0f;
    int persistenceFrames = 12;

    std::array<Candidate, maxCandidates> candidates {};
    int numCandidates = 0;
    std::array<Track, maxTracks> tracks {};
    std::array<Detection, maxDetectionsPerFrame> detections {};
    int numDetections = 0;
};

} // namespace ringout

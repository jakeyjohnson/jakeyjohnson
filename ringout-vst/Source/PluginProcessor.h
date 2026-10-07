#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include "dsp/RingOutEngine.h"

#include <array>
#include <atomic>

class RingOutProcessor : public juce::AudioProcessor
{
public:
    static constexpr int spectrumPoints = 256;
    static constexpr float spectrumMinHz = 20.0f, spectrumMaxHz = 20000.0f;

    RingOutProcessor();
    ~RingOutProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    static float spectrumFrequency (int index) noexcept
    {
        return spectrumMinHz * std::pow (spectrumMaxHz / spectrumMinHz, (float) index / (float) (spectrumPoints - 1));
    }

    // ---- shared with the editor (written on the audio thread, read on the message thread)
    struct NotchView
    {
        std::atomic<float> frequencyHz { 0.0f }, gainDb { 0.0f };
        std::atomic<int> state { 0 }; // 0 = off, 1 = live, 2 = fixed
    };

    std::array<std::atomic<float>, spectrumPoints> spectrumDb;
    std::array<NotchView, ringout::NotchBank::maxNotches> notchView;
    std::atomic<float> currentQ { 25.0f };
    std::atomic<bool> clearLiveRequested { false }, clearAllRequested { false };

    juce::AudioProcessorValueTreeState apvts;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout();
    void updateParams();
    void publishForEditor();
    void applyPendingFixedNotches();

    ringout::RingOutEngine engine;
    uint32_t lastPublishedFrame = 0;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Multiplicative> outputGain;

    std::atomic<float>* pMode = nullptr;
    std::atomic<float>* pSensitivity = nullptr;
    std::atomic<float>* pMaxDepth = nullptr;
    std::atomic<float>* pQ = nullptr;
    std::atomic<float>* pHold = nullptr;
    std::atomic<float>* pNotches = nullptr;
    std::atomic<float>* pLow = nullptr;
    std::atomic<float>* pHigh = nullptr;
    std::atomic<float>* pOutput = nullptr;

    // Learnt notches restored from saved state, handed to the audio thread.
    juce::SpinLock pendingLock;
    std::vector<std::pair<float, float>> pendingFixed;
    std::atomic<bool> hasPendingFixed { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (RingOutProcessor)
};

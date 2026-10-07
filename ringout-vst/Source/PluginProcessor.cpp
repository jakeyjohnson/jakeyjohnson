#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace ParamIDs
{
    static const juce::String mode { "mode" };
    static const juce::String sensitivity { "sensitivity" };
    static const juce::String maxDepth { "maxDepth" };
    static const juce::String q { "q" };
    static const juce::String hold { "hold" };
    static const juce::String notches { "notches" };
    static const juce::String low { "lowFreq" };
    static const juce::String high { "highFreq" };
    static const juce::String output { "output" };
}

RingOutProcessor::RingOutProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput ("Input", juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "RingOut", createLayout())
{
    for (auto& s : spectrumDb)
        s.store (-120.0f);

    pMode        = apvts.getRawParameterValue (ParamIDs::mode);
    pSensitivity = apvts.getRawParameterValue (ParamIDs::sensitivity);
    pMaxDepth    = apvts.getRawParameterValue (ParamIDs::maxDepth);
    pQ           = apvts.getRawParameterValue (ParamIDs::q);
    pHold        = apvts.getRawParameterValue (ParamIDs::hold);
    pNotches     = apvts.getRawParameterValue (ParamIDs::notches);
    pLow         = apvts.getRawParameterValue (ParamIDs::low);
    pHigh        = apvts.getRawParameterValue (ParamIDs::high);
    pOutput      = apvts.getRawParameterValue (ParamIDs::output);
}

juce::AudioProcessorValueTreeState::ParameterLayout RingOutProcessor::createLayout()
{
    using namespace juce;
    AudioProcessorValueTreeState::ParameterLayout layout;

    auto hz = [] (float v, int) { return v >= 1000.0f ? String (v / 1000.0f, 2) + " kHz" : String (juce::roundToInt (v)) + " Hz"; };
    auto db = [] (float v, int) { return String (v, 1) + " dB"; };

    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { ParamIDs::mode, 1 }, "Mode",
                                                        StringArray { "Live", "Ring-Out", "Freeze" }, 0));

    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ParamIDs::sensitivity, 1 }, "Sensitivity",
                                                       NormalisableRange<float> (0.0f, 100.0f, 1.0f), 60.0f,
                                                       AudioParameterFloatAttributes().withLabel ("%")));

    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ParamIDs::maxDepth, 1 }, "Max Depth",
                                                       NormalisableRange<float> (3.0f, 48.0f, 0.5f), 24.0f,
                                                       AudioParameterFloatAttributes().withStringFromValueFunction (db)));

    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ParamIDs::q, 1 }, "Notch Q",
                                                       NormalisableRange<float> (4.0f, 80.0f, 0.1f, 0.5f), 25.0f));

    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ParamIDs::hold, 1 }, "Hold",
                                                       NormalisableRange<float> (0.5f, 60.0f, 0.1f, 0.4f), 4.0f,
                                                       AudioParameterFloatAttributes().withLabel ("s")));

    layout.add (std::make_unique<AudioParameterInt> (ParameterID { ParamIDs::notches, 1 }, "Notches",
                                                     1, ringout::NotchBank::maxNotches, 12));

    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ParamIDs::low, 1 }, "Low Limit",
                                                       NormalisableRange<float> (20.0f, 1000.0f, 1.0f, 0.4f), 80.0f,
                                                       AudioParameterFloatAttributes().withStringFromValueFunction (hz)));

    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ParamIDs::high, 1 }, "High Limit",
                                                       NormalisableRange<float> (1000.0f, 20000.0f, 1.0f, 0.4f), 16000.0f,
                                                       AudioParameterFloatAttributes().withStringFromValueFunction (hz)));

    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { ParamIDs::output, 1 }, "Output",
                                                       NormalisableRange<float> (-24.0f, 12.0f, 0.1f), 0.0f,
                                                       AudioParameterFloatAttributes().withStringFromValueFunction (db)));
    return layout;
}

bool RingOutProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto out = layouts.getMainOutputChannelSet();
    if (out != juce::AudioChannelSet::mono() && out != juce::AudioChannelSet::stereo())
        return false;
    return layouts.getMainInputChannelSet() == out;
}

void RingOutProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    // Keep learnt notches across re-prepares (sample-rate or buffer changes).
    std::vector<std::pair<float, float>> keep;
    for (const auto& n : engine.getBank().getNotches())
        if (n.active && n.fixed)
            keep.emplace_back (n.frequencyHz, n.targetDb);

    engine.prepare (sampleRate, samplesPerBlock);
    updateParams();

    for (const auto& [f, g] : keep)
        engine.getBank().addFixedNotch (f, g);

    outputGain.reset (sampleRate, 0.05);
    outputGain.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (pOutput->load()));
    lastPublishedFrame = 0;
}

void RingOutProcessor::updateParams()
{
    ringout::RingOutEngine::Params p;
    p.mode = (ringout::Mode) juce::jlimit (0, 2, (int) pMode->load());
    p.sensitivity = pSensitivity->load() / 100.0f;
    p.maxDepthDb = pMaxDepth->load();
    p.q = pQ->load();
    p.holdSeconds = pHold->load();
    p.notchLimit = (int) pNotches->load();
    p.minFreqHz = pLow->load();
    p.maxFreqHz = std::max (pHigh->load(), p.minFreqHz + 100.0f);
    engine.setParams (p);
    currentQ.store (p.q);
}

void RingOutProcessor::applyPendingFixedNotches()
{
    if (! hasPendingFixed.load())
        return;

    const juce::SpinLock::ScopedTryLockType lock (pendingLock);
    if (! lock.isLocked())
        return; // try again next block

    engine.getBank().reset();
    for (const auto& [f, g] : pendingFixed)
        engine.getBank().addFixedNotch (f, g);

    hasPendingFixed.store (false);
}

void RingOutProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    for (auto ch = getTotalNumInputChannels(); ch < getTotalNumOutputChannels(); ++ch)
        buffer.clear (ch, 0, buffer.getNumSamples());

    applyPendingFixedNotches();

    if (clearAllRequested.exchange (false))
        engine.reset();
    if (clearLiveRequested.exchange (false))
        engine.clearLive();

    updateParams();
    engine.process (buffer.getArrayOfWritePointers(), buffer.getNumChannels(), buffer.getNumSamples());

    outputGain.setTargetValue (juce::Decibels::decibelsToGain (pOutput->load()));
    if (outputGain.isSmoothing())
    {
        for (int i = 0; i < buffer.getNumSamples(); ++i)
        {
            const float g = outputGain.getNextValue();
            for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
                buffer.getWritePointer (ch)[i] *= g;
        }
    }
    else if (std::abs (outputGain.getTargetValue() - 1.0f) > 1.0e-6f)
    {
        buffer.applyGain (outputGain.getTargetValue());
    }

    publishForEditor();
}

void RingOutProcessor::publishForEditor()
{
    const auto& bank = engine.getBank();
    const auto& notches = bank.getNotches();

    for (size_t i = 0; i < notches.size(); ++i)
    {
        notchView[i].frequencyHz.store (notches[i].frequencyHz);
        notchView[i].gainDb.store (notches[i].currentDb);
        notchView[i].state.store (! notches[i].active ? 0 : (notches[i].fixed ? 2 : 1));
    }

    auto& det = engine.getDetector();
    if (det.getFrameCounter() == lastPublishedFrame)
        return;

    lastPublishedFrame = det.getFrameCounter();
    const auto& db = det.getSpectrumDb();
    const float binHz = det.getBinHz();
    const int lastBin = (int) db.size() - 1;

    for (int i = 0; i < spectrumPoints; ++i)
    {
        // Each display point covers half a step either side on the log axis.
        const float f = spectrumFrequency (i);
        const float halfStep = std::pow (spectrumMaxHz / spectrumMinHz, 0.5f / (spectrumPoints - 1));
        const int b0 = juce::jlimit (0, lastBin, (int) std::floor (f / halfStep / binHz));
        const int b1 = juce::jlimit (0, lastBin, (int) std::ceil (f * halfStep / binHz));

        float v = -120.0f;
        if (b1 - b0 <= 1)
        {
            const float pos = juce::jlimit (0.0f, (float) lastBin, f / binHz);
            const int k = juce::jmin ((int) pos, lastBin - 1);
            v = juce::jmap (pos - (float) k, db[(size_t) k], db[(size_t) k + 1]);
        }
        else
        {
            for (int k = b0; k <= b1; ++k)
                v = std::max (v, db[(size_t) k]);
        }

        spectrumDb[(size_t) i].store (v);
    }
}

void RingOutProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    state.removeChild (state.getChildWithName ("FixedNotches"), nullptr);

    juce::ValueTree fixed ("FixedNotches");
    for (const auto& n : notchView)
    {
        if (n.state.load() == 2)
        {
            juce::ValueTree item ("Notch");
            item.setProperty ("freq", n.frequencyHz.load(), nullptr);
            item.setProperty ("gain", n.gainDb.load(), nullptr);
            fixed.appendChild (item, nullptr);
        }
    }
    state.appendChild (fixed, nullptr);

    if (auto xml = state.createXml())
        copyXmlToBinary (*xml, destData);
}

void RingOutProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    auto xml = getXmlFromBinary (data, sizeInBytes);
    if (xml == nullptr || ! xml->hasTagName (apvts.state.getType()))
        return;

    auto state = juce::ValueTree::fromXml (*xml);
    auto fixed = state.getChildWithName ("FixedNotches");

    std::vector<std::pair<float, float>> restored;
    for (const auto& item : fixed)
        restored.emplace_back ((float) item.getProperty ("freq"), (float) item.getProperty ("gain"));

    state.removeChild (fixed, nullptr);
    apvts.replaceState (state);

    const juce::SpinLock::ScopedLockType lock (pendingLock);
    pendingFixed = std::move (restored);
    hasPendingFixed.store (true);
}

juce::AudioProcessorEditor* RingOutProcessor::createEditor()
{
    return new RingOutEditor (*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new RingOutProcessor();
}

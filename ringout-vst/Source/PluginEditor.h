#pragma once

#include <juce_audio_utils/juce_audio_utils.h>
#include "PluginProcessor.h"

class RingOutLookAndFeel : public juce::LookAndFeel_V4
{
public:
    RingOutLookAndFeel();
    void drawRotarySlider (juce::Graphics&, int x, int y, int width, int height, float sliderPos,
                           float startAngle, float endAngle, juce::Slider&) override;
    void drawButtonBackground (juce::Graphics&, juce::Button&, const juce::Colour&, bool, bool) override;
};

/** Spectrum analyser with the notch filter curve and markers on top. */
class SpectrumDisplay : public juce::Component
{
public:
    explicit SpectrumDisplay (RingOutProcessor& p) : processor (p) { smoothed.fill (-120.0f); }
    void refresh();
    void paint (juce::Graphics&) override;

private:
    float xForFreq (float f) const;
    float yForDb (float db) const;
    float yForCut (float db) const;
    float notchResponseDb (float freq) const;

    RingOutProcessor& processor;
    std::array<float, RingOutProcessor::spectrumPoints> smoothed {};

    struct NotchSnapshot { float freq, gain; int state; };
    std::array<NotchSnapshot, ringout::NotchBank::maxNotches> notches {};
    float q = 25.0f;
};

class RingOutEditor : public juce::AudioProcessorEditor, private juce::Timer
{
public:
    explicit RingOutEditor (RingOutProcessor&);
    ~RingOutEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;

    struct Knob
    {
        juce::Slider slider;
        juce::Label label;
        std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> attachment;
    };

    void addKnob (Knob&, const juce::String& paramId, const juce::String& name);

    RingOutProcessor& processor;
    RingOutLookAndFeel lnf;
    SpectrumDisplay display;

    juce::ComboBox modeBox;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ComboBoxAttachment> modeAttachment;
    juce::TextButton clearLiveButton { "Clear Live" }, clearAllButton { "Clear All" };
    juce::Label statusLabel;

    Knob sensitivity, maxDepth, q, hold, notches, low, high, output;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (RingOutEditor)
};

#include "PluginEditor.h"

#include <complex>

namespace Colours
{
    static const juce::Colour background { 0xff121418 };
    static const juce::Colour panel      { 0xff1b1e24 };
    static const juce::Colour grid       { 0xff2a2e36 };
    static const juce::Colour text       { 0xffd8dce4 };
    static const juce::Colour dim        { 0xff7d8594 };
    static const juce::Colour spectrum   { 0xff4fb3ff };
    static const juce::Colour live       { 0xffffb347 };
    static const juce::Colour fixed      { 0xffff5d73 };
}

//==============================================================================
RingOutLookAndFeel::RingOutLookAndFeel()
{
    setColour (juce::Slider::textBoxTextColourId, Colours::text);
    setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    setColour (juce::Label::textColourId, Colours::dim);
    setColour (juce::ComboBox::backgroundColourId, Colours::panel);
    setColour (juce::ComboBox::outlineColourId, Colours::grid);
    setColour (juce::ComboBox::textColourId, Colours::text);
    setColour (juce::ComboBox::arrowColourId, Colours::dim);
    setColour (juce::PopupMenu::backgroundColourId, Colours::panel);
    setColour (juce::PopupMenu::highlightedBackgroundColourId, Colours::grid);
    setColour (juce::TextButton::textColourOffId, Colours::text);
}

void RingOutLookAndFeel::drawRotarySlider (juce::Graphics& g, int x, int y, int width, int height, float pos,
                                           float startAngle, float endAngle, juce::Slider&)
{
    const auto bounds = juce::Rectangle<int> (x, y, width, height).toFloat().reduced (6.0f);
    const float radius = juce::jmin (bounds.getWidth(), bounds.getHeight()) / 2.0f;
    const auto centre = bounds.getCentre();
    const float angle = startAngle + pos * (endAngle - startAngle);
    const float track = 3.5f;

    juce::Path bg;
    bg.addCentredArc (centre.x, centre.y, radius - track, radius - track, 0.0f, startAngle, endAngle, true);
    g.setColour (Colours::grid);
    g.strokePath (bg, juce::PathStrokeType (track, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    juce::Path value;
    value.addCentredArc (centre.x, centre.y, radius - track, radius - track, 0.0f, startAngle, angle, true);
    g.setColour (Colours::live);
    g.strokePath (value, juce::PathStrokeType (track, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    const float inner = radius - track * 3.0f;
    g.setColour (Colours::panel.brighter (0.15f));
    g.fillEllipse (juce::Rectangle<float> (inner * 2.0f, inner * 2.0f).withCentre (centre));

    const juce::Point<float> tip (centre.x + (inner - 4.0f) * std::sin (angle), centre.y - (inner - 4.0f) * std::cos (angle));
    g.setColour (Colours::text);
    g.drawLine ({ centre.getPointOnCircumference (inner * 0.35f, angle), tip }, 2.0f);
}

void RingOutLookAndFeel::drawButtonBackground (juce::Graphics& g, juce::Button& b, const juce::Colour&, bool over, bool down)
{
    auto r = b.getLocalBounds().toFloat().reduced (0.5f);
    g.setColour (down ? Colours::grid.brighter (0.2f) : (over ? Colours::grid.brighter (0.1f) : Colours::panel));
    g.fillRoundedRectangle (r, 4.0f);
    g.setColour (Colours::grid.brighter (0.3f));
    g.drawRoundedRectangle (r, 4.0f, 1.0f);
}

//==============================================================================
float SpectrumDisplay::xForFreq (float f) const
{
    const float norm = std::log (f / RingOutProcessor::spectrumMinHz)
                     / std::log (RingOutProcessor::spectrumMaxHz / RingOutProcessor::spectrumMinHz);
    return norm * (float) getWidth();
}

float SpectrumDisplay::yForDb (float db) const
{
    return juce::jmap (juce::jlimit (-100.0f, 0.0f, db), 0.0f, -100.0f, 0.0f, (float) getHeight());
}

float SpectrumDisplay::yForCut (float db) const
{
    // Notch curve uses its own scale: 0 dB near the top, -48 dB at the bottom.
    return juce::jmap (juce::jlimit (-48.0f, 0.0f, db), 0.0f, -48.0f, 18.0f, (float) getHeight() - 4.0f);
}

float SpectrumDisplay::notchResponseDb (float freq) const
{
    const double sr = processor.getSampleRate() > 0 ? processor.getSampleRate() : 48000.0;
    const std::complex<double> z1 = std::polar (1.0, -2.0 * juce::MathConstants<double>::pi * freq / sr);
    const std::complex<double> z2 = z1 * z1;
    double totalDb = 0.0;

    for (const auto& n : notches)
    {
        if (n.state == 0 || n.freq >= sr * 0.5)
            continue;

        const double A = std::pow (10.0, n.gain / 40.0);
        const double w0 = 2.0 * juce::MathConstants<double>::pi * n.freq / sr;
        const double alpha = std::sin (w0) / (2.0 * q);
        const double c = std::cos (w0);
        const auto num = (1.0 + alpha * A) + (-2.0 * c) * z1 + (1.0 - alpha * A) * z2;
        const auto den = (1.0 + alpha / A) + (-2.0 * c) * z1 + (1.0 - alpha / A) * z2;
        totalDb += 20.0 * std::log10 (std::abs (num / den) + 1.0e-12);
    }

    return (float) totalDb;
}

void SpectrumDisplay::refresh()
{
    for (int i = 0; i < RingOutProcessor::spectrumPoints; ++i)
    {
        const float v = processor.spectrumDb[(size_t) i].load();
        smoothed[(size_t) i] = std::max (v, smoothed[(size_t) i] - 1.5f); // peak with gentle fall
    }

    for (size_t i = 0; i < notches.size(); ++i)
        notches[i] = { processor.notchView[i].frequencyHz.load(), processor.notchView[i].gainDb.load(),
                       processor.notchView[i].state.load() };

    q = processor.currentQ.load();
    repaint();
}

void SpectrumDisplay::paint (juce::Graphics& g)
{
    const auto w = (float) getWidth(), h = (float) getHeight();

    g.setColour (Colours::panel);
    g.fillRoundedRectangle (getLocalBounds().toFloat(), 6.0f);

    // Grid
    g.setFont (11.0f);
    for (float f : { 50.0f, 100.0f, 200.0f, 500.0f, 1000.0f, 2000.0f, 5000.0f, 10000.0f })
    {
        const float x = xForFreq (f);
        g.setColour (Colours::grid);
        g.drawVerticalLine ((int) x, 0.0f, h);
        g.setColour (Colours::dim);
        g.drawText (f >= 1000.0f ? juce::String ((int) (f / 1000.0f)) + "k" : juce::String ((int) f),
                    (int) x + 3, (int) h - 16, 40, 14, juce::Justification::left);
    }
    for (float db = -80.0f; db < 0.0f; db += 20.0f)
    {
        g.setColour (Colours::grid);
        g.drawHorizontalLine ((int) yForDb (db), 0.0f, w);
    }

    // Spectrum
    juce::Path fill, line;
    for (int i = 0; i < RingOutProcessor::spectrumPoints; ++i)
    {
        const float x = xForFreq (RingOutProcessor::spectrumFrequency (i));
        const float y = yForDb (smoothed[(size_t) i]);
        if (i == 0) { line.startNewSubPath (x, y); fill.startNewSubPath (x, h); }
        line.lineTo (x, y);
        fill.lineTo (x, y);
    }
    fill.lineTo (w, h);
    fill.closeSubPath();
    g.setGradientFill (juce::ColourGradient (Colours::spectrum.withAlpha (0.35f), 0.0f, 0.0f,
                                             Colours::spectrum.withAlpha (0.02f), 0.0f, h, false));
    g.fillPath (fill);
    g.setColour (Colours::spectrum.withAlpha (0.9f));
    g.strokePath (line, juce::PathStrokeType (1.2f));

    // Combined notch filter response
    juce::Path eq;
    const int steps = 600;
    for (int i = 0; i <= steps; ++i)
    {
        const float f = RingOutProcessor::spectrumMinHz
                      * std::pow (RingOutProcessor::spectrumMaxHz / RingOutProcessor::spectrumMinHz, (float) i / steps);
        const float y = yForCut (notchResponseDb (f));
        if (i == 0) eq.startNewSubPath (xForFreq (f), y); else eq.lineTo (xForFreq (f), y);
    }
    g.setColour (Colours::text.withAlpha (0.85f));
    g.strokePath (eq, juce::PathStrokeType (1.6f));

    // Notch markers
    g.setFont (10.5f);
    for (const auto& n : notches)
    {
        if (n.state == 0)
            continue;

        const auto colour = n.state == 2 ? Colours::fixed : Colours::live;
        const float x = xForFreq (n.freq);
        const float y = yForCut (n.gain);

        g.setColour (colour.withAlpha (0.25f));
        g.drawVerticalLine ((int) x, 18.0f, h);
        g.setColour (colour);
        g.fillEllipse (x - 4.0f, y - 4.0f, 8.0f, 8.0f);

        const auto label = (n.freq >= 1000.0f ? juce::String (n.freq / 1000.0f, 2) + "k" : juce::String (juce::roundToInt (n.freq)))
                         + "  " + juce::String (juce::roundToInt (n.gain)) + " dB";
        g.drawText (label, (int) x + 7, (int) y - 7, 80, 14, juce::Justification::left);
    }

    // Legend
    g.setFont (11.0f);
    g.setColour (Colours::live);
    g.drawText ("Live", (int) w - 110, 4, 40, 14, juce::Justification::right);
    g.setColour (Colours::fixed);
    g.drawText ("Fixed", (int) w - 60, 4, 50, 14, juce::Justification::right);
}

//==============================================================================
RingOutEditor::RingOutEditor (RingOutProcessor& p)
    : AudioProcessorEditor (&p), processor (p), display (p)
{
    setLookAndFeel (&lnf);
    addAndMakeVisible (display);

    modeBox.addItemList ({ "Live", "Ring-Out", "Freeze" }, 1);
    modeBox.setTooltip ("Live: floating notches that release.  Ring-Out: learn fixed notches.  Freeze: hold everything.");
    addAndMakeVisible (modeBox);
    modeAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ComboBoxAttachment> (p.apvts, "mode", modeBox);

    clearLiveButton.onClick = [this] { processor.clearLiveRequested.store (true); };
    clearAllButton.onClick  = [this] { processor.clearAllRequested.store (true); };
    addAndMakeVisible (clearLiveButton);
    addAndMakeVisible (clearAllButton);

    statusLabel.setJustificationType (juce::Justification::centredRight);
    addAndMakeVisible (statusLabel);

    addKnob (sensitivity, "sensitivity", "Sensitivity");
    addKnob (maxDepth, "maxDepth", "Max Depth");
    addKnob (q, "q", "Notch Q");
    addKnob (hold, "hold", "Hold");
    addKnob (notches, "notches", "Notches");
    addKnob (low, "lowFreq", "Low Limit");
    addKnob (high, "highFreq", "High Limit");
    addKnob (output, "output", "Output");

    setResizable (true, true);
    setResizeLimits (720, 440, 1600, 1000);
    setSize (900, 520);
    startTimerHz (30);
}

RingOutEditor::~RingOutEditor()
{
    stopTimer();
    setLookAndFeel (nullptr);
}

void RingOutEditor::addKnob (Knob& k, const juce::String& paramId, const juce::String& name)
{
    k.slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    k.slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 80, 16);
    addAndMakeVisible (k.slider);
    k.attachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment> (processor.apvts, paramId, k.slider);

    k.label.setText (name, juce::dontSendNotification);
    k.label.setJustificationType (juce::Justification::centred);
    addAndMakeVisible (k.label);
}

void RingOutEditor::paint (juce::Graphics& g)
{
    g.fillAll (Colours::background);

    g.setColour (Colours::text);
    g.setFont (juce::FontOptions (22.0f, juce::Font::bold));
    g.drawText ("RINGOUT", 16, 10, 140, 28, juce::Justification::left);
    g.setColour (Colours::dim);
    g.setFont (juce::FontOptions (12.0f));
    g.drawText ("Adaptive feedback suppressor", 128, 16, 200, 18, juce::Justification::left);
}

void RingOutEditor::resized()
{
    auto r = getLocalBounds().reduced (16, 10);

    auto header = r.removeFromTop (32);
    header.removeFromLeft (320);
    clearAllButton.setBounds (header.removeFromRight (90).reduced (0, 3));
    header.removeFromRight (8);
    clearLiveButton.setBounds (header.removeFromRight (90).reduced (0, 3));
    header.removeFromRight (8);
    modeBox.setBounds (header.removeFromRight (120).reduced (0, 3));
    statusLabel.setBounds (header.withTrimmedRight (12));

    r.removeFromTop (8);
    auto knobs = r.removeFromBottom (120);
    r.removeFromBottom (8);
    display.setBounds (r);

    Knob* all[] = { &sensitivity, &maxDepth, &q, &hold, &notches, &low, &high, &output };
    const int kw = knobs.getWidth() / 8;
    for (auto* k : all)
    {
        auto cell = knobs.removeFromLeft (kw);
        k->label.setBounds (cell.removeFromTop (18));
        k->slider.setBounds (cell);
    }
}

void RingOutEditor::timerCallback()
{
    display.refresh();

    int live = 0, fixed = 0;
    for (const auto& n : processor.notchView)
    {
        const int s = n.state.load();
        live += s == 1 ? 1 : 0;
        fixed += s == 2 ? 1 : 0;
    }
    statusLabel.setText (juce::String (live) + " live  /  " + juce::String (fixed) + " fixed",
                         juce::dontSendNotification);
}

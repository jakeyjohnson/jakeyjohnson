cmake_minimum_required(VERSION 3.22)

project(RingOut VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "10.13" CACHE STRING "Minimum macOS version")

# JUCE is fetched automatically. To use a local checkout instead:
#   cmake -B build -DFETCHCONTENT_SOURCE_DIR_JUCE=/path/to/JUCE
include(FetchContent)
FetchContent_Declare(JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 8.0.4
    GIT_SHALLOW ON)
FetchContent_MakeAvailable(JUCE)

option(RINGOUT_BUILD_TESTS "Build the offline DSP tests" ON)

set(RINGOUT_FORMATS VST3 Standalone)
if(APPLE)
    list(APPEND RINGOUT_FORMATS AU)
endif()

juce_add_plugin(RingOut
    COMPANY_NAME "Jake Johnson"
    BUNDLE_ID "uk.co.jakejohnson.ringout"
    PLUGIN_MANUFACTURER_CODE Jjsn
    PLUGIN_CODE Rgot
    PRODUCT_NAME "RingOut"
    FORMATS ${RINGOUT_FORMATS}
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
    VST3_CATEGORIES Fx Restoration
    AU_MAIN_TYPE kAudioUnitType_Effect)

target_sources(RingOut PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/dsp/FeedbackDetector.cpp
    Source/dsp/NotchBank.cpp)

target_compile_definitions(RingOut PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0)

target_link_libraries(RingOut
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags)

if(RINGOUT_BUILD_TESTS)
    juce_add_console_app(RingOutTests PRODUCT_NAME "RingOutTests")
    target_sources(RingOutTests PRIVATE
        Tests/RingOutTests.cpp
        Source/dsp/FeedbackDetector.cpp
        Source/dsp/NotchBank.cpp)
    target_compile_definitions(RingOutTests PRIVATE JUCE_USE_CURL=0 JUCE_WEB_BROWSER=0)
    target_link_libraries(RingOutTests
        PRIVATE juce::juce_dsp
        PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
endif()

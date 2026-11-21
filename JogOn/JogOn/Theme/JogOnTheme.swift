import SwiftUI

enum JO {
    // MARK: Colour
    static let black    = Color(hex: 0x000000)
    static let white    = Color(hex: 0xFFFFFF)
    static let pink     = Color(hex: 0xFF4F9A)
    static let pinkInk  = Color(hex: 0xD6246E)
    static let graphite = Color(hex: 0x161616)
    static let line     = Color(hex: 0x2A2A2A)
    static let stone    = Color(hex: 0x8C8C8C)

    // MARK: Type (Archivo; falls back to the system font until the font files are added)
    static func display(_ size: CGFloat) -> Font {
        .custom("Archivo-ExtraCondensed-ExtraBoldItalic", size: size, relativeTo: .largeTitle)
    }
    static func number(_ size: CGFloat) -> Font {
        .custom("Archivo-ExtraCondensed-ExtraBoldItalic", size: size, relativeTo: .largeTitle).monospacedDigit()
    }
    static let body  = Font.custom("Archivo-Regular", size: 16, relativeTo: .body)
    static let small = Font.custom("Archivo-Regular", size: 13, relativeTo: .footnote)
    static let label = Font.custom("Archivo-SemiBold", size: 15, relativeTo: .subheadline)

    // MARK: Layout
    static let margin: CGFloat = 22
    static let cardRadius: CGFloat = 20
    static let buttonHeight: CGFloat = 54
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255)
    }
}

struct DisplayText: View {
    let text: String; var size: CGFloat = 44
    var body: some View {
        Text(text.uppercased()).font(JO.display(size)).lineSpacing(-size * 0.12)
    }
}

struct PrimaryButton: View {
    let title: String; var inverted = false; let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).font(JO.label)
                .frame(maxWidth: .infinity, minHeight: JO.buttonHeight)
                .background(inverted ? JO.black : JO.white)
                .foregroundStyle(inverted ? JO.white : JO.black)
                .clipShape(Capsule())
        }
    }
}

struct PinkButton: View {
    let title: String; let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).font(JO.label)
                .frame(maxWidth: .infinity, minHeight: JO.buttonHeight)
                .background(JO.pink).foregroundStyle(JO.black).clipShape(Capsule())
        }
    }
}

struct StatTile: View {
    let value: String; let label: String; var accent = false
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(JO.number(44)).foregroundStyle(accent ? JO.pink : .primary)
            Text(label).font(JO.small).foregroundStyle(JO.stone)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

struct ProgressBar: View {
    let value: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(JO.line)
                Capsule().fill(JO.pink).frame(width: geo.size.width * min(max(value, 0), 1))
            }
        }
        .frame(height: 6)
    }
}

struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content.padding(18).frame(maxWidth: .infinity, alignment: .leading)
            .background(JO.graphite)
            .clipShape(RoundedRectangle(cornerRadius: JO.cardRadius))
    }
}

import SwiftUI

/// Every colour, font and reusable style from the v3 look.
enum JO {
    static let black = Color(hex: 0x000000)
    static let white = Color(hex: 0xFFFFFF)
    static let pink = Color(hex: 0xFF4F9A)        // the only accent
    static let pinkOnWhite = Color(hex: 0xD6246E) // pink text on light screens
    static let graphite = Color(hex: 0x161616)    // cards on black
    static let line = Color(hex: 0x2A2A2A)
    static let stone = Color(hex: 0x8C8C8C)

    static let buttonHeight: CGFloat = 56

    static func display(_ size: CGFloat) -> Font {
        .custom("ArchivoExtraCondensed-ExtraBoldItalic", size: size, relativeTo: .largeTitle)
    }
    static func number(_ size: CGFloat) -> Font {
        .custom("ArchivoExtraCondensed-ExtraBoldItalic", size: size, relativeTo: .title)
    }
    static let label = Font.custom("Archivo-SemiBold", size: 17, relativeTo: .body)
    static let body = Font.custom("Archivo-Regular", size: 16, relativeTo: .body)
    static let small = Font.custom("Archivo-Regular", size: 13, relativeTo: .caption)
    static let caps = Font.custom("ArchivoExtraCondensed-Bold", size: 14, relativeTo: .caption)
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255)
    }
}

/// Headline in caps, condensed italic: "LONGEST ONE YET."
struct DisplayText: View {
    let text: String
    var size: CGFloat = 44
    var body: some View {
        Text(text.uppercased()).font(JO.display(size)).lineSpacing(-size * 0.12)
    }
}

struct PrimaryButton: View {
    let title: String
    var inverted = false
    let action: () -> Void
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

struct StatTile: View {
    let value: String
    let label: String
    var accent = false
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(JO.number(44)).foregroundStyle(accent ? JO.pink : .primary)
            Text(label).font(JO.small).foregroundStyle(JO.stone)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct ProgressBar: View {
    let value: Double // 0...1
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
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(JO.graphite, in: RoundedRectangle(cornerRadius: 20))
    }
}

/// Dark screen wrapper used by every main tab.
struct Screen<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        ZStack {
            JO.black.ignoresSafeArea()
            ScrollView { content.padding(20) }
        }
        .foregroundStyle(JO.white)
        .font(JO.body)
    }
}

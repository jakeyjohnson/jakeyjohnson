import SwiftUI
import MapKit

struct LiveSessionView: View {
    let onEnd: () -> Void
    @State private var seconds = 0
    @State private var paused = false
    @State private var locked = false
    @State private var holdProgress = 0.0
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private var interval: (String, Int) { seconds % 180 < 120 ? ("Walk", 120 - seconds % 180) : ("Jog", 180 - seconds % 180) }

    var body: some View {
        VStack(spacing: 0) {
            Map { MapPolyline(coordinates: Self.route).stroke(JO.pink, lineWidth: 5) }
                .mapStyle(.standard(elevation: .flat))
                .frame(maxHeight: .infinity)
            VStack(spacing: 16) {
                Text("\(interval.0) now \(clock(interval.1))").font(JO.label).foregroundStyle(JO.pink)
                Text(clock(seconds)).font(JO.number(96))
                HStack {
                    StatTile(value: String(format: "%.2f", Double(seconds) * 0.0028), label: "km")
                    StatTile(value: "\(seconds * 2)", label: "steps")
                    StatTile(value: "\(seconds / 60 * 4)", label: "points", accent: true)
                }
                HStack(spacing: 14) {
                    roundButton("lock.fill", "Lock") { locked.toggle() }
                    roundButton(paused ? "play.fill" : "pause.fill", paused ? "Resume" : "Pause") { paused.toggle() }
                    Text(holdProgress > 0 ? "Keep holding…" : "Hold to end").font(JO.label)
                        .frame(maxWidth: .infinity, minHeight: JO.buttonHeight)
                        .background(JO.graphite).clipShape(Capsule())
                        .onLongPressGesture(minimumDuration: 1.5, perform: onEnd, onPressingChanged: { holdProgress = $0 ? 1 : 0 })
                }
                .disabled(locked)
            }
            .padding(JO.margin)
            .background(JO.black)
        }
        .background(JO.black)
        .onReceive(timer) { _ in if !paused { seconds += 1 } }
    }

    private func roundButton(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).frame(width: JO.buttonHeight, height: JO.buttonHeight)
                .background(JO.graphite).clipShape(Circle())
        }.accessibilityLabel(label)
    }

    static let route: [CLLocationCoordinate2D] = [
        .init(latitude: 51.5000, longitude: -0.1250), .init(latitude: 51.5015, longitude: -0.1230),
        .init(latitude: 51.5030, longitude: -0.1215), .init(latitude: 51.5042, longitude: -0.1190)
    ]
}

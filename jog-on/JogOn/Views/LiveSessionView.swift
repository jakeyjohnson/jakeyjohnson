import SwiftUI
import MapKit

/// Dummy timer only. Real tracking arrives in Milestone 2.
struct LiveSessionView: View {
    let session: PlanSession
    @Environment(\.dismiss) private var dismiss
    @State private var elapsed = 0
    @State private var paused = false
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var current: IntervalBlock? {
        var t = 0
        for b in session.blocks { t += b.seconds; if elapsed < t { return b } }
        return session.blocks.last
    }

    var body: some View {
        ZStack {
            JO.black.ignoresSafeArea()
            VStack(spacing: 0) {
                Map().frame(maxHeight: .infinity)
                VStack(alignment: .leading, spacing: 12) {
                    Text("\(current?.kind.rawValue ?? "Walk") now").font(JO.caps).foregroundStyle(JO.pink)
                    Text(String(format: "%d:%02d", elapsed / 60, elapsed % 60)).font(JO.number(88))
                    HStack {
                        StatTile(value: "0.0", label: "km")
                        StatTile(value: "\(elapsed * 2)", label: "steps")
                        StatTile(value: "\(elapsed / 6 * 10)", label: "points", accent: true)
                    }
                    HStack {
                        PrimaryButton(title: paused ? "Resume" : "Pause") { paused.toggle() }
                        PrimaryButton(title: "End", inverted: true) { dismiss() }
                    }
                }
                .padding(20).background(JO.graphite)
            }
        }
        .foregroundStyle(JO.white)
        .onReceive(tick) { _ in if !paused { elapsed += 1 } }
    }
}

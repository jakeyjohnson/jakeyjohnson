import SwiftUI
import MapKit

/// Run tab: map, today's session card, one big START button.
struct RunHomeView: View {
    let start: () -> Void
    @State private var showPreview = false
    @State private var showGoal = false
    var body: some View {
        ZStack {
            Map(initialPosition: .userLocation(fallback: .automatic)) { UserAnnotation() }
                .mapStyle(.standard(elevation: .flat)).ignoresSafeArea().opacity(0.55)
            VStack(spacing: 0) {
                Button { showPreview = true } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Today's session").font(JO.small).foregroundStyle(JO.stone)
                            Text("Easy walk").font(JO.label)
                            Text("20 min · Mostly walking").font(JO.small).foregroundStyle(JO.stone)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(JO.stone)
                    }
                    .padding(18).background(JO.graphite.opacity(0.95))
                    .clipShape(RoundedRectangle(cornerRadius: JO.cardRadius))
                }
                .buttonStyle(.plain).padding(JO.margin)
                Spacer()
                HStack(spacing: 40) {
                    circle("gearshape.fill", "Settings") {}
                    Button(action: start) {
                        DisplayText(text: "Start", size: 40).foregroundStyle(JO.black)
                            .frame(width: 130, height: 130).background(JO.pink).clipShape(Circle())
                    }.accessibilityLabel("Start session")
                    circle("speaker.slash.fill", "Coach voice") {}
                }
                Button("Set a goal") { showGoal = true }.font(JO.label)
                    .padding(.horizontal, 28).padding(.vertical, 12)
                    .background(JO.graphite).clipShape(Capsule()).padding(.top, 20).padding(.bottom, 24)
            }
        }
        .sheet(isPresented: $showPreview) { NavigationStack { SessionPreviewView(onStart: { showPreview = false; start() }) } }
        .sheet(isPresented: $showGoal) {
            VStack(spacing: 16) { DisplayText(text: "Set a goal", size: 36)
                ForEach(["Time", "Distance", "Just move"], id: \.self) { g in Choice(title: g, selected: false) { showGoal = false } } }
                .padding(JO.margin).presentationDetents([.medium]).presentationBackground(JO.black)
        }
    }
    private func circle(_ icon: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.title3).frame(width: 56, height: 56)
                .background(JO.graphite).clipShape(Circle())
        }.accessibilityLabel(label)
    }
}

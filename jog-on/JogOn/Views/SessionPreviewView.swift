import SwiftUI

struct SessionPreviewView: View {
    let session: PlanSession
    @State private var coach = true
    @State private var running = false

    var body: some View {
        Screen {
            VStack(alignment: .leading, spacing: 20) {
                DisplayText(text: session.title, size: 44)
                Text("\(session.minutes) minutes").font(JO.small).foregroundStyle(JO.stone)
                HStack(spacing: 2) {
                    ForEach(session.blocks) { b in
                        Rectangle().fill(b.kind == .jog ? JO.pink : JO.line)
                            .frame(width: CGFloat(b.seconds) / 8, height: 40)
                    }
                }
                Toggle("Audio coach", isOn: $coach).tint(JO.pink)
                PrimaryButton(title: "Start") { running = true }
            }
        }
        .fullScreenCover(isPresented: $running) { LiveSessionView(session: session) }
    }
}

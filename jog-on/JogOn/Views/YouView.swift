import SwiftUI

struct YouView: View {
    @AppStorage("showPace") private var showPace = false
    @AppStorage("onboarded") private var onboarded = true

    var body: some View {
        Screen {
            VStack(alignment: .leading, spacing: 20) {
                DisplayText(text: "You", size: 44)
                HStack {
                    StatTile(value: "412", label: "total minutes")
                    StatTile(value: "27", label: "sessions")
                    StatTile(value: "5", label: "week streak", accent: true)
                }
                Card {
                    Toggle("Show pace", isOn: $showPace).tint(JO.pink)
                }
                Card {
                    VStack(alignment: .leading) {
                        Text("Jog On Plus").font(JO.label)
                        Text("Monthly. Cancel any time.").font(JO.small).foregroundStyle(JO.stone)
                    }
                }
                Button("Replay onboarding") { onboarded = false }
                    .font(JO.small).foregroundStyle(JO.stone)
            }
        }
    }
}

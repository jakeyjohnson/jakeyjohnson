import SwiftUI

struct YouView: View {
    @Environment(AppState.self) private var state
    var body: some View {
        @Bindable var s = state
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        Image(systemName: "person.circle.fill").font(.system(size: 52)).foregroundStyle(JO.pink)
                        VStack(alignment: .leading) { Text("Jake").font(JO.label); Text("Goal: \(state.goal)").font(JO.small).foregroundStyle(JO.stone) }
                    }
                }
                Section("Stats") {
                    HStack { StatTile(value: "412", label: "minutes"); StatTile(value: "18", label: "sessions"); StatTile(value: "5", label: "best streak") }
                }
                Section("Settings") {
                    Picker("Units", selection: $s.useMiles) { Text("Kilometres").tag(false); Text("Miles").tag(true) }
                    Toggle("Show pace", isOn: $s.showPace)
                    Toggle("Coach voice", isOn: .constant(true))
                    Toggle("Notifications", isOn: .constant(true))
                }
                Section("Jog On Plus") { NavigationLink("Manage Plus") { PaywallView() } }
                Section("Privacy") {
                    Button("Export my data") {}
                    Button("Delete account", role: .destructive) {}
                    Button("Reset onboarding") { state.onboarded = false }
                }
            }
            .scrollContentBackground(.hidden).background(JO.black).navigationTitle("You")
        }
    }
}

struct PaywallView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            DisplayText(text: "Jog On Plus", size: 48)
            ForEach(["All plans", "Double points", "Pause plan", "Voice coach", "Quiet routes", "Monthly recap"], id: \.self) { f in
                Label(f, systemImage: "checkmark").font(JO.body).foregroundStyle(JO.white)
            }
            Spacer()
            PinkButton(title: "Try Plus · £4.99 a month") {}
            Text("Placeholder price. StoreKit comes in milestone 5.").font(JO.small).foregroundStyle(JO.stone)
        }
        .padding(JO.margin).background(JO.black.ignoresSafeArea())
    }
}

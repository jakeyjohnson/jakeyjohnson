import SwiftUI
import SwiftData

@main
struct JogOnApp: App {
    @State private var state = AppState()
    var body: some Scene {
        WindowGroup {
            Group {
                if state.onboarded { RootTabView() } else { OnboardingFlow() }
            }
            .environment(state)
            .preferredColorScheme(.dark)
            .tint(JO.pink)
        }
        .modelContainer(for: [Plan.self, PlannedSession.self, Activity.self])
    }
}

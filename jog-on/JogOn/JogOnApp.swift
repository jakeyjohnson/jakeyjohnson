import SwiftUI

@main
struct JogOnApp: App {
    @AppStorage("onboarded") private var onboarded = false

    var body: some Scene {
        WindowGroup {
            if onboarded {
                RootTabView()
            } else {
                WelcomeView { onboarded = true }
            }
        }
        .environment(\.colorScheme, .dark)
    }
}

import SwiftUI

struct RootTabView: View {
    var body: some View {
        TabView {
            HomeView().tabItem { Label("Home", systemImage: "house") }
            PlanView().tabItem { Label("Plan", systemImage: "calendar") }
            SessionPreviewView(session: Dummy.plan[0].sessions[1])
                .tabItem { Label("Run", systemImage: "figure.run") }
            RewardsView().tabItem { Label("Rewards", systemImage: "gift") }
            YouView().tabItem { Label("You", systemImage: "person") }
        }
        .tint(JO.pink)
    }
}

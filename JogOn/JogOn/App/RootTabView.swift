import SwiftUI

struct RootTabView: View {
    @Environment(AppState.self) private var state
    @State private var showSession = false
    var body: some View {
        @Bindable var s = state
        TabView(selection: $s.selectedTab) {
            HomeView(start: { showSession = true }).tabItem { Label("Home", systemImage: "house.fill") }.tag(0)
            PlanView().tabItem { Label("Plan", systemImage: "calendar") }.tag(1)
            RunTab(start: { showSession = true }).tabItem { Label("Run", systemImage: "figure.run") }.tag(2)
            RewardsView().tabItem { Label("Rewards", systemImage: "gift.fill") }.tag(3)
            YouView().tabItem { Label("You", systemImage: "person.fill") }.tag(4)
        }
        .fullScreenCover(isPresented: $showSession) { SessionFlow(close: { showSession = false }) }
    }
}

struct RunTab: View {
    let start: () -> Void
    var body: some View { RunHomeView(start: start) }
}

/// Live session, then summary.
struct SessionFlow: View {
    let close: () -> Void
    @State private var finished = false
    var body: some View {
        if finished { SummaryView(done: close) } else { LiveSessionView(onEnd: { finished = true }) }
    }
}

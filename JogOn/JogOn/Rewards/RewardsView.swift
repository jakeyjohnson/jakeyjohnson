import SwiftUI

struct RewardsView: View {
    @Environment(AppState.self) private var state
    @State private var category = "All"
    private let cats = ["All", "Kit", "Care", "Fuel", "Mind"]
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    StatTile(value: "\(state.points)", label: "points to swap", accent: true)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack { ForEach(cats, id: \.self) { c in
                            Button(c) { category = c }.font(JO.label).padding(.horizontal, 16).padding(.vertical, 10)
                                .background(category == c ? JO.white : JO.graphite)
                                .foregroundStyle(category == c ? JO.black : JO.white).clipShape(Capsule())
                        } }
                    }
                    ForEach(Dummy.rewards.filter { category == "All" || $0.category == category }) { r in
                        NavigationLink { RewardDetailView(reward: r) } label: {
                            Card {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(r.partner).font(JO.small).foregroundStyle(JO.stone)
                                        Text(r.title).font(JO.label)
                                    }
                                    Spacer()
                                    Text(r.cost <= state.points ? "Swap" : "\(r.cost - state.points) to go")
                                        .font(JO.label).foregroundStyle(r.cost <= state.points ? JO.pink : JO.stone)
                                }
                            }
                        }.buttonStyle(.plain)
                    }
                    Text("Redeemed codes").font(JO.label).padding(.top, 8)
                    Text("Nothing yet. Your codes will live here.").font(JO.small).foregroundStyle(JO.stone)
                }
                .padding(JO.margin)
            }
            .background(JO.black.ignoresSafeArea()).navigationTitle("Rewards")
        }
    }
}

struct RewardDetailView: View {
    @Environment(AppState.self) private var state
    let reward: Dummy.Reward
    @State private var code: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(reward.partner).font(JO.label).foregroundStyle(JO.stone)
            DisplayText(text: reward.title, size: 44)
            Text(reward.terms).font(JO.body).foregroundStyle(JO.stone)
            Text("\(reward.cost) points").font(JO.number(32)).foregroundStyle(JO.pink)
            Spacer()
            if let code {
                Card { Text(code).font(JO.number(36)).textSelection(.enabled) }
                PrimaryButton(title: "Open partner site") {}
            } else {
                PinkButton(title: "Swap \(reward.cost) points") {
                    guard state.points >= reward.cost else { return }
                    state.points -= reward.cost; code = "JOGON-" + String(UUID().uuidString.prefix(6))
                }
                .opacity(state.points >= reward.cost ? 1 : 0.4)
            }
        }
        .padding(JO.margin).background(JO.black.ignoresSafeArea())
    }
}

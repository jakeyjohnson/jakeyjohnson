import SwiftUI

struct RewardsView: View {
    var body: some View {
        Screen {
            VStack(alignment: .leading, spacing: 16) {
                StatTile(value: Dummy.balance.formatted(), label: "points", accent: true)
                ForEach(Dummy.rewards) { r in
                    Card {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(r.partner).font(JO.label)
                                Text(r.title).font(JO.small).foregroundStyle(JO.stone)
                                Text("Partner reward. Jog On may earn commission.")
                                    .font(JO.small).foregroundStyle(JO.stone)
                            }
                            Spacer()
                            if Dummy.balance >= r.cost {
                                Button("Swap") {}.font(JO.label).foregroundStyle(JO.pink)
                            } else {
                                Text("\(r.cost - Dummy.balance) to go").font(JO.small).foregroundStyle(JO.stone)
                            }
                        }
                    }
                }
            }
        }
    }
}

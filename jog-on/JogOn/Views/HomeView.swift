import SwiftUI
import Charts

struct HomeView: View {
    var body: some View {
        Screen {
            VStack(alignment: .leading, spacing: 20) {
                Text("This week").font(JO.caps).foregroundStyle(JO.stone)
                Text("\(Dummy.weeklyMinutes)").font(JO.number(96))
                Text("of \(Dummy.weeklyGoal) minutes").font(JO.small).foregroundStyle(JO.stone)
                ProgressBar(value: Double(Dummy.weeklyMinutes) / Double(Dummy.weeklyGoal))

                Chart(Array(Dummy.week.enumerated()), id: \.offset) { i, m in
                    BarMark(x: .value("Day", ["M","T","W","T","F","S","S"][i]), y: .value("Min", m))
                        .foregroundStyle(JO.pink)
                }
                .frame(height: 110)

                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Today").font(JO.caps).foregroundStyle(JO.stone)
                        Text("Your first session is ready. 15 minutes, mostly walking.").font(JO.label)
                        PrimaryButton(title: "Play", action: {})
                    }
                }
                Card {
                    HStack {
                        StatTile(value: Dummy.balance.formatted(), label: "points", accent: true)
                        Text("260 to go for anti-chafe balm").font(JO.small).foregroundStyle(JO.stone)
                    }
                }
            }
        }
    }
}

import SwiftUI
import Charts

struct HomeView: View {
    @Environment(AppState.self) private var state
    let start: () -> Void
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("This week").font(JO.small).foregroundStyle(JO.stone)
                HStack(alignment: .firstTextBaseline) {
                    Text("\(Dummy.weeklyMinutes)").font(JO.number(96))
                    Text("minutes").font(JO.body).foregroundStyle(JO.stone)
                }
                ProgressBar(value: Double(Dummy.weeklyMinutes) / Double(Dummy.weeklyGoal))
                WeekChart()
                TodayCard(start: start)
                Card {
                    HStack {
                        StatTile(value: "\(state.points)", label: "points", accent: true)
                        Text("You can swap for anti chafe balm").font(JO.small).foregroundStyle(JO.stone)
                    }
                }
                Card {
                    HStack { Image(systemName: "mappin.and.ellipse").foregroundStyle(JO.pink)
                        VStack(alignment: .leading) { Text("Parkrun, Saturday 9:00").font(JO.label)
                            Text("Walkers welcome. 2.1 km away.").font(JO.small).foregroundStyle(JO.stone) } }
                }
            }
            .padding(JO.margin)
        }
        .background(JO.black.ignoresSafeArea())
    }
}

struct WeekChart: View {
    var body: some View {
        Chart(Array(Dummy.weekBars.enumerated()), id: \.offset) { _, bar in
            BarMark(x: .value("Day", bar.0), y: .value("Minutes", bar.1)).foregroundStyle(JO.pink).cornerRadius(4)
        }
        .chartYAxis(.hidden)
        .frame(height: 90)
        .accessibilityLabel("Minutes moved each day this week")
    }
}

struct TodayCard: View {
    let start: () -> Void
    var body: some View {
        Card {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Today").font(JO.small).foregroundStyle(JO.stone)
                    Text("Easy walk").font(JO.label)
                    Text("Your first session is ready. 15 minutes, mostly walking.").font(JO.small).foregroundStyle(JO.stone)
                }
                Spacer()
                Button(action: start) {
                    Image(systemName: "play.fill").font(.title2).foregroundStyle(JO.black)
                        .frame(width: 56, height: 56).background(JO.pink).clipShape(Circle())
                }
                .accessibilityLabel("Start today's session")
            }
        }
    }
}

#Preview { HomeView(start: {}).environment(AppState()) }

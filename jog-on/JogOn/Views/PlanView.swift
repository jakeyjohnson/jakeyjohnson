import SwiftUI

struct PlanView: View {
    var body: some View {
        Screen {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    DisplayText(text: "Start moving", size: 40)
                    Spacer()
                    Button("Pause plan") {}.font(JO.label).foregroundStyle(JO.pink)
                }
                ForEach(Dummy.plan) { week in
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Week \(week.number)").font(JO.caps).foregroundStyle(JO.stone)
                        ForEach(week.sessions) { s in
                            Card {
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text(s.title).font(JO.label)
                                        Text("\(s.minutes) min").font(JO.small).foregroundStyle(JO.stone)
                                    }
                                    Spacer()
                                    Text(label(s.status)).font(JO.caps)
                                        .foregroundStyle(s.status == .today ? JO.pink : JO.stone)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    private func label(_ s: SessionStatus) -> String {
        switch s { case .done: "DONE"; case .today: "TODAY"; case .upcoming: "UPCOMING"; case .missed: "MISSED" }
    }
}

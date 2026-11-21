import SwiftUI

struct PlanView: View {
    @State private var paused = false
    var body: some View {
        NavigationStack {
            List {
                ForEach(Dictionary(grouping: Dummy.plan, by: \.week).keys.sorted(), id: \.self) { week in
                    Section("Week \(week)") {
                        ForEach(Dummy.plan.filter { $0.week == week }) { row in
                            NavigationLink { SessionPreviewView(onStart: {}) } label: { PlanRow(row: row) }
                                .listRowBackground(JO.graphite)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden).background(JO.black)
            .navigationTitle("Plan")
            .toolbar { Button(paused ? "Resume plan" : "Pause plan") { paused.toggle() }.tint(JO.pink) }
        }
    }
}

struct PlanRow: View {
    let row: Dummy.Row
    var body: some View {
        HStack {
            Image(systemName: icon).foregroundStyle(row.status == .today ? JO.pink : JO.stone)
            VStack(alignment: .leading) {
                Text(row.title).font(JO.label)
                Text(row.detail).font(JO.small).foregroundStyle(JO.stone)
            }
        }
    }
    var icon: String {
        switch row.status {
        case .done: "checkmark.circle.fill"
        case .today: "play.circle.fill"
        case .missed: "xmark.circle"
        default: "circle"
        }
    }
}

struct SessionPreviewView: View {
    let onStart: () -> Void
    @State private var coach = true
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                DisplayText(text: "Walk and jog", size: 44)
                Text("\(clock(Dummy.intervals.reduce(0) { $0 + $1.seconds })) total").font(JO.body).foregroundStyle(JO.stone)
                HStack(spacing: 3) {
                    ForEach(Dummy.intervals) { i in
                        RoundedRectangle(cornerRadius: 4)
                            .fill(i.kind == .jog ? JO.pink : JO.line)
                            .frame(width: nil, height: i.kind == .jog ? 48 : 28)
                            .frame(maxWidth: CGFloat(i.seconds) / 4)
                    }
                }
                .frame(height: 48, alignment: .bottom)
                ForEach(Dummy.intervals) { i in
                    HStack { Text(i.kind.rawValue.capitalized).font(JO.body); Spacer(); Text(clock(i.seconds)).font(JO.number(22)) }
                }
                Toggle("Audio coach", isOn: $coach).font(JO.body)
                PinkButton(title: "Start", action: onStart)
            }
            .padding(JO.margin)
        }
        .background(JO.black.ignoresSafeArea())
    }
}

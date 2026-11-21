import SwiftUI

struct PlanView: View {
    @State private var paused = false
    private var weeks: [Int] { Array(Set(Dummy.plan.map(\.week))).sorted() }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    ForEach(weeks, id: \.self) { week in WeekCard(week: week, rows: Dummy.plan.filter { $0.week == week }) }
                }
                .padding(JO.margin)
            }
            .background(JO.black.ignoresSafeArea())
            .navigationTitle("Plan")
            .toolbar { Button(paused ? "Resume plan" : "Pause plan") { paused.toggle() }.tint(JO.pink) }
            .opacity(paused ? 0.5 : 1)
        }
    }
}

struct WeekCard: View {
    let week: Int; let rows: [Dummy.Row]
    private var current: Bool { rows.contains { $0.status == .today } }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Week \(week)").font(JO.display(28))
            ProgressBar(value: Double(rows.filter { $0.status == .done }.count) / Double(rows.count))
            Text("Sessions: \(rows.filter { $0.status == .done }.count)/\(rows.count)").font(JO.small).foregroundStyle(JO.stone)
            ForEach(rows) { row in
                NavigationLink { SessionPreviewView(onStart: {}) } label: {
                    HStack { PlanRow(row: row); Spacer(); Image(systemName: "chevron.right").foregroundStyle(JO.stone) }
                }.buttonStyle(.plain)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .background(JO.graphite)
        .overlay(RoundedRectangle(cornerRadius: JO.cardRadius).stroke(current ? JO.pink : .clear, lineWidth: 2))
        .clipShape(RoundedRectangle(cornerRadius: JO.cardRadius))
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

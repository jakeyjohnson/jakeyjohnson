import SwiftUI
import Charts

struct ActivityView: View {
    enum Range: String, CaseIterable { case w = "W", m = "M", y = "Y", all = "All" }
    @State private var range = Range.m
    private let history: [(Int, Double)] = (1...30).map { ($0, [3,8,12,17,21,26].contains($0) ? Double($0 % 4 + 1) * 0.6 : 0) }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Picker("Range", selection: $range) { ForEach(Range.allCases, id: \.self) { Text($0.rawValue) } }.pickerStyle(.segmented)
                Text("November 2026").font(JO.body).foregroundStyle(JO.stone)
                StatTile(value: "18.4", label: "kilometres", accent: true)
                HStack { StatTile(value: "6", label: "sessions"); StatTile(value: "2:38:00", label: "time"); StatTile(value: "412", label: "points") }
                Chart(history, id: \.0) { BarMark(x: .value("Day", $0.0), y: .value("km", $0.1)).foregroundStyle(JO.pink) }
                    .frame(height: 160).accessibilityLabel("Distance per day this month")
                Text("Recent activity").font(JO.label)
                ForEach(0..<3, id: \.self) { i in
                    Card {
                        HStack {
                            RoundedRectangle(cornerRadius: 10).fill(JO.line).frame(width: 56, height: 56)
                                .overlay(Image(systemName: "map.fill").foregroundStyle(JO.pink))
                            VStack(alignment: .leading) {
                                Text(["Friday walk and jog", "Wednesday walk and jog", "Monday walk and jog"][i]).font(JO.label)
                                Text(["20:00 · 1.9 km", "17:42 · 1.8 km", "15:10 · 1.4 km"][i]).font(JO.small).foregroundStyle(JO.stone)
                            }
                        }
                    }
                }
            }
            .padding(JO.margin)
        }
        .background(JO.black.ignoresSafeArea()).navigationTitle("Activity")
    }
}

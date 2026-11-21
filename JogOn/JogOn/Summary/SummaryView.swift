import SwiftUI
import MapKit

struct SummaryView: View {
    let done: () -> Void
    @State private var feel: Feel?
    @State private var points = 0
    var body: some View {
        ZStack {
            JO.pink.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    DisplayText(text: "Longest one yet.", size: 60).foregroundStyle(JO.black)
                    Map { MapPolyline(coordinates: LiveSessionView.route).stroke(JO.black, lineWidth: 5) }
                        .frame(height: 180).clipShape(RoundedRectangle(cornerRadius: JO.cardRadius))
                    HStack {
                        summaryStat("17:42", "time"); summaryStat("1.8", "km"); summaryStat("2,340", "steps")
                    }
                    summaryStat("+\(points)", "points earned")
                    Text("How did it feel?").font(JO.label).foregroundStyle(JO.black)
                    HStack {
                        ForEach([Feel.easy, .okay, .tough], id: \.self) { f in
                            Button(f.rawValue.capitalized) { feel = f }.font(JO.label)
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .background(feel == f ? JO.black : .clear)
                                .foregroundStyle(feel == f ? JO.white : JO.black)
                                .overlay(Capsule().stroke(JO.black, lineWidth: 2)).clipShape(Capsule())
                        }
                    }
                    ShareLink(item: "I just finished a session on Jog On.") {
                        Text("Share").font(JO.label).frame(maxWidth: .infinity, minHeight: JO.buttonHeight)
                            .overlay(Capsule().stroke(JO.black, lineWidth: 2)).foregroundStyle(JO.black)
                    }
                    PrimaryButton(title: "Done", inverted: true, action: done)
                }
                .padding(JO.margin)
            }
        }
        .task { withAnimation(.easeOut(duration: 1.2)) { points = 35 } }
    }

    private func summaryStat(_ v: String, _ l: String) -> some View {
        VStack(alignment: .leading) {
            Text(v).font(JO.number(40)).contentTransition(.numericText())
            Text(l).font(JO.small)
        }.foregroundStyle(JO.black).frame(maxWidth: .infinity, alignment: .leading)
    }
}

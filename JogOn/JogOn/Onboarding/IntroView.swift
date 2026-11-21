import SwiftUI

/// Swipeable benefit screens shown before sign-up.
struct IntroView: View {
    let signUp: () -> Void; let logIn: () -> Void
    @State private var page = 0
    private let pages: [(String, String, String)] = [
        ("Built for bodies like ours.", "figure.walk", "Gentle walk and jog plans that start where you are."),
        ("Your pace stays private.", "eye.slash.fill", "Pace is hidden by default. Minutes are what count."),
        ("Get rewarded for showing up.", "gift.fill", "Earn points for every minute and swap them for kit that fits."),
        ("A plan that bends with you.", "calendar", "Pause it, swap days, tell us how it felt. It adapts.")
    ]
    var body: some View {
        ZStack {
            JO.black.ignoresSafeArea()
            VStack(spacing: 20) {
                HStack(spacing: 6) { ForEach(0..<pages.count, id: \.self) { Capsule().fill($0 <= page ? JO.white : JO.line).frame(height: 3) } }
                    .padding(.horizontal, JO.margin)
                TabView(selection: $page) {
                    ForEach(0..<pages.count, id: \.self) { i in
                        VStack(alignment: .leading, spacing: 24) {
                            DisplayText(text: pages[i].0, size: 48)
                            Image(systemName: pages[i].1).font(.system(size: 80)).foregroundStyle(JO.pink)
                                .frame(maxWidth: .infinity, minHeight: 200)
                            Text(pages[i].2).font(JO.body).foregroundStyle(JO.stone)
                            Spacer()
                        }
                        .padding(.horizontal, JO.margin).tag(i)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                VStack(spacing: 10) {
                    PinkButton(title: "Sign up", action: signUp)
                    PrimaryButton(title: "Log in", action: logIn)
                }.padding(.horizontal, JO.margin)
            }
            .foregroundStyle(JO.white)
        }
    }
}

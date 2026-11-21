import SwiftUI

struct WelcomeView: View {
    let onStart: () -> Void
    var body: some View {
        ZStack {
            JO.pink.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 24) {
                Spacer()
                DisplayText(text: "Running apps weren't built for us. So we built one.", size: 56)
                    .foregroundStyle(JO.black)
                PrimaryButton(title: "Get started", inverted: true, action: onStart)
                Text("Check with a GP if you have a health condition or haven't exercised in a long time.")
                    .font(JO.small).foregroundStyle(JO.black.opacity(0.7))
            }
            .padding(24)
        }
    }
}

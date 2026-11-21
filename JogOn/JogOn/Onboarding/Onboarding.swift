import SwiftUI

struct OnboardingFlow: View {
    @Environment(AppState.self) private var state
    @State private var step = 0
    @State private var goal = ""
    @State private var showIntro = true
    var body: some View {
        ZStack {
            if showIntro {
                IntroView(signUp: { showIntro = false }, logIn: { showIntro = false; step = 4 })
            } else {
            switch step {
            case 0: WelcomeView(next: { step = 1 }, signIn: { step = 4 })
            case 1: GoalView(selection: $goal, next: { step = 2 })
            case 2: StartingPointView(next: { step = 3 })
            case 3: PermissionsView(next: { step = 4 })
            case 4: SignInView(next: { step = 5 })
            default: PlanReadyView(finish: { state.goal = goal; state.onboarded = true })
            }
            }
        }
        .animation(.easeInOut, value: step)
    }
}

struct WelcomeView: View {
    let next: () -> Void; let signIn: () -> Void
    var body: some View {
        ZStack {
            JO.pink.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                Spacer()
                Text("JOG ON").font(JO.label).tracking(3).foregroundStyle(JO.black)
                DisplayText(text: "Running apps weren't built for us. So we built one.", size: 54)
                    .foregroundStyle(JO.black)
                Spacer()
                PrimaryButton(title: "Get started", inverted: true, action: next)
                Button("Sign in", action: signIn).font(JO.label).foregroundStyle(JO.black)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .padding(JO.margin)
        }
    }
}

struct OnboardingScaffold<Content: View>: View {
    let title: String; let cta: String; var enabled = true; let action: () -> Void
    @ViewBuilder var content: Content
    var body: some View {
        ZStack {
            JO.black.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 20) {
                DisplayText(text: title, size: 40)
                content
                Spacer()
                PinkButton(title: cta, action: action).opacity(enabled ? 1 : 0.4).disabled(!enabled)
            }
            .padding(JO.margin)
        }
        .foregroundStyle(JO.white)
    }
}

struct Choice: View {
    let title: String; let selected: Bool; let tap: () -> Void
    var body: some View {
        Button(action: tap) {
            HStack {
                Text(title).font(JO.body)
                Spacer()
                if selected { Image(systemName: "checkmark").foregroundStyle(JO.pink) }
            }
            .padding(18).background(JO.graphite)
            .overlay(RoundedRectangle(cornerRadius: JO.cardRadius).stroke(selected ? JO.pink : .clear, lineWidth: 2))
            .clipShape(RoundedRectangle(cornerRadius: JO.cardRadius))
        }
        .buttonStyle(.plain)
    }
}

struct GoalView: View {
    @Binding var selection: String; let next: () -> Void
    private let goals = ["Move more", "Walk a 5K", "Jog a 5K", "Just feel better"]
    var body: some View {
        OnboardingScaffold(title: "What would you like?", cta: "Continue", enabled: !selection.isEmpty, action: next) {
            ForEach(goals, id: \.self) { g in Choice(title: g, selected: selection == g) { selection = g } }
        }
    }
}

struct StartingPointView: View {
    let next: () -> Void
    @State private var movement = "A bit"
    @State private var niggles: Set<String> = []
    @State private var days = 3
    var body: some View {
        OnboardingScaffold(title: "Where are you now?", cta: "Continue", action: next) {
            Text("How much do you move").font(JO.label)
            Picker("Movement", selection: $movement) {
                ForEach(["Rarely", "A bit", "Most days"], id: \.self) { Text($0) }
            }.pickerStyle(.segmented)
            Text("Any niggles?").font(JO.label)
            HStack {
                ForEach(["Knees", "Hips", "Back", "None"], id: \.self) { n in
                    Button(n) { if niggles.contains(n) { niggles.remove(n) } else { niggles.insert(n) } }
                        .font(JO.small).padding(.horizontal, 14).padding(.vertical, 10)
                        .background(niggles.contains(n) ? JO.pink : JO.graphite)
                        .foregroundStyle(niggles.contains(n) ? JO.black : JO.white).clipShape(Capsule())
                }
            }
            Stepper("Days per week: \(days)", value: $days, in: 2...4).font(JO.body)
        }
    }
}

struct PermissionsView: View {
    let next: () -> Void
    @State private var index = 0
    private let items: [(String, String, String)] = [
        ("Location", "location.fill", "So we can draw your route and measure distance. Only while you're using the app."),
        ("Motion and Fitness", "figure.walk", "So we can count your steps without a watch."),
        ("Health", "heart.fill", "So your sessions show up in Apple Health."),
        ("Notifications", "bell.fill", "A gentle nudge on session days. Never more.")
    ]
    var body: some View {
        let item = items[index]
        OnboardingScaffold(title: item.0, cta: "Allow", action: {
            if index < items.count - 1 { index += 1 } else { next() }
        }) {
            Image(systemName: item.1).font(.system(size: 56)).foregroundStyle(JO.pink)
            Text(item.2).font(JO.body).foregroundStyle(JO.stone)
        }
    }
}

struct SignInView: View {
    let next: () -> Void
    var body: some View {
        OnboardingScaffold(title: "Save your progress", cta: "Sign in with Apple", action: next) {
            Text("Your points and sessions stay safe if you change phone.").font(JO.body).foregroundStyle(JO.stone)
            Button("Use email instead", action: next).font(JO.label)
        }
    }
}

struct PlanReadyView: View {
    let finish: () -> Void
    var body: some View {
        OnboardingScaffold(title: "Your plan is ready", cta: "Start week 1", action: finish) {
            Card {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Start Moving").font(JO.label).foregroundStyle(JO.pink)
                    Text("8 weeks · 3 sessions a week").font(JO.body)
                    Text("First session: tomorrow, 15 minutes, mostly walking.").font(JO.small).foregroundStyle(JO.stone)
                }
            }
        }
    }
}

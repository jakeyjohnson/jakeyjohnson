import SwiftUI

@Observable final class AppState {
    var onboarded = UserDefaults.standard.bool(forKey: "onboarded") {
        didSet { UserDefaults.standard.set(onboarded, forKey: "onboarded") }
    }
    var goal = "Move more"
    var showPace = false
    var useMiles = false
    var points = Dummy.balance
    var selectedTab = 0
}

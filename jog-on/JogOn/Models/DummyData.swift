import Foundation

enum SessionStatus { case done, today, upcoming, missed }

struct PlanSession: Identifiable {
    let id = UUID()
    let title: String
    let minutes: Int
    let blocks: [IntervalBlock]
    var status: SessionStatus
}

struct IntervalBlock: Identifiable {
    enum Kind: String { case walk = "Walk", jog = "Jog" }
    let id = UUID()
    let kind: Kind
    let seconds: Int
}

struct PlanWeek: Identifiable {
    let id = UUID()
    let number: Int
    let sessions: [PlanSession]
}

struct Reward: Identifiable {
    let id = UUID()
    let partner: String
    let title: String
    let cost: Int
    let category: String
}

enum Dummy {
    static let balance = 2_340
    static let weeklyMinutes = 62
    static let weeklyGoal = 90
    static let week: [Double] = [20, 0, 25, 0, 17, 0, 0]

    private static func blocks(_ walk: Int, _ jog: Int, reps: Int) -> [IntervalBlock] {
        (0..<reps).flatMap { _ in
            [IntervalBlock(kind: .jog, seconds: jog), IntervalBlock(kind: .walk, seconds: walk)]
        }
    }

    static let plan: [PlanWeek] = [
        PlanWeek(number: 1, sessions: [
            PlanSession(title: "Easy start", minutes: 15, blocks: blocks(120, 30, reps: 6), status: .done),
            PlanSession(title: "Easy start", minutes: 15, blocks: blocks(120, 30, reps: 6), status: .today),
            PlanSession(title: "Easy start", minutes: 15, blocks: blocks(120, 30, reps: 6), status: .upcoming),
        ]),
        PlanWeek(number: 2, sessions: [
            PlanSession(title: "Build", minutes: 18, blocks: blocks(100, 40, reps: 7), status: .upcoming),
            PlanSession(title: "Strength and mobility", minutes: 20, blocks: [], status: .upcoming),
            PlanSession(title: "Build", minutes: 18, blocks: blocks(100, 40, reps: 7), status: .upcoming),
        ]),
    ]

    static let rewards: [Reward] = [
        Reward(partner: "Altra", title: "10% off running shoes", cost: 3_000, category: "Shoes"),
        Reward(partner: "Striide", title: "15% off socks", cost: 1_500, category: "Kit"),
        Reward(partner: "Anti-chafe balm", title: "Free balm with any order", cost: 2_600, category: "Care"),
        Reward(partner: "Decathlon", title: "£5 gift card", cost: 25_000, category: "Gift cards"),
    ]
}

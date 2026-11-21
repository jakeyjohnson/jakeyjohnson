import Foundation

enum Dummy {
    struct Reward: Identifiable { let id = UUID(); let partner: String; let title: String; let cost: Int; let category: String; let terms: String }
    struct Row: Identifiable { let id = UUID(); let week: Int; let title: String; let detail: String; let status: SessionStatus }

    static let balance = 740
    static let weeklyMinutes = 62
    static let weeklyGoal = 90
    static let weekBars: [(String, Int)] = [("M",20),("T",0),("W",25),("T",0),("F",17),("S",0),("S",0)]

    static let intervals: [Interval] = [
        .init(kind: .warmup, seconds: 300), .init(kind: .walk, seconds: 120), .init(kind: .jog, seconds: 60),
        .init(kind: .walk, seconds: 120), .init(kind: .jog, seconds: 60), .init(kind: .walk, seconds: 120),
        .init(kind: .jog, seconds: 60), .init(kind: .cooldown, seconds: 300)
    ]

    static let rewards: [Reward] = [
        .init(partner: "Chafe Co", title: "Anti chafe balm", cost: 500, category: "Care", terms: "One per member. Code valid 30 days."),
        .init(partner: "Fit & Free", title: "20% off sports bras", cost: 300, category: "Kit", terms: "Excludes sale items."),
        .init(partner: "Stride Shoes", title: "£10 off trainers", cost: 1000, category: "Kit", terms: "Min spend £60."),
        .init(partner: "Oat Bar", title: "Free box of bars", cost: 260, category: "Fuel", terms: "Pay postage only."),
        .init(partner: "Calm", title: "1 month free", cost: 800, category: "Mind", terms: "New users only.")
    ]

    static let plan: [Row] = [
        .init(week: 1, title: "Walk and jog", detail: "15 min · Mon", status: .done),
        .init(week: 1, title: "Walk and jog", detail: "15 min · Wed", status: .done),
        .init(week: 1, title: "Easy walk", detail: "20 min · Fri", status: .today),
        .init(week: 2, title: "Walk and jog", detail: "18 min · Mon", status: .upcoming),
        .init(week: 2, title: "Walk and jog", detail: "18 min · Wed", status: .upcoming),
        .init(week: 2, title: "Longer walk", detail: "25 min · Sat", status: .upcoming)
    ]
}

func clock(_ s: Int) -> String { String(format: "%d:%02d", s / 60, s % 60) }

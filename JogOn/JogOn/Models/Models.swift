import SwiftData
import Foundation

@Model final class Plan {
    @Attribute(.unique) var id: String
    var name: String
    var weeks: Int
    var sessionsPerWeek: Int
    var isPaused: Bool = false
    var pausedUntil: Date?
    @Relationship(deleteRule: .cascade) var sessions: [PlannedSession] = []
    init(id: String, name: String, weeks: Int, sessionsPerWeek: Int) {
        self.id = id; self.name = name; self.weeks = weeks; self.sessionsPerWeek = sessionsPerWeek
    }
}

@Model final class PlannedSession {
    var week: Int
    var index: Int
    var scheduledDate: Date
    var title: String
    var intervalsJSON: Data
    var status: SessionStatus = SessionStatus.upcoming
    init(week: Int, index: Int, scheduledDate: Date, title: String, intervalsJSON: Data) {
        self.week = week; self.index = index; self.scheduledDate = scheduledDate
        self.title = title; self.intervalsJSON = intervalsJSON
    }
}

enum SessionStatus: String, Codable { case upcoming, today, done, missed, skipped }

struct Interval: Codable, Hashable, Identifiable {
    enum Kind: String, Codable { case warmup, walk, jog, cooldown }
    var id = UUID()
    var kind: Kind
    var seconds: Int
    private enum CodingKeys: String, CodingKey { case kind, seconds }
}

@Model final class Activity {
    @Attribute(.unique) var id: UUID
    var startedAt: Date
    var endedAt: Date
    var movingSeconds: Int
    var distanceMetres: Double
    var steps: Int
    var routePolyline: Data
    var feel: Feel?
    var healthKitWorkoutID: UUID?
    var syncState: SyncState = SyncState.pending
    var pointsAwarded: Int = 0
    init(id: UUID = UUID(), startedAt: Date, endedAt: Date, movingSeconds: Int,
         distanceMetres: Double, steps: Int, routePolyline: Data) {
        self.id = id; self.startedAt = startedAt; self.endedAt = endedAt
        self.movingSeconds = movingSeconds; self.distanceMetres = distanceMetres
        self.steps = steps; self.routePolyline = routePolyline
    }
}

enum Feel: String, Codable { case easy, okay, tough }
enum SyncState: String, Codable { case pending, synced, rejected }

import Foundation
import GRDB
import UIKit
import Capacitor

/**
 * 离线定位数据库管理器（黑匣子）。
 *
 * 使用 GRDB.swift 操作 SQLite，表结构与 Android Room LocationEntity 一致，
 * 确保断网/后台/异常状态下 GPS 轨迹不丢失，恢复网络/前台后可被 JS 层拉取并 ACK。
 */
final class LocationDatabase {

    static let shared = LocationDatabase()

    private var dbQueue: DatabaseQueue?
    private let dbFileName = "location.db"

    private init() {}

    // MARK: - Setup

    func setup() throws {
        guard dbQueue == nil else { return }

        let folderURL = FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first!
            .appendingPathComponent("CityLord", isDirectory: true)

        try FileManager.default.createDirectory(
            at: folderURL,
            withIntermediateDirectories: true,
            attributes: nil
        )

        let dbURL = folderURL.appendingPathComponent(dbFileName)
        dbQueue = try DatabaseQueue(path: dbURL.path)

        try dbQueue?.write { db in
            try db.create(table: LocationRecord.databaseTableName, ifNotExists: true) { t in
                t.autoIncrementedPrimaryKey("id")
                t.column("sessionId", .text).notNull()
                t.column("latitude", .double).notNull()
                t.column("longitude", .double).notNull()
                t.column("timestamp", .integer).notNull()
                t.column("isAcked", .boolean).notNull().defaults(to: false)
                t.column("accuracy", .double).notNull().defaults(to: 0)
                t.column("speed", .double).notNull().defaults(to: 0)
                t.column("bearing", .double).notNull().defaults(to: 0)
                t.column("isMock", .boolean).notNull().defaults(to: false)
            }

            try db.create(
                indexOn: LocationRecord.databaseTableName,
                columns: ["sessionId", "isAcked"],
                ifNotExists: true
            )
        }
    }

    // MARK: - Insert

    func insert(
        sessionId: String,
        latitude: Double,
        longitude: Double,
        timestamp: Int64,
        accuracy: Double,
        speed: Double,
        bearing: Double,
        isMock: Bool
    ) throws {
        try ensureQueue()

        var record = LocationRecord(
            id: nil,
            sessionId: sessionId,
            latitude: latitude,
            longitude: longitude,
            timestamp: timestamp,
            isAcked: false,
            accuracy: accuracy,
            speed: speed,
            bearing: bearing,
            isMock: isMock
        )

        var backgroundTask: UIBackgroundTaskIdentifier = .invalid
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "CityLord.locationInsert") {
            if backgroundTask != .invalid {
                UIApplication.shared.endBackgroundTask(backgroundTask)
                backgroundTask = .invalid
            }
        }

        defer {
            if backgroundTask != .invalid {
                UIApplication.shared.endBackgroundTask(backgroundTask)
            }
        }

        try dbQueue?.write { db in
            try record.insert(db)
        }
    }

    // MARK: - Query unsynced

    func getUnsynced(sessionId: String) throws -> [LocationRecord] {
        try ensureQueue()
        return try dbQueue?.read { db in
            try LocationRecord
                .filter(Column("sessionId") == sessionId && Column("isAcked") == false)
                .order(Column("timestamp").asc)
                .fetchAll(db)
        } ?? []
    }

    // MARK: - Acknowledge

    func acknowledge(ids: [Int64]) throws -> Int {
        try ensureQueue()
        return try dbQueue?.write { db in
            try LocationRecord
                .filter(ids.contains(Column("id")))
                .updateAll(db, Column("isAcked").set(to: true))
        } ?? 0
    }

    // MARK: - Hydrate points

    func hydratePoints(sessionId: String, sinceTimestamp: Int64, limit: Int = 1000) throws -> (points: [LocationRecord], capped: Bool) {
        try ensureQueue()
        let records = try dbQueue?.read { db in
            try LocationRecord
                .filter(Column("sessionId") == sessionId && Column("timestamp") > sinceTimestamp)
                .order(Column("timestamp").asc)
                .limit(limit + 1)
                .fetchAll(db)
        } ?? []

        let capped = records.count > limit
        return ( capped ? Array(records.prefix(limit)) : records, capped)
    }

    // MARK: - Helpers

    private func ensureQueue() throws {
        if dbQueue == nil {
            try setup()
        }
    }
}

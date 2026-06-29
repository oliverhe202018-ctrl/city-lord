import Foundation
import GRDB

/**
 * 离线定位记录实体，与 Android 端 Room LocationEntity 一一对应。
 *
 * 表名：location_records
 * 索引：(sessionId, isAcked)
 */
struct LocationRecord: Codable, FetchableRecord, MutablePersistableRecord {
    static let databaseTableName = "location_records"

    /// 自增主键
    var id: Int64?

    /// 跑步会话 ID（对应 TS 层 runId）
    var sessionId: String

    /// 纬度 (GCJ-02)
    var latitude: Double

    /// 经度 (GCJ-02)
    var longitude: Double

    /// GPS 采样时间戳 (毫秒)
    var timestamp: Int64

    /// 是否已被 JS 层确认同步
    var isAcked: Bool

    /// 定位精度 (米)
    var accuracy: Double

    /// 速度 (米/秒)
    var speed: Double

    /// 方向角
    var bearing: Double

    /// 是否为模拟定位
    var isMock: Bool

    /// 编码 keys，保持与数据库列名一致
    enum CodingKeys: String, CodingKey {
        case id
        case sessionId
        case latitude
        case longitude
        case timestamp
        case isAcked
        case accuracy
        case speed
        case bearing
        case isMock
    }

    mutating func didInsert(with rowID: Int64, for column: String?) {
        id = rowID
    }
}

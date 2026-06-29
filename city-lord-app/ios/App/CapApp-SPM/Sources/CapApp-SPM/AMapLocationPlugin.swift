import Foundation
import Capacitor
import CoreLocation

/**
 * AMapLocationPlugin — iOS 端定位桥接插件
 *
 * 当前实现基于 CoreLocation（CLLocationManager），作为向 iOS 迁移的过渡方案。
 * 所有坐标在返回前均从 WGS-84 转换为 GCJ-02，以与 Android 端高德 SDK 输出保持一致。
 *
 * 后续可在 macOS + Xcode 环境中将 CoreLocation 替换为 AMapLocation iOS SDK，
 * 届时只需删除坐标转换步骤并直接透传高德返回的 GCJ-02 坐标即可。
 */
@objc(AMapLocationPlugin)
public class AMapLocationPlugin: CAPPlugin, CLLocationManagerDelegate {

    // MARK: - Constants
    private static let FORCE_DESTROY_CODE = 9999
    private static let MOCK_ACCURACY_THRESHOLD: CLLocationDistance = 100.0
    private static let LOCATION_TYPE_GPS = 1
    private static let LOCATION_TYPE_LAST_KNOWN = 9

    // MARK: - State
    private var locationManager: CLLocationManager?
    private var isWatching = false
    private var isTracking = false
    private var currentSessionId: String?
    private var watchMode = "browse"
    private var watchInterval: TimeInterval = 2000.0
    private var distanceFilter: CLLocationDistance = 10.0
    private var privacyShown = false
    private var privacyAgreed = false

    // MARK: - Plugin lifecycle
    override public func load() {
        super.load()
        ensurePrivacyDefaults()

        DispatchQueue.global(qos: .utility).async {
            do {
                try LocationDatabase.shared.setup()
                CAPLog.print("[AMapLocationPlugin] Location database setup complete")
            } catch {
                CAPLog.print("[AMapLocationPlugin] Failed to setup location database: \(error.localizedDescription)")
            }
        }
    }

    override public func handleOnDestroy() {
        stopAllLocationUpdates()
        super.handleOnDestroy()
    }

    // MARK: - Privacy compliance
    @objc func updatePrivacyShow(_ call: CAPPluginCall) {
        let isContains = call.getBool("isContains") ?? true
        let isShow = call.getBool("isShow") ?? true
        privacyShown = isShow
        privacyAgreed = privacyAgreed || isShow
        call.resolve()
    }

    @objc func updatePrivacyAgree(_ call: CAPPluginCall) {
        let isAgree = call.getBool("isAgree") ?? true
        privacyAgreed = isAgree
        call.resolve()
    }

    private func ensurePrivacyDefaults() {
        privacyShown = true
        privacyAgreed = true
    }

    private func ensurePrivacyCompliance(_ call: CAPPluginCall) -> Bool {
        guard privacyAgreed else {
            call.reject("Privacy agreement not accepted", nil, nil)
            return false
        }
        return true
    }

    // MARK: - getCurrentPosition
    @objc func getCurrentPosition(_ call: CAPPluginCall) {
        guard ensurePrivacyCompliance(call) else { return }

        let mode = call.getString("mode") ?? "fast"
        let timeout = call.getInt("timeout") ?? 8000
        _ = call.getInt("cacheMaxAge") ?? 5000

        CAPLog.print("[AMapLocationPlugin] getCurrentPosition mode=", mode)

        DispatchQueue.main.async {
            let manager = self.createLocationManager()
            manager.desiredAccuracy = kCLLocationAccuracyBest
            manager.distanceFilter = kCLDistanceFilterNone

            let delegate = OneShotLocationDelegate(
                timeout: TimeInterval(timeout) / 1000.0,
                allowCached: mode == "fast"
            ) { [weak self] location, error in
                guard let self = self else { return }
                if let error = error {
                    call.reject("Location error: \(error.localizedDescription)")
                    return
                }
                guard let location = location else {
                    call.reject("Location is null")
                    return
                }
                call.resolve(self.locationToJSObject(location))
            }

            delegate.manager = manager
            manager.delegate = delegate
            manager.requestLocation()
        }
    }

    // MARK: - startWatch / stopWatch
    @objc func startWatch(_ call: CAPPluginCall) {
        guard ensurePrivacyCompliance(call) else { return }

        watchMode = call.getString("mode") ?? "browse"
        watchInterval = TimeInterval(call.getInt("interval") ?? (watchMode == "browse" ? 2000 : 1000)) / 1000.0
        distanceFilter = CLLocationDistance(call.getInt("distanceFilter") ?? (watchMode == "browse" ? 10 : 3))

        CAPLog.print("[AMapLocationPlugin] startWatch mode=", watchMode, "interval=", watchInterval, "distanceFilter=", distanceFilter)

        DispatchQueue.main.async {
            self.stopAllLocationUpdates()

            let manager = self.createLocationManager()
            manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
            manager.distanceFilter = self.distanceFilter
            manager.allowsBackgroundLocationUpdates = self.isTracking
            manager.pausesLocationUpdatesAutomatically = false
            manager.activityType = .fitness
            manager.delegate = self

            self.locationManager = manager
            self.isWatching = true
            manager.startUpdatingLocation()

            call.resolve(["watchId": "amap-watch-\(Date().timeIntervalSince1970 * 1000)"])
        }
    }

    @objc func stopWatch(_ call: CAPPluginCall) {
        CAPLog.print("[AMapLocationPlugin] stopWatch called")
        DispatchQueue.main.async {
            self.stopAllLocationUpdates()
            call.resolve()
        }
    }

    @objc func forceDestroy(_ call: CAPPluginCall) {
        CAPLog.print("[AMapLocationPlugin] forceDestroy called")
        DispatchQueue.main.async {
            self.stopAllLocationUpdates()
            self.notifyListeners("locationError", data: [
                "code": AMapLocationPlugin.FORCE_DESTROY_CODE,
                "message": "Location client forcibly destroyed"
            ])
            call.resolve()
        }
    }

    // MARK: - startTracking / stopTracking
    @objc func startTracking(_ call: CAPPluginCall) {
        CAPLog.print("[AMapLocationPlugin] startTracking called")
        let runId = call.getString("runId")
        DispatchQueue.main.async {
            self.isTracking = true
            self.currentSessionId = runId
            self.locationManager?.allowsBackgroundLocationUpdates = true
            if self.isWatching {
                self.locationManager?.stopUpdatingLocation()
                self.locationManager?.startUpdatingLocation()
            }
            call.resolve()
        }
    }

    @objc func stopTracking(_ call: CAPPluginCall) {
        CAPLog.print("[AMapLocationPlugin] stopTracking called")
        DispatchQueue.main.async {
            self.isTracking = false
            self.currentSessionId = nil
            self.stopAllLocationUpdates()
            call.resolve()
        }
    }

    @objc func isTrackingAlive(_ call: CAPPluginCall) {
        call.resolve(["isAlive": isWatching || isTracking])
    }

    @objc func updateNotificationSteps(_ call: CAPPluginCall) {
        // iOS 无通知栏步数显示，no-op
        call.resolve()
    }

    // MARK: - Android-specific no-ops
    @objc func openAppPermissionSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve([
                "opened": true,
                "route": "system_settings",
                "component": "UIApplication.openSettingsURLString"
            ])
        }
    }

    @objc func isBatteryOptimizationIgnored(_ call: CAPPluginCall) {
        // iOS 无电池优化白名单概念
        call.resolve(["isIgnored": true])
    }

    @objc func openBatteryOptimizationSettings(_ call: CAPPluginCall) {
        // iOS 无电池优化设置页
        call.resolve(["opened": false])
    }

    @objc func getRomInfo(_ call: CAPPluginCall) {
        call.resolve([
            "manufacturer": "Apple",
            "brand": "Apple",
            "isAggressive": false
        ])
    }

    // MARK: - Offline locations (Room 黑匣子)
    @objc func getOfflineLocations(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId"), !sessionId.isEmpty else {
            call.reject("Missing sessionId")
            return
        }

        DispatchQueue.global(qos: .utility).async {
            do {
                let records = try LocationDatabase.shared.getUnsynced(sessionId: sessionId)
                let locations = records.map { self.recordToJSObject($0) }
                call.resolve(["locations": locations, "count": locations.count])
            } catch {
                call.reject("getOfflineLocations failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func acknowledgeLocations(_ call: CAPPluginCall) {
        guard let ids = call.getArray("ids", Int.self), !ids.isEmpty else {
            call.resolve(["acknowledged": 0])
            return
        }

        DispatchQueue.global(qos: .utility).async {
            do {
                let count = try LocationDatabase.shared.acknowledge(ids: ids.map { Int64($0) })
                call.resolve(["acknowledged": count])
            } catch {
                call.reject("acknowledgeLocations failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func hydrateOfflinePoints(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId"), !sessionId.isEmpty else {
            call.reject("Missing sessionId")
            return
        }
        let sinceTimestamp = call.getInt("sinceTimestamp") ?? 0

        DispatchQueue.global(qos: .utility).async {
            do {
                let (records, capped) = try LocationDatabase.shared.hydratePoints(
                    sessionId: sessionId,
                    sinceTimestamp: Int64(sinceTimestamp)
                )
                let points = records.map { [
                    "lat": $0.latitude,
                    "lng": $0.longitude,
                    "timestamp": $0.timestamp,
                    "accuracy": $0.accuracy,
                    "speed": $0.speed,
                    "bearing": $0.bearing
                ] }
                call.resolve(["points": points, "count": points.count, "capped": capped])
            } catch {
                call.reject("hydrateOfflinePoints failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - CLLocationManagerDelegate
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let payload = locationToJSObject(location)
        notifyListeners("locationUpdate", data: payload)

        // 后台/跑步模式下持久化到 SQLite 黑匣子
        if isTracking, let sessionId = currentSessionId {
            DispatchQueue.global(qos: .utility).async {
                do {
                    try LocationDatabase.shared.insert(
                        sessionId: sessionId,
                        latitude: payload["lat"] as? Double ?? 0,
                        longitude: payload["lng"] as? Double ?? 0,
                        timestamp: payload["timestamp"] as? Int64 ?? 0,
                        accuracy: payload["accuracy"] as? Double ?? 0,
                        speed: payload["speed"] as? Double ?? -1,
                        bearing: payload["bearing"] as? Double ?? -1,
                        isMock: payload["isMock"] as? Bool ?? false
                    )
                } catch {
                    CAPLog.print("[AMapLocationPlugin] Failed to persist location: \(error.localizedDescription)")
                }
            }
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        CAPLog.print("[AMapLocationPlugin] locationManager didFailWithError: \(error.localizedDescription)")
        notifyListeners("locationError", data: [
            "code": (error as NSError).code,
            "message": error.localizedDescription
        ])
    }

    // MARK: - Helpers
    private func createLocationManager() -> CLLocationManager {
        let manager = CLLocationManager()
        manager.requestWhenInUseAuthorization()
        return manager
    }

    private func stopAllLocationUpdates() {
        locationManager?.stopUpdatingLocation()
        locationManager?.delegate = nil
        locationManager = nil
        isWatching = false
    }

    private func locationToJSObject(_ location: CLLocation) -> [String: Any] {
        let gcj = wgs84ToGcj02(lat: location.coordinate.latitude, lng: location.coordinate.longitude)
        let isMock = location.horizontalAccuracy > AMapLocationPlugin.MOCK_ACCURACY_THRESHOLD
        return [
            "lat": gcj.lat,
            "lng": gcj.lng,
            "accuracy": location.horizontalAccuracy,
            "altitude": location.altitude,
            "speed": location.speed >= 0 ? location.speed : -1,
            "bearing": location.course >= 0 ? location.course : -1,
            "timestamp": Int64(location.timestamp.timeIntervalSince1970 * 1000),
            "locationType": isMock ? AMapLocationPlugin.LOCATION_TYPE_LAST_KNOWN : AMapLocationPlugin.LOCATION_TYPE_GPS,
            "isMock": isMock,
            "provider": "ios-corelocation"
        ]
    }

    private func recordToJSObject(_ record: LocationRecord) -> [String: Any] {
        return [
            "id": record.id ?? 0,
            "sessionId": record.sessionId,
            "lat": record.latitude,
            "lng": record.longitude,
            "timestamp": record.timestamp,
            "accuracy": record.accuracy,
            "speed": record.speed,
            "bearing": record.bearing,
            "isMock": record.isMock
        ]
    }

    // MARK: - WGS-84 → GCJ-02 坐标转换
    private func wgs84ToGcj02(lat: Double, lng: Double) -> (lat: Double, lng: Double) {
        let pi = Double.pi
        let a = 6378245.0
        let ee = 0.00669342162296594323

        func outOfChina(_ lat: Double, _ lng: Double) -> Bool {
            return lng < 72.004 || lng > 135.05 || lat < 0.8293 || lat > 55.8271
        }

        if outOfChina(lat, lng) { return (lat, lng) }

        var dLat = transformLat(lng - 105.0, lat - 35.0)
        var dLng = transformLng(lng - 105.0, lat - 35.0)
        let radLat = lat / 180.0 * pi
        var magic = sin(radLat)
        magic = 1 - ee * magic * magic
        let sqrtMagic = sqrt(magic)
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * pi)
        dLng = (dLng * 180.0) / (a / sqrtMagic * cos(radLat) * pi)
        return (lat + dLat, lng + dLng)
    }

    private func transformLat(_ x: Double, _ y: Double) -> Double {
        var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * sqrt(abs(x))
        ret += (20.0 * sin(6.0 * x * Double.pi) + 20.0 * sin(2.0 * x * Double.pi)) * 2.0 / 3.0
        ret += (20.0 * sin(y * Double.pi) + 40.0 * sin(y / 3.0 * Double.pi)) * 2.0 / 3.0
        ret += (160.0 * sin(y / 12.0 * Double.pi) + 320 * sin(y * Double.pi / 30.0)) * 2.0 / 3.0
        return ret
    }

    private func transformLng(_ x: Double, _ y: Double) -> Double {
        var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * sqrt(abs(x))
        ret += (20.0 * sin(6.0 * x * Double.pi) + 20.0 * sin(2.0 * x * Double.pi)) * 2.0 / 3.0
        ret += (20.0 * sin(x * Double.pi) + 40.0 * sin(x / 3.0 * Double.pi)) * 2.0 / 3.0
        ret += (150.0 * sin(x / 12.0 * Double.pi) + 300.0 * sin(x / 30.0 * Double.pi)) * 2.0 / 3.0
        return ret
    }
}

// MARK: - OneShotLocationDelegate
private class OneShotLocationDelegate: NSObject, CLLocationManagerDelegate {
    private let completion: (CLLocation?, Error?) -> Void
    private let timeout: TimeInterval
    private let allowCached: Bool
    private var hasCompleted = false
    private var timer: Timer?
    weak var manager: CLLocationManager?

    init(timeout: TimeInterval, allowCached: Bool, completion: @escaping (CLLocation?, Error?) -> Void) {
        self.timeout = timeout
        self.allowCached = allowCached
        self.completion = completion
        super.init()
        timer = Timer.scheduledTimer(withTimeInterval: timeout, repeats: false) { [weak self] _ in
            self?.complete(location: nil, error: NSError(
                domain: kCLErrorDomain,
                code: CLError.locationUnknown.rawValue,
                userInfo: [NSLocalizedDescriptionKey: "Location request timed out"]
            ))
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        if allowCached || abs(location.timestamp.timeIntervalSinceNow) < 5 {
            complete(location: location, error: nil)
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        complete(location: nil, error: error)
    }

    private func complete(location: CLLocation?, error: Error?) {
        guard !hasCompleted else { return }
        hasCompleted = true
        timer?.invalidate()
        timer = nil
        self.manager?.delegate = nil
        completion(location, error)
    }
}

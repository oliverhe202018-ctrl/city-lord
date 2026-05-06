import Foundation
import Capacitor
import AMapLocationKit

@objc(AMapLocationPlugin)
public class AMapLocationPlugin: CAPPlugin, AMapLocationManagerDelegate {

    private var locationManager: AMapLocationManager?
    private var isWatching: Bool = false

    // MARK: - 初始化

    public override func load() {
        locationManager = AMapLocationManager()
        locationManager?.delegate = self          // Batch 1c 新增：设置 delegate
        locationManager?.distanceFilter = 5.0
        locationManager?.desiredAccuracy = kCLLocationAccuracyBest
    }

    // MARK: - 隐私合规（Batch 1a，保持不变）

    @objc func updatePrivacyShow(_ call: CAPPluginCall) {
        let isContainPrivacy = call.getBool("isContainPrivacy") ?? true
        let privacyInfo: AMapPrivacyInfoStatus = isContainPrivacy ? .is_contain : .is_not_contain
        AMapLocationManager.updatePrivacyShowStatus(.did_show, privacyInfo: privacyInfo)
        call.resolve()
    }

    @objc func updatePrivacyAgree(_ call: CAPPluginCall) {
        let hasAgree = call.getBool("hasAgree") ?? true
        let agreeStatus: AMapPrivacyAgreeStatus = hasAgree ? .did_agree : .not_agree
        AMapLocationManager.updatePrivacyAgreeStatus(agreeStatus)
        call.resolve()
    }

    // MARK: - 单次定位（Batch 1a，重构为调用共用辅助方法）

    @objc func getCurrentPosition(_ call: CAPPluginCall) {
        guard let manager = locationManager else {
            call.reject("AMapLocationManager not initialized")
            return
        }
        let enableReGeocode = call.getBool("enableReGeocode") ?? true
        manager.requestLocation(withReGeocode: enableReGeocode, timeoutInterval: 10) { [weak self] location, reGeocode, error in
            guard let self = self else { return }
            if let error = error {
                call.reject("Location error: \(error.localizedDescription)", nil, error)
                return
            }
            guard let location = location else {
                call.reject("No location data received")
                return
            }
            call.resolve(self.buildLocationResult(location: location, reGeocode: reGeocode))
        }
    }

    // MARK: - 持续定位（Batch 1c 新增）

    @objc func startWatch(_ call: CAPPluginCall) {
        guard let manager = locationManager else {
            call.reject("AMapLocationManager not initialized")
            return
        }
        // 已在监听则先停止，对齐 Android 创建新 Client 的行为
        if isWatching {
            manager.stopUpdatingLocation()
        }
        let enableReGeocode = call.getBool("enableReGeocode") ?? true
        manager.locatingWithReGeocode = enableReGeocode
        isWatching = true
        manager.startUpdatingLocation()

        let watchId = "amap-watch-\(Int64(Date().timeIntervalSince1970 * 1000))"
        call.resolve(["watchId": watchId])
    }

    @objc func stopWatch(_ call: CAPPluginCall) {
        stopWatchInternal()
        call.resolve()
    }

    private func stopWatchInternal() {
        isWatching = false
        locationManager?.stopUpdatingLocation()
    }

    @objc func forceDestroy(_ call: CAPPluginCall) {
        stopWatchInternal()
        // 对齐 Android forceDestroy：必须按顺序发送两个事件，让 Bridge 层完成 confirmHandler 清理
        notifyListeners("locationError", data: ["code": "FORCE_DESTROY"])
        notifyListeners("locationError", data: ["code": "FORCE_DESTROY_CONFIRMED"])
        call.resolve()
    }

    // MARK: - 跳转系统设置（Batch 1a，保持不变）

    @objc func openAppPermissionSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString),
                  UIApplication.shared.canOpenURL(url) else {
                call.resolve(["opened": false, "route": "system_settings", "component": ""])
                return
            }
            UIApplication.shared.open(url, options: [:]) { success in
                call.resolve([
                    "opened":    success,
                    "route":     "system_settings",
                    "component": "UIApplication.openSettingsURLString"
                ])
            }
        }
    }

    // MARK: - AMapLocationManagerDelegate（Batch 1c 新增）

    public func amapLocationManager(_ manager: AMapLocationManager!,
                                    didUpdate location: CLLocation!,
                                    reGeocode: AMapLocationReGeocode?) {
        guard isWatching else { return }
        notifyListeners("locationUpdate", data: buildLocationResult(location: location, reGeocode: reGeocode))
    }

    public func amapLocationManager(_ manager: AMapLocationManager!,
                                    didFailWithError error: Error!) {
        guard isWatching else { return }
        let nsError = error as NSError
        notifyListeners("locationError", data: [
            "code":    nsError.code,
            "message": error.localizedDescription
        ])
    }

    // MARK: - 共用辅助方法

    private func buildLocationResult(location: CLLocation!,
                                     reGeocode: AMapLocationReGeocode?) -> [String: Any] {
        var result: [String: Any] = [
            "latitude":  location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "accuracy":  location.horizontalAccuracy,
            "altitude":  location.altitude,
            "speed":     max(location.speed, 0),
            "bearing":   location.course >= 0 ? location.course : 0,
            "timestamp": Int64(location.timestamp.timeIntervalSince1970 * 1000)
        ]
        if let regeo = reGeocode {
            result["adCode"]       = regeo.adcode           ?? ""
            result["address"]      = regeo.formattedAddress ?? ""
            result["city"]         = regeo.city             ?? ""
            result["district"]     = regeo.district         ?? ""
            result["province"]     = regeo.province         ?? ""
            result["street"]       = regeo.street           ?? ""
            result["streetNumber"] = regeo.number           ?? ""
            result["country"]      = regeo.country          ?? ""
            result["aoiName"]      = regeo.aoiName          ?? ""
            result["poiName"]      = regeo.poiName          ?? ""
        }
        return result
    }

    // MARK: - Batch 1d（Android ForegroundService 的 iOS 等价方案，待独立设计）

    @objc func startTracking(_ call: CAPPluginCall) {
        call.reject("startTracking: Not implemented on iOS yet (Batch 1d - requires redesign)")
    }

    @objc func stopTracking(_ call: CAPPluginCall) {
        call.reject("stopTracking: Not implemented on iOS yet (Batch 1d - requires redesign)")
    }

    // MARK: - Android 专属方法（iOS 静默处理）

    @objc func updateNotificationSteps(_ call: CAPPluginCall) {
        call.resolve() // Android ForegroundService 通知步数，iOS 无此概念
    }

    @objc func getSessionMirror(_ call: CAPPluginCall) {
        call.reject("getSessionMirror: Not implemented on iOS (deferred)")
    }
}

import Foundation
import Capacitor
import AVFoundation

/**
 * AudioFocusPlugin — iOS 端音频焦点管理插件。
 *
 * 对应 Android 端 AudioFocusPlugin，用于跑步语音播报（如每公里配速）时
 * 临时压低其他后台应用音乐音量，播报结束后恢复。
 */
@objc(AudioFocusPlugin)
public class AudioFocusPlugin: CAPPlugin {

    private var isDuckingActive = false

    override public func load() {
        super.load()
        // 监听 TTS 结束事件，自动恢复音量
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAudioSessionInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /**
     * 请求音频焦点并压低其他后台音频。
     * 使用 .playback + .duckOthers 策略，TTS 可正常播放，背景音乐自动降低音量。
     */
    @objc func requestDucking(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(
                    .playback,
                    mode: .default,
                    options: [.duckOthers]
                )
                try session.setActive(true)
                self.isDuckingActive = true
                CAPLog.print("[AudioFocusPlugin] Ducking requested: playback + duckOthers")
                call.resolve()
            } catch {
                CAPLog.print("[AudioFocusPlugin] requestDucking failed: \(error.localizedDescription)")
                call.reject("requestDucking failed: \(error.localizedDescription)")
            }
        }
    }

    /**
     * 放弃音频焦点并恢复其他后台音频音量。
     * 在 TTS 播报结束后调用，确保后台音乐恢复原有音量。
     */
    @objc func abandonDucking(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setActive(
                    false,
                    options: .notifyOthersOnDeactivation
                )
                self.isDuckingActive = false
                CAPLog.print("[AudioFocusPlugin] Ducking abandoned")
                call.resolve()
            } catch {
                CAPLog.print("[AudioFocusPlugin] abandonDucking failed: \(error.localizedDescription)")
                call.reject("abandonDucking failed: \(error.localizedDescription)")
            }
        }
    }

    /**
     * 查询当前是否处于 Ducking 状态。
     */
    @objc func isDucking(_ call: CAPPluginCall) {
        call.resolve(["isDucking": isDuckingActive])
    }

    @objc private func handleAudioSessionInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }

        if type == .ended {
            // 中断结束后，如果仍持有 ducking 状态，尝试重新激活会话
            if isDuckingActive {
                do {
                    try AVAudioSession.sharedInstance().setActive(true)
                } catch {
                    CAPLog.print("[AudioFocusPlugin] Failed to reactivate session after interruption: \(error.localizedDescription)")
                }
            }
        }
    }
}

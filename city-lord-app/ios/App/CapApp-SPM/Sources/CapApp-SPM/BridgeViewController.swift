import UIKit
import Capacitor

/**
 * 自定义 Bridge View Controller，用于在 Capacitor 桥接加载完成后
 * 手动注册不在 npm 插件体系内的自定义原生插件 AMapLocationPlugin。
 */
public class BridgeViewController: CAPBridgeViewController {

    override public func capacitorDidLoad() {
        super.capacitorDidLoad()

        // 手动注册自定义定位插件
        bridge?.registerPluginType(AMapLocationPlugin.self)

        // 手动注册自定义音频焦点插件
        bridge?.registerPluginType(AudioFocusPlugin.self)
    }
}

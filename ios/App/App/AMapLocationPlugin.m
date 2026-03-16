#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AMapLocationPlugin, "AMapLocation",
    CAP_PLUGIN_METHOD(updatePrivacyShow,           CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updatePrivacyAgree,          CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getCurrentPosition,          CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startWatch,                  CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopWatch,                   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(forceDestroy,                CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startTracking,               CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopTracking,                CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateNotificationSteps,     CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(openAppPermissionSettings,   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getSessionMirror,            CAPPluginReturnPromise);
)

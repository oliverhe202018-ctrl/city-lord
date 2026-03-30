import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TermsOfServicePage() {
    const router = useRouter();
    return (
        <div className="h-[100dvh] overflow-y-auto w-full bg-[#0f172a] text-slate-200">
            <div className="sticky top-0 z-10 flex items-center h-14 px-4 bg-[#0f172a]/80 backdrop-blur-md border-b border-white/10">
                <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 active:bg-white/10 relative z-20">
                    <ChevronLeft className="h-5 w-5 text-white" />
                </button>
                <h1 className="ml-4 text-base font-semibold text-white">用户服务协议</h1>
            </div>

            <div className="max-w-md mx-auto p-6 pb-20 prose prose-invert prose-slate">
                <h2 className="text-xl font-bold mb-6 text-white text-center">City Lord 用服协议</h2>
                <p className="text-sm text-slate-400 mb-8 text-center border-b border-white/10 pb-4">
                    最后更新时间：2026年3月
                </p>

                <section className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-3">
                        1. 导言
                    </h3>
                    <p className="text-sm leading-relaxed">
                        欢迎您使用 City Lord（“本应用”或“我们”）。在注册或使用本应用各项服务前，请您务必审慎阅读并透彻理解本应用《用户协议》（以下简称“本协议”）的各项条款。当您勾选同意本协议，即表示您已充分阅读、理解并自愿接受本协议的全部内容。
                    </p>
                </section>

                <section className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-3">
                        2. 账号与安全
                    </h3>
                    <p className="text-sm leading-relaxed">
                        本应用账号的所有权归本应用所有，用户完成注册申请手续后，获得本应用账号的使用权。您有责任妥善保管您的登录设备及密码（如适用）。因您保管不善可能导致遭受盗号或密码失窃，责任由您自行承担。
                    </p>
                </section>

                <section className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-3">
                        3. 使用规范与作弊处理
                    </h3>
                    <p className="text-sm leading-relaxed">
                        City Lord 是一款倡导真实运动与出行的社交游戏。您承诺在游戏过程中：
                    </p>
                    <ul className="text-sm space-y-2 list-disc pl-5 mt-3">
                        <li>不使用任何形式的虚拟定位软件（GPS Spoofing）伪造移动轨迹。</li>
                        <li>不利用非人力的交通工具（如汽车、摩托车等，自行车模式除外）冒充步行业绩获取游戏收益。</li>
                        <li>不发表违反属地法律法规、违背公序良俗的语音或图文。</li>
                    </ul>
                    <p className="text-sm leading-relaxed mt-3 text-red-400/80">
                        针对以上不正当竞争与违规行为，一经系统排查确认，本应用保留在不事先通知的情况下，随时单方拦截收益、封停甚至永久注销违规账号的权利。
                    </p>
                </section>

                <section className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-3">
                        4. 免责声明与注意人身安全
                    </h3>
                    <p className="text-sm leading-relaxed font-semibold text-amber-500/90 bg-amber-500/10 p-4 rounded-lg border border-amber-500/20">
                        在进行户外探索与长距离跑步时，请务必时刻注意周遭环境与交通安全。请勿在危险地形、机动车道或视线受阻区域盯看屏幕。本应用作为记录与娱乐工具，不对您个人的任何现实意外风险负责。
                    </p>
                </section>

                <div className="mt-12 text-center">
                    <p className="text-xs text-slate-500">© 2026 City Lord. 保留所有权利。</p>
                </div>
            </div>
        </div>
    );
}

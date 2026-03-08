import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-[100dvh] bg-[#0f172a] text-slate-200">
            <div className="sticky top-0 z-10 flex items-center h-14 px-4 bg-[#0f172a]/80 backdrop-blur-md border-b border-white/10">
                <Link href="javascript:history.back()" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 active:bg-white/10">
                    <ChevronLeft className="h-5 w-5 text-white" />
                </Link>
                <h1 className="ml-4 text-base font-semibold text-white">隐私政策</h1>
            </div>

            <div className="max-w-md mx-auto p-6 pb-20 prose prose-invert prose-slate">
                <h2 className="text-xl font-bold mb-6 text-white text-center">City Lord 隐私政策</h2>
                <p className="text-sm text-slate-400 mb-8 text-center border-b border-white/10 pb-4">
                    最后更新时间：2026年3月
                </p>

                <section className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        1. 我们如何收集您的个人信息
                    </h3>
                    <p className="text-sm leading-relaxed mb-3">
                        为了向您提供位置签到、地块抢占与跑步轨迹记录服务，我们需要收集以下必要信息：
                    </p>
                    <ul className="text-sm space-y-2 list-disc pl-5">
                        <li><strong>位置信息（前台与后台）：</strong> 当您发起了跑步进程，我们会在后台持续收集您的精确位置轨迹。</li>
                        <li><strong>设备权限：</strong> 我们会请求麦克风权限以支持您在俱乐部或好友私聊中的语音功能。</li>
                        <li><strong>账户信息：</strong> 包含您的邮箱、手机号及基础个人主页数据。</li>
                    </ul>
                </section>

                <section className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-3">
                        2. 我们如何使用您的信息
                    </h3>
                    <p className="text-sm leading-relaxed mb-3">
                        上述信息仅用于游戏核心玩法的运算（配速、路线长度打卡、地块归属权计算）、同城排行榜展示，以及内部的服务优化。<strong>我们绝不会将您的位置数据用于商业广告或分享给任何营销侧第三方。</strong>
                    </p>
                </section>

                <section className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-3">
                        3. 您的权利（数据删除与注销）
                    </h3>
                    <p className="text-sm leading-relaxed">
                        您拥有访问、更正及删除个人数据的权利。您随时可以在“我的-设置”中发起账号注销流程。一旦您申请注销，我们将在系统后台排期清除有关您的所有追踪轨迹记录及个人特征数据，该过程通常在15个工作日内完成，且操作不可逆。
                    </p>
                </section>

                <section className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-3">
                        4. 联系我们
                    </h3>
                    <p className="text-sm leading-relaxed">
                        若您对本隐私政策或您的个人数据处理存在任何疑虑，请随时通过应用内的“问题反馈”入口或发送电子邮件至 privacy@citylord.app 与我们取得联系。我们将尽快为您解答。
                    </p>
                </section>

                <div className="mt-12 text-center">
                    <p className="text-xs text-slate-500">© 2026 City Lord. 保留所有权利。</p>
                </div>
            </div>
        </div>
    );
}

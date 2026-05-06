// Force /invite to be dynamic — it depends on query params and server actions
// that connect to Redis/Prisma at runtime, which cannot run during static generation.
export const dynamic = 'force-dynamic'

export default function InviteLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

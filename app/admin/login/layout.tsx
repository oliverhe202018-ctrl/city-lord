// This layout intentionally replaces the parent admin layout for the login route.
// The admin login page must NOT be wrapped by AdminGuard (which would redirect
// unauthenticated users back to this page, causing an infinite loop).
export default function AdminLoginLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}

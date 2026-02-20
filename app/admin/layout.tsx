import React from 'react'
import { headers } from 'next/headers'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Next.js App Router stacks layouts, so we still bypass the sidebar
  // for the /admin/login route so it renders fullscreen.
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? headersList.get('x-url') ?? ''
  const isLoginPath = pathname.includes('/admin/login')

  if (isLoginPath) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar - Fixed width */}
      <aside className="hidden w-64 flex-shrink-0 md:block">
        <AdminSidebar />
      </aside>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-muted/20 p-6 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

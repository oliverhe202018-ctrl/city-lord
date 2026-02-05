import React from 'react'
import { AdminGuard } from '@/components/admin/AdminGuard'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Sidebar - Fixed width */}
        <aside className="hidden w-64 flex-shrink-0 md:block">
          <AdminSidebar />
        </aside>

        {/* Mobile Sidebar Trigger could be added here later */}

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Header could go here */}
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto bg-muted/20 p-6 md:p-8">
            <div className="mx-auto max-w-6xl">
              {children}
            </div>
          </div>
        </main>
      </div>
    </AdminGuard>
  )
}

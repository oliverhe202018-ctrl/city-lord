import React from "react"
import { getAdminFeedbackData } from "@/app/actions/admin/get-feedback"
import { AdminFeedbackClient } from "./AdminFeedbackClient"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function AdminFeedbackPage() {
  const { data: items, error } = await getAdminFeedbackData()

  if (error === 'Unauthorized' || error === 'Forbidden') {
    redirect('/login')
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">用户反馈与举报管理</h1>
      </div>

      {/* 
        Pass items to the Client Component which retains the existing 
        tab filtering, search, and update status functionalities.
      */}
      <AdminFeedbackClient initialItems={items || []} />
    </div>
  )
}

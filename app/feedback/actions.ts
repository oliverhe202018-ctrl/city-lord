"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const FeedbackSchema = z.object({
  content: z.string().min(5, "问题描述至少需要5个字"),
  contact_info: z.string().min(1, "请填写联系方式"),
});

export async function submitFeedback(prevState: any, formData: FormData) {
  const content = formData.get("content") as string;
  const contact_info = formData.get("contact_info") as string;
  const file = formData.get("screenshot") as File | null;

  // 1. Validate
  const validatedFields = FeedbackSchema.safeParse({
    content,
    contact_info,
  });

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors,
      message: "请检查输入内容",
    };
  }

  const supabase = createClient();

  try {
    // Check Auth (Optional: allow anonymous if needed, but per requirement RLS allows auth insert)
    const { data: { user } } = await supabase.auth.getUser();
    
    // 2. Upload Image if exists
    let screenshot_url = null;
    if (file && file.size > 0) {
      // Validate file type/size if needed
      if (!file.type.startsWith("image/")) {
        return { message: "仅支持上传图片格式" };
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return { message: "图片大小不能超过 5MB" };
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user?.id || 'anon'}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("feedback-images")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return { message: "图片上传失败，请重试" };
      }

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from("feedback-images")
        .getPublicUrl(filePath);
      
      screenshot_url = publicUrl;
    }

    // 3. Insert into DB
    const { error: dbError } = await supabase
      .from("feedback")
      .insert({
        user_id: user?.id || null,
        content,
        contact_info,
        screenshot_url,
      });

    if (dbError) {
      console.error("DB Insert error:", dbError);
      return { message: "提交失败，请稍后重试" };
    }

  } catch (error) {
    console.error("Server action error:", error);
    return { message: "发生意外错误" };
  }

  // 4. Success & Redirect
  // We return success here and let the client handle the redirect to show a toast first?
  // Or we can just redirect. The requirement says "Toast提示“反馈成功”".
  // Server Actions + redirect usually clears the state.
  // We can return a success state and let the client component handle the toast + redirect.
  
  return { success: true, message: "反馈提交成功" };
}

import { toast } from "sonner";

export interface AppError {
    code: number;
    message: string;
}

export function handleAppError(error: any, fallbackMessage: string = "操作失败，请重试", contextOverrides?: Record<number, string>) {
    if (error?.code && typeof error.code === 'number') {
        const customMessage = contextOverrides?.[error.code];

        switch (error.code) {
            case 400:
                toast.error(customMessage || error.message || "请求参数错误");
                break;
            case 403:
                toast.error(customMessage || error.message || "没有权限执行此操作");
                break;
            case 404:
                toast.error(customMessage || error.message || "资源未找到");
                break;
            case 409:
                toast.error(customMessage || error.message || "存在冲突，可能是重复操作");
                break;
            case 429:
                toast.error(customMessage || error.message || "操作过于频繁，请稍后再试");
                break;
            case 500:
            default:
                toast.error(customMessage || error.message || fallbackMessage);
                break;
        }
    } else if (error instanceof Error) {
        toast.error(error.message || fallbackMessage);
    } else if (typeof error === 'string') {
        toast.error(error);
    } else {
        toast.error(fallbackMessage);
    }
}

export function handleAppSuccess(message: string, description?: string) {
    toast.success(message, { description });
}

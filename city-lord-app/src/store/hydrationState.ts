// 模块级变量，保证热重载和重渲染时状态不丢失
export let globalHydrated = false;

// 对外暴露重置函数，用于登出、切号、清空缓存等场景
export const resetGlobalHydration = () => {
  globalHydrated = false;
};

export const setGlobalHydrated = () => {
  globalHydrated = true;
};

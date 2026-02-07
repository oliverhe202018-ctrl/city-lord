export const createClient = () => ({
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
  },
  from: (table: string) => ({
    select: (columns?: string) => ({
      eq: (column: string, value: any) => ({
        single: async () => ({ data: null, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        order: (col: string, opts?: any) => ({ limit: async (n: number) => ({ data: [], error: null }) }),
        in: () => ({ data: [], error: null }),
        is: () => ({ data: [], error: null }),
      }),
      order: (col: string, opts?: any) => ({ limit: async (n: number) => ({ data: [], error: null }) }),
      limit: async (n: number) => ({ data: [], error: null }),
      single: async () => ({ data: null, error: null }),
      in: () => ({ data: [], error: null }),
      is: () => ({ data: [], error: null }),
    }),
    insert: async (data: any) => ({ data: null, error: null, select: () => ({ single: async () => ({ data: null, error: null }) }) }),
    update: (data: any) => ({ eq: async (col: string, val: any) => ({ data: null, error: null }) }),
    delete: () => ({ eq: async (col: string, val: any) => ({ data: null, error: null }) }),
    upsert: async (data: any) => ({ data: null, error: null, select: () => ({ single: async () => ({ data: null, error: null }) }) })
  }),
  rpc: async (func: string, args?: any) => ({ data: null, error: null })
});

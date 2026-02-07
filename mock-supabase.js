export const createClient = () => ({
  auth: { 
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null })
  },
  from: () => ({ 
    select: () => ({ 
      eq: () => ({ 
        single: async () => ({ data: null, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        order: () => ({ limit: async () => ({ data: [], error: null }) })
      }),
      order: () => ({ limit: async () => ({ data: [], error: null }) }),
      limit: async () => ({ data: [], error: null }),
      single: async () => ({ data: null, error: null })
    }),
    insert: async () => ({ data: null, error: null }),
    update: () => ({ eq: async () => ({ data: null, error: null }) }),
    delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    upsert: async () => ({ data: null, error: null })
  }),
  rpc: async () => ({ data: null, error: null })
});

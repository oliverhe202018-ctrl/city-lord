export const cookies = async () => ({
  get: (name: string) => ({ value: '' }),
  getAll: () => [],
  set: () => {},
  delete: () => {},
  has: () => false,
});

export const headers = () => ({
  get: () => '',
  entries: () => [],
  forEach: () => {}
});

// 简单判断是否为纯粹的对象
export function isObject(o: any): boolean {
  return o === Object(o) && !Array.isArray(o) && typeof o !== 'function';
}

// 蛇形转驼峰 (snake_case -> camelCase)
export function toCamel(s: string): string {
  return s.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '');
  });
}

// 驼峰转蛇形 (camelCase -> snake_case)
export function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// 递归：对象/数组的所有 Key 转为驼峰 (用于处理 Backend -> Frontend)
export function keysToCamel(o: any): any {
  if (isObject(o)) {
    const n: { [key: string]: any } = {};
    Object.keys(o).forEach((k) => {
      n[toCamel(k)] = keysToCamel(o[k]);
    });
    return n;
  } else if (Array.isArray(o)) {
    return o.map((i) => keysToCamel(i));
  }
  return o;
}

// 递归：对象/数组的所有 Key 转为蛇形 (用于处理 Frontend -> Backend)
export function keysToSnake(o: any): any {
  if (isObject(o)) {
    const n: { [key: string]: any } = {};
    Object.keys(o).forEach((k) => {
      n[toSnake(k)] = keysToSnake(o[k]);
    });
    return n;
  } else if (Array.isArray(o)) {
    return o.map((i) => keysToSnake(i));
  }
  return o;
}

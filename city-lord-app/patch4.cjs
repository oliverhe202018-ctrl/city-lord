
const fs = require("fs");
const file = "src/api/client.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  "if (error.response && error.response.status === 401) {",
  "if (error.response && error.response.status === 401) {\n      if (error.config && error.config.skipAuthEvent) {\n        const err: any = new Error(\"UNAUTHORIZED\");\n        err.isAuthError = true;\n        return Promise.reject(err);\n      }"
);

content = content.replace(
  `export async function rpcCall<T = any>(module: string, action: string, args: any[] = []): Promise<T> {
  const response = await apiClient.post(\`/api/v1/rpc\`, {
    module,
    action,
    args
  });`,
  `export async function rpcCall<T = any>(module: string, action: string, args: any[] = []): Promise<T> {
  const options: any = {};
  if (module === "run-service" && action === "saveRunActivity") {
    options.skipAuthEvent = true;
  }
  const response = await apiClient.post(\`/api/v1/rpc\`, {
    module,
    action,
    args
  }, options);`
);

fs.writeFileSync(file, content);
console.log("Patched successfully");


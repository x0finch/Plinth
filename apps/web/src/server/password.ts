/**
 * 密码在服务端只做“随机盐 + SHA-256”。
 * 慢哈希（PBKDF2-SHA256 60 万轮，OWASP 推荐值）在用户设备上做，见 lib/password.ts：
 * 免费版 Worker 每个请求只有 10 ms CPU，跑不动慢哈希；原始密码也因此从不离开设备。
 * 数据库泄露后，攻击者每猜一次仍要跑完整的 60 万轮。
 */
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], h => parseInt(h, 16));

async function digest(salt: Uint8Array, input: string) {
  const data = new Uint8Array([...salt, ...new TextEncoder().encode(input)]);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

/** 存成 s256$盐$摘要 */
export async function hashPassword(input: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `s256$${hex(salt)}$${hex(await digest(salt, input))}`;
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
  const [kind, salt, want] = hash.split('$');
  if (kind !== 's256' || !salt || !want) return false;
  const got = await digest(unhex(salt), password);
  const expect = unhex(want);
  if (got.length !== expect.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expect[i];
  return diff === 0;
}

/** 客户端派生结果：32 字节，64 位十六进制 */
export const DERIVED_LENGTH = 64;

/**
 * 密码在设备上做慢哈希：PBKDF2-SHA256 60 万轮（OWASP 推荐值），盐是“plinth:”+邮箱。
 * 发给服务器的是派生结果，原始密码从不离开设备；服务器再加随机盐做一次 SHA-256 存起来（见 server/password.ts）。
 */
export const MIN_PASSWORD = 8;
const ITERATIONS = 600_000;

export async function derivePassword(email: string, password: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`plinth:${email.trim().toLowerCase()}`), iterations: ITERATIONS },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join('');
}

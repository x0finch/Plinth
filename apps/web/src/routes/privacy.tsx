import { createFileRoute } from '@tanstack/react-router';
import { ProsePage } from '@/components/site/Prose';

export const Route = createFileRoute('/privacy')({ component: () => (
  <ProsePage title="隐私政策" updated="2026 年 10 月">
    <p>Plinth 只收集提供服务所需的信息。这里说明我们收集什么、怎么用、你能做什么。</p>
    <h2>我们保存的数据</h2>
    <ul>
      <li>账号：邮箱（邮箱登录）或 Google 账号的姓名、邮箱、头像（Google 登录）。访客试用时只生成一个匿名账号。</li>
      <li>方案：你创建的方案数据和每一个历史版本、评论、和 agent 的对话记录。</li>
      <li>模型密钥：你添加的大模型 API Key，用 AES-GCM 加密后保存，只在服务器转发请求时解密，从不返回浏览器。</li>
      <li>用量：每次调用大模型的 token 数，按人、按方案记录，方便方案主人查看。</li>
      <li>运行日志：IP 地址用于限流防滥用，错误日志用于排查问题，不用于其他目的。</li>
    </ul>
    <h2>数据流向</h2>
    <ul>
      <li>和 agent 对话时，对话内容和方案的摘要会发给你选择的大模型厂商（如 Anthropic、OpenAI、Google、OpenRouter），按其隐私政策处理。</li>
      <li>服务部署在 Cloudflare；验证码邮件通过邮件服务商发送。</li>
      <li>我们不出售你的数据，也不用于广告。</li>
    </ul>
    <h2>你的权利</h2>
    <ul>
      <li>在“设置 → 账号”可以导出你的全部数据（JSON），或删除账号及名下所有方案。</li>
      <li>方案主人可以随时收回分享链接、移除成员、删除模型密钥。</li>
    </ul>
  </ProsePage>
) });

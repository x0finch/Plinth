import { createFileRoute } from '@tanstack/react-router';
import { ProsePage } from '@/components/site/Prose';

export const Route = createFileRoute('/terms')({ component: () => (
  <ProsePage title="使用条款" updated="2026 年 10 月">
    <p>使用 Plinth 即表示你同意以下条款。</p>
    <h2>方案仅供参考</h2>
    <p>Plinth 和其中的 agent 生成的方案、面积、分析结果用于沟通和推敲，不构成设计图纸或施工依据。涉及结构、消防、日照间距、规划审批等内容，必须由有资质的专业人员复核。agent 会对这类内容标注“需专业人员复核”，但不保证覆盖全部情况。</p>
    <h2>你的内容</h2>
    <p>方案和评论归你所有。你授权我们为提供服务而存储、处理、展示这些内容（包括发送给你选择的大模型厂商）。分享链接的访问范围由你控制。</p>
    <h2>大模型与费用</h2>
    <p>agent 使用你自己添加的大模型密钥，调用费用由你和模型厂商结算。分享给可编辑成员后，他们与 agent 的对话也会使用该方案配置的密钥，你可以随时更换或收回。</p>
    <h2>合理使用</h2>
    <p>不得用于违法用途、攻击服务或绕过限流。我们可能暂停滥用的账号。</p>
    <h2>服务变更</h2>
    <p>服务可能更新或调整。重大变更会提前在网站上说明；你可以随时导出数据。</p>
  </ProsePage>
) });

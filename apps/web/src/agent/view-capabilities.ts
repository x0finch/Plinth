/**
 * 只在浏览器里运行的视图能力：切换视图、定位高亮、截图。
 * 视图状态也是数据：相机、楼层、选中、高亮都能读写。服务端只用它们的定义生成工具说明。
 */
import { defineRead, type CapabilityContext } from '@plinth/core';
import { z } from 'zod';

export interface ViewState {
  mode: '2d' | '3d';
  level: string;
  selection: string[];
  highlight: string[];
  camera?: { position: [number, number, number]; target: [number, number, number] } | null;
  layers: { furniture: boolean; dimensions: boolean; labels: boolean };
}

/** 画布实现这个接口，注入到 CapabilityContext.host.view */
export interface ViewHost {
  get(): ViewState;
  set(patch: Partial<ViewState>): ViewState;
  focus(ids: string[], highlight: boolean): ViewState;
  screenshot(): Promise<{ dataUrl: string; width: number; height: number }>;
}

const host = (ctx: CapabilityContext) => {
  const v = ctx.host?.view as ViewHost | undefined;
  if (!v) throw new Error('这项能力需要在浏览器里打开方案才能用');
  return v;
};

export const viewGet = defineRead({
  name: 'view_get', title: '读取视图', kind: 'view', permission: 'read', runtime: 'browser',
  description: '读取当前视图：平面还是三维、当前楼层、选中和高亮的对象、相机、图层开关。用户说“这面墙”“这里”时，先读选中的对象。',
  input: z.object({}),
  run: (_, ctx) => {
    const s = host(ctx).get();
    const p = ctx.session.project;
    const name = (id: string) => p.walls.find(w => w.id === id)?.name ?? p.spaces.find(x => x.id === id)?.name ?? p.furniture.find(f => f.id === id)?.name
      ?? p.walls.flatMap(w => w.openings).find(o => o.id === id)?.name ?? id;
    return { ...s, selection: s.selection.map(id => ({ id, name: name(id) })) };
  },
});

export const viewSet = defineRead({
  name: 'view_set', title: '切换视图', kind: 'view', permission: 'read', runtime: 'browser',
  description: '切换平面 / 三维、楼层，开关家具、尺寸、标注图层。',
  input: z.object({
    mode: z.enum(['2d', '3d']).optional(), level: z.string().optional().describe('楼层 ID 或名称'),
    layers: z.object({ furniture: z.boolean().optional(), dimensions: z.boolean().optional(), labels: z.boolean().optional() }).optional(),
  }),
  run: (i, ctx) => {
    const v = host(ctx);
    const lv = i.level ? ctx.session.project.levels.find(l => l.id === i.level || l.name === i.level)?.id : undefined;
    return v.set({ ...(i.mode ? { mode: i.mode } : {}), ...(lv ? { level: lv } : {}), ...(i.layers ? { layers: { ...v.get().layers, ...i.layers } as ViewState['layers'] } : {}) });
  },
});

export const viewFocus = defineRead({
  name: 'view_focus', title: '定位高亮', kind: 'view', permission: 'read', runtime: 'browser',
  description: '把镜头转到这些对象并高亮（自动切到它们所在楼层）。改完之后用它把改动处指给业主看。',
  input: z.object({ ids: z.array(z.string()).min(1).describe('对象 ID'), highlight: z.boolean().default(true) }),
  run: (i, ctx) => host(ctx).focus(i.ids, i.highlight),
});

export const viewScreenshot = defineRead({
  name: 'view_screenshot', title: '截图', kind: 'verify', permission: 'read', runtime: 'browser',
  description: '截取当前视图给业主看（图片显示在对话里）。',
  input: z.object({}),
  run: async (_, ctx) => {
    const s = await host(ctx).screenshot();
    return { shown: true, width: s.width, height: s.height, image: s.dataUrl };
  },
});

export const VIEW_CAPABILITIES = [viewGet, viewSet, viewFocus, viewScreenshot];

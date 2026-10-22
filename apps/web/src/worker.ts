/** Worker 入口：页面由静态资源层返回（SPA），只有 /api/* 进来。 */
import { api } from './server/api';

export default { fetch: api.fetch } satisfies ExportedHandler<Env>;

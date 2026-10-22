/** Worker entry: pages are served by the static assets layer (SPA); only /api/* reaches here. */
import { api } from './server/api';

export default { fetch: api.fetch } satisfies ExportedHandler<Env>;

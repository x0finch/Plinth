import handler, { createServerEntry } from '@tanstack/react-start/server-entry';
import { api } from './server/api';

export default createServerEntry({
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api.fetch(request);
    return handler.fetch(request);
  },
});

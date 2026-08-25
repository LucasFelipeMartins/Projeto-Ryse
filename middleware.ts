import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, menos:
     *  - assets do Next (_next/static, _next/image)
     *  - arquivos da raiz do PWA (manifest, service worker, ícones, robots)
     *  - qualquer arquivo com extensão de imagem/fonte
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|robots.txt|icons/|.*\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf)$).*)',
  ],
};

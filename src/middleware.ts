import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Contoh: log setiap request
  console.log('Middleware triggered:', request.method, request.url);

  // Contoh: blokir request jika ada header tertentu
  // if (request.headers.get('x-block') === 'true') {
  //   return NextResponse.json({ success: false, error: 'Blocked by middleware' }, { status: 403 });
  // }

  // Lanjutkan ke route handler
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/extensi/:path*'], // Middleware hanya untuk endpoint ini
};

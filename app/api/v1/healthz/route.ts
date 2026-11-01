import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'aayojan-engine',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-ID': `hlz_${Date.now().toString(36)}`,
      },
    }
  );
}

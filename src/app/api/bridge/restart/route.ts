import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BRIDGE_URL = process.env.VM_BRIDGE_URL || 'http://34.30.92.41:3000';
const BRIDGE_SECRET = process.env.VM_BRIDGE_SECRET || 'tcds-bridge-restart-2024';

export async function POST() {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized',
      }, { status: 401 });
    }

    // Call bridge restart endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${BRIDGE_URL}/admin/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Secret': BRIDGE_SECRET,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({
        success: false,
        message: `Restart failed: ${text}`,
      }, { status: response.status });
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: result.message || 'Bridge restart initiated',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      message: `Restart failed: ${message}`,
    }, { status: 500 });
  }
}

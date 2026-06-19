import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // [P5 Fix] JWT 验签
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { adcode, cityName, centerLng, centerLat } = body;

    if (!adcode) {
      return NextResponse.json({ error: 'adcode is required' }, { status: 400 });
    }

    // 城市名归一化
    const normalizedCityName = cityName
      ? cityName.replace(/市$/, '').replace(/省$/, '').trim()
      : '';

    // 1. 查询 cities 表是否有匹配的 adcode 或者归一化后的城市名
    let existingCity = await prisma.cities.findFirst({
      where: {
        OR: [
          { adcode: adcode },
          { name: normalizedCityName }
        ]
      }
    });

    if (existingCity) {
      // 如果存在，且 adcode 不匹配，更新一下 adcode 保证一致性
      if (!existingCity.adcode) {
        existingCity = await prisma.cities.update({
          where: { id: existingCity.id },
          data: { adcode }
        });
      }
      return NextResponse.json({
        success: true,
        data: {
          ...existingCity,
          radius_km: existingCity.radius_km ? Number(existingCity.radius_km) : null,
          created_at: existingCity.created_at ? existingCity.created_at.toISOString() : null,
          updated_at: existingCity.updated_at ? existingCity.updated_at.toISOString() : null,
        }
      });
    }

    // 2. 如果不存在，现场 INSERT 一条新记录
    const newCity = await prisma.cities.create({
      data: {
        name: normalizedCityName || cityName,
        adcode: adcode,
        pinyin: normalizedCityName || cityName,
        center_lng: centerLng ?? null,
        center_lat: centerLat ?? null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        ...newCity,
        radius_km: newCity.radius_km ? Number(newCity.radius_km) : null,
        created_at: newCity.created_at ? newCity.created_at.toISOString() : null,
        updated_at: newCity.updated_at ? newCity.updated_at.toISOString() : null,
      }
    });
  } catch (error: any) {
    console.error('[POST /api/v1/city/register] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register city' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // [P5 Fix] JWT 验签
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get('cityId');

    if (!cityId) {
      return NextResponse.json({ error: 'cityId required' }, { status: 400 });
    }

    const city = await prisma.cities.findUnique({
      where: { id: cityId }
    });

    if (!city) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...city,
        radius_km: city.radius_km ? Number(city.radius_km) : null,
        created_at: city.created_at ? city.created_at.toISOString() : null,
        updated_at: city.updated_at ? city.updated_at.toISOString() : null,
      }
    });
  } catch (error: any) {
    console.error('[GET /api/v1/city/register] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch city' },
      { status: 500 }
    );
  }
}

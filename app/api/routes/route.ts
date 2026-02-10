import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const routes = await prisma.route_plans.findMany({
      where: {
        user_id: user.id
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json(routes);
  } catch (error: any) {
    console.error('Error fetching routes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, points, distance, capture_area } = body;

    const newRoute = await prisma.route_plans.create({
      data: {
        user_id: user.id,
        name,
        waypoints: points, // Mapping 'points' from frontend to 'waypoints' in DB
        distance,
        capture_area: capture_area || 0,
        geometry: points // Storing points as geometry too for now
      }
    });

    return NextResponse.json(newRoute);
  } catch (error: any) {
    console.error('Error creating route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, points, distance, capture_area } = body;

    if (!id) {
      return NextResponse.json({ error: 'Route ID is required' }, { status: 400 });
    }

    // Verify ownership
    const existingRoute = await prisma.route_plans.findUnique({
      where: { id }
    });

    if (!existingRoute || existingRoute.user_id !== user.id) {
        return NextResponse.json({ error: 'Route not found or unauthorized' }, { status: 404 });
    }

    const updatedRoute = await prisma.route_plans.update({
      where: { id },
      data: {
        name,
        waypoints: points,
        distance,
        capture_area: capture_area || 0,
        geometry: points
      }
    });

    return NextResponse.json(updatedRoute);
  } catch (error: any) {
    console.error('Error updating route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Route ID is required' }, { status: 400 });
    }

     // Verify ownership
    const existingRoute = await prisma.route_plans.findUnique({
      where: { id }
    });

    if (!existingRoute || existingRoute.user_id !== user.id) {
        return NextResponse.json({ error: 'Route not found or unauthorized' }, { status: 404 });
    }

    await prisma.route_plans.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

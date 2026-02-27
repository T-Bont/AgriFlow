// Supabase Edge Function: dashboard_snapshot
// Creates or updates a static dashboard snapshot image for the authenticated user.
// - Calls Mapbox Static Images API with a bounding box.
// - Uploads the image to a Supabase Storage bucket.
// - Merges snapshot metadata into profiles.settings.dashboard_snapshot and optional dashboard_camera.
//
// Expected request (JSON body, POST):
// {
//   "bbox": { "west": -101.1, "south": 38.1, "east": -100.9, "north": 38.3 },
//   "width": 800,
//   "height": 600,
//   "scale": 2,
//   "camera": { "center": [-101.0, 38.2], "zoom": 12, "bearing": 0, "pitch": 0 }
// }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Bbox = {
  west: number
  south: number
  east: number
  north: number
}

interface SnapshotRequestBody {
  bbox?: Bbox
  width?: number
  height?: number
  scale?: number
  camera?: {
    center: [number, number]
    zoom: number
    bearing: number
    pitch: number
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const mapboxToken = Deno.env.get('MAPBOX_SECRET_TOKEN') ?? Deno.env.get('MAPBOX_TOKEN')
  const storageBucket = Deno.env.get('DASHBOARD_SNAPSHOT_BUCKET') ?? 'dashboard_snapshots'

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!mapboxToken) {
    return new Response(JSON.stringify({ error: 'Missing MAPBOX_SECRET_TOKEN (or MAPBOX_TOKEN) env var' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: SnapshotRequestBody
  try {
    body = (await req.json()) as SnapshotRequestBody
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!body.bbox) {
    return new Response(JSON.stringify({ error: 'Missing bbox in request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { bbox } = body
  const width = Math.max(100, Math.min(body.width ?? 800, 1280))
  const height = Math.max(100, Math.min(body.height ?? 600, 1280))
  const scale = body.scale ?? 2

  // Create a Supabase client that uses the caller's auth context.
  const authHeader = req.headers.get('Authorization')
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader ?? '',
      },
    },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch existing profile to merge settings.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, settings')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Build Mapbox Static Images API URL with bbox.
  const bboxParam = `[${bbox.west},${bbox.south},${bbox.east},${bbox.north}]`
  const styleId = 'mapbox/satellite-streets-v12'
  const imageUrl = new URL(
    `https://api.mapbox.com/styles/v1/${styleId}/static/${bboxParam}/${width}x${height}@${scale}x`,
  )
  imageUrl.searchParams.set('access_token', mapboxToken)

  const mapboxResponse = await fetch(imageUrl.toString())
  if (!mapboxResponse.ok) {
    const errorText = await mapboxResponse.text().catch(() => '')
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch static image from Mapbox',
        status: mapboxResponse.status,
        body: errorText,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  const arrayBuffer = await mapboxResponse.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const now = new Date().toISOString()
  const filePath = `${user.id}/dashboard-${now}.png`

  const { error: uploadError } = await supabase.storage
    .from(storageBucket)
    .upload(filePath, bytes, {
      contentType: 'image/png',
      upsert: true,
    })

  if (uploadError) {
    return new Response(JSON.stringify({ error: 'Failed to upload snapshot image', details: uploadError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: publicUrlData } = supabase.storage.from(storageBucket).getPublicUrl(filePath)
  const publicUrl = publicUrlData.publicUrl

  const existingSettings = (profile.settings ?? {}) as Record<string, unknown>

  const dashboardSnapshot = {
    bbox,
    image_url: publicUrl,
    width,
    height,
    scale,
    created_at: now,
  }

  const nextSettings = {
    ...existingSettings,
    dashboard_snapshot: dashboardSnapshot,
    ...(body.camera
      ? {
          dashboard_camera: body.camera,
        }
      : {}),
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update({
      settings: nextSettings,
      updated_at: now,
    })
    .eq('id', user.id)
    .select('id, settings')
    .single()

  if (updateError || !updatedProfile) {
    return new Response(JSON.stringify({ error: 'Failed to update profile', details: updateError?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({
      snapshot: dashboardSnapshot,
      settings: updatedProfile.settings,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})


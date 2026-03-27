import { fal } from '@fal-ai/client';

fal.config({ credentials: process.env.FAL_API_KEY });

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl || typeof imageUrl !== 'string') {
      return Response.json({ error: 'imageUrl is required' }, { status: 400 });
    }
    if (!process.env.FAL_API_KEY) {
      return Response.json({ error: 'FAL_API_KEY not configured on server' }, { status: 500 });
    }

    // Step 1: Download the image from Supabase on the server
    // (Fal's servers may not be able to reach your Supabase URL directly)
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return Response.json(
        { error: `Could not fetch image: ${imgRes.status} ${imgRes.statusText}` },
        { status: 400 }
      );
    }
    const imgBlob = await imgRes.blob();
    const imgFile = new File([imgBlob], 'floor-plan.png', { type: imgBlob.type || 'image/png' });

    // Step 2: Upload image to Fal's own storage so the model can access it
    const uploadedUrl = await fal.storage.upload(imgFile);

    // Step 3: Run the 3D generation model
    const result = await fal.subscribe('fal-ai/triposr', {
      input: {
        image_url: uploadedUrl,
        do_remove_background: true,
        foreground_ratio: 0.85,
        mc_resolution: 256,
      },
      logs: false,
    });

    return Response.json({ success: true, data: result.data });
  } catch (err) {
    // Return the full error message so we can debug
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate-3d]', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}

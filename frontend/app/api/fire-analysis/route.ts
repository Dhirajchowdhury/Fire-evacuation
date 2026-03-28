import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
      return NextResponse.json({ error: 'Groq API key not configured in .env.local' }, { status: 401 });
    }

    const prompt = `Analyze this image for fire and smoke.

Return STRICT JSON:

{
  "fire_detected": true/false,
  "smoke_detected": true/false,
  "severity": "low" | "medium" | "high" | "none",
  "description": "short explanation"
}

Consider:
- Flame size
- Smoke density
- Spread intensity
- Visibility obstruction

Be accurate and concise.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image } }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API Error:', errorText);
      return NextResponse.json({ error: 'Failed to analyze image with Groq API' }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json({ error: 'Empty response from Groq API' }, { status: 500 });
    }

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);

  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

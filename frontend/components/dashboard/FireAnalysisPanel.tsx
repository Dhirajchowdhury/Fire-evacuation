'use client';

import { useState, useRef } from 'react';

interface AnalysisResult {
  fire_detected: boolean;
  smoke_detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'none';
  description: string;
}

export default function FireAnalysisPanel() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }

    setImageFile(file);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      setError(null);
      setResult(null);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setError('Please drop a valid image file.');
    }
  };

  const analyzeImage = async () => {
    if (!imagePreview) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/fire-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagePreview })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }
      
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span>🔥</span> AI Fire Analysis
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          {!imagePreview ? (
            <div 
              className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-slate-500 transition-colors cursor-pointer bg-slate-800/50"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="text-4xl mb-3">📸</div>
              <p className="text-slate-300 font-medium">Click or drag image here</p>
              <p className="text-slate-500 text-sm mt-1">Supports JPG, PNG, WEBP</p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video flex items-center justify-center">
              <img src={imagePreview} alt="Preview" className="max-w-full max-h-full object-contain" />
              <button 
                onClick={clearImage}
                className="absolute top-2 right-2 bg-black/60 hover:bg-red-500/80 text-white rounded-full w-8 h-8 flex items-center justify-center backdrop-blur-sm transition-colors"
                disabled={isAnalyzing}
              >
                ✕
              </button>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />

          {error && (
            <div className="bg-red-950/50 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm">
              ⚠ {error}
            </div>
          )}

          <button
            onClick={analyzeImage}
            disabled={!imagePreview || isAnalyzing}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
              ${!imagePreview || isAnalyzing 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]'
              }`}
          >
            {isAnalyzing ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                Analyzing image...
              </>
            ) : (
              <>
                <span>⚡</span> Analyze with Groq Vision
              </>
            )}
          </button>
        </div>

        <div>
          {result ? (
            <div className="bg-black/40 border border-slate-800 rounded-xl p-6 h-full flex flex-col">
              <h3 className="text-lg font-semibold text-white mb-4">Analysis Result</h3>
              
              <div className="space-y-4 flex-1">
                <div className="flex gap-3">
                  {result.fire_detected && (
                    <div className="bg-red-950/80 border border-red-800 text-red-400 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5">
                      <span className="animate-pulse">🔥</span> Fire Detected
                    </div>
                  )}
                  {result.smoke_detected && (
                    <div className="bg-slate-800 border border-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5">
                      <span>🌫️</span> Smoke Detected
                    </div>
                  )}
                  {!result.fire_detected && !result.smoke_detected && (
                    <div className="bg-green-950/80 border border-green-800 text-green-400 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5">
                      <span>✅</span> Custom Clear
                    </div>
                  )}
                </div>

                {(result.fire_detected || result.smoke_detected) && (
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1.5">Severity Level</p>
                    <div className={`px-4 py-2 rounded-lg font-bold border inline-block
                      ${result.severity === 'high' ? 'bg-red-950 border-red-500 text-red-400' :
                        result.severity === 'medium' ? 'bg-orange-950 border-orange-500 text-orange-400' :
                        'bg-yellow-950 border-yellow-500 text-yellow-400'}`}
                    >
                      {result.severity.toUpperCase()}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-1.5">Description</p>
                  <p className="text-slate-200 text-sm leading-relaxed">{result.description}</p>
                </div>

                {(result.fire_detected || result.smoke_detected) && (
                  <div className="mt-auto pt-4 border-t border-slate-800">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-1.5">Suggested Action</p>
                    {result.severity === 'high' ? (
                      <p className="text-red-400 font-bold bg-red-950/30 px-3 py-2 rounded border border-red-900/50">
                        🚨 EVACUATE IMMEDIATELY
                      </p>
                    ) : (
                      <p className="text-orange-400 font-bold bg-orange-950/30 px-3 py-2 rounded border border-orange-900/50">
                        ⚠️ MONITOR SITUATION CLOSELY
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-black/20 border border-slate-800/50 rounded-xl p-6 h-full flex items-center justify-center text-center">
              <div>
                <div className="text-4xl text-slate-700 mb-3">🤖</div>
                <p className="text-slate-500 font-medium">Upload an image and analyze to see AI results here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

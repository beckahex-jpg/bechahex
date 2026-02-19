import { useState } from 'react';
import { Sparkles, Loader2, Check, Edit2, Gift, DollarSign, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AnalysisResult {
  productName: string;
  description: string;
  category: string;
  priceSuggestions: {
    symbolic: number;
    fair: number;
    market: number;
  };
  charityMessage: string;
  confidence: number;
}

interface SmartProductAnalyzerProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  onApplySuggestion: (data: any) => void;
}

export default function SmartProductAnalyzer({ onAnalysisComplete, onApplySuggestion }: SmartProductAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedPrice, setSelectedPrice] = useState<'symbolic' | 'fair' | 'market'>('symbolic');

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeProduct = async () => {
    if (!description) {
      alert('Please enter a product description');
      return;
    }

    setAnalyzing(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-product`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: description,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const data: AnalysisResult = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      onAnalysisComplete(data);
    } catch (error: any) {
      console.error('Error analyzing product:', error);
      alert(`Analysis error: ${error.message || 'Please try again'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const applyAnalysis = () => {
    if (!result) return;

    const priceValue = result.priceSuggestions[selectedPrice];
    const submissionType =
      selectedPrice === 'symbolic' ? 'donation' :
      selectedPrice === 'fair' ? 'symbolic_sale' :
      'public_sale';

    onApplySuggestion({
      title: result.productName,
      description: result.description,
      category: result.category,
      price: priceValue.toString(),
      submission_type: submissionType,
      images: selectedImage ? [selectedImage] : []
    });

    setResult(null);
    setDescription('');
    setSelectedImage(null);
    setImagePreview('');
  };

  if (result) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border-2 border-blue-200 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-600 p-3 rounded-xl">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Smart Product Analysis</h3>
            <p className="text-sm text-gray-600">Analysis completed successfully!</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Suggested Product Name</label>
            <p className="text-lg font-bold text-gray-900">{result.productName}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Professional Description</label>
            <p className="text-gray-700 leading-relaxed">{result.description}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Suggested Category</label>
            <p className="text-gray-900 font-medium">{result.category}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="text-sm font-semibold text-gray-700 block mb-3">Choose the right price</label>
            <div className="space-y-3">
              <button
                onClick={() => setSelectedPrice('symbolic')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                  selectedPrice === 'symbolic'
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Gift className={`w-5 h-5 ${selectedPrice === 'symbolic' ? 'text-green-600' : 'text-gray-400'}`} />
                    <div>
                      <p className="font-bold text-gray-900">Charitable Donation</p>
                      <p className="text-sm text-gray-600">Symbolic price for charity platform</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-600">${result.priceSuggestions.symbolic}</p>
                </div>
              </button>

              <button
                onClick={() => setSelectedPrice('fair')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                  selectedPrice === 'fair'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className={`w-5 h-5 ${selectedPrice === 'fair' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div>
                      <p className="font-bold text-gray-900">Fair Price</p>
                      <p className="text-sm text-gray-600">Fair price for seller and buyer</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">${result.priceSuggestions.fair}</p>
                </div>
              </button>

              <button
                onClick={() => setSelectedPrice('market')}
                className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                  selectedPrice === 'market'
                    ? 'border-purple-500 bg-purple-50 shadow-md'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className={`w-5 h-5 ${selectedPrice === 'market' ? 'text-purple-600' : 'text-gray-400'}`} />
                    <div>
                      <p className="font-bold text-gray-900">Market Price</p>
                      <p className="text-sm text-gray-600">Best market price</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">${result.priceSuggestions.market}</p>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
            <p className="text-center text-green-800 font-semibold">
              {result.charityMessage}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={applyAnalysis}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Apply Suggestion
            </button>
            <button
              onClick={() => setResult(null)}
              className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <Edit2 className="w-5 h-5" />
              Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-purple-600 p-3 rounded-xl">
          <Sparkles className="w-6 h-6 text-white animate-pulse" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Smart Product Analyzer</h3>
          <p className="text-sm text-gray-600">Let AI help you</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Brief product description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: Used wooden chair in good condition..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
            rows={3}
          />
        </div>

        <button
          onClick={analyzeProduct}
          disabled={analyzing || !description}
          className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
            analyzing || !description
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-xl'
          }`}
        >
          {analyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Analyze Product Now
            </>
          )}
        </button>

        <p className="text-xs text-center text-gray-500">
          AI will suggest: name, description, category, and 3 different prices
        </p>
        <p className="text-xs text-center text-gray-400">
          💡 Example: "Used wooden chair in excellent condition"
        </p>
      </div>
    </div>
  );
}

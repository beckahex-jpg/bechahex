import { useState, useRef } from 'react';
import { Sparkles, Loader2, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AnalysisResult {
  productName: string;
  description: string;
  category: string;
  condition: string;
  priceSuggestions: {
    symbolic: number;
    fair: number;
    market: number;
  };
  charityMessage: string;
  confidence: number;
}

interface QuickProductAnalyzerProps {
  onConfirm: (data: {
    title: string;
    description: string;
    category_id: string;
    condition: string;
    price: string;
    submission_type: 'donation' | 'symbolic_sale' | 'public_sale';
    images: File[];
  }) => void;
  categories: Array<{ id: string; name: string }>;
}

export default function QuickProductAnalyzer({ onConfirm, categories }: QuickProductAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [editableData, setEditableData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5 MB');
      return;
    }

    setSelectedImage(file);
    await analyzeImage(file);
  };

  const analyzeImage = async (file: File) => {
    try {
      setAnalyzing(true);
      setError('');

      const reader = new FileReader();
      reader.readAsDataURL(file);

      await new Promise((resolve) => {
        reader.onload = resolve;
      });

      const base64Image = (reader.result as string).split(',')[1];

      const { data, error: functionError } = await supabase.functions.invoke('analyze-product-image', {
        body: { image: base64Image }
      });

      if (functionError) throw functionError;

      setAnalysis(data);
      setEditableData({
        title: data.productName,
        description: data.description,
        category: data.category,
        condition: data.condition || 'Like New',
        price: data.priceSuggestions.fair.toString(),
        submission_type: 'symbolic_sale'
      });
    } catch (err: any) {
      console.error('Error analyzing image:', err);
      setError(err.message || 'Failed to analyze image');
    } finally {
      setAnalyzing(false);
    }
  };


  const handleConfirm = () => {
    if (!editableData || !analysis) return;

    const matchedCategory = categories.find(c =>
      c.name.toLowerCase().includes(editableData.category.toLowerCase()) ||
      editableData.category.toLowerCase().includes(c.name.toLowerCase())
    );

    onConfirm({
      title: editableData.title,
      description: editableData.description,
      category_id: matchedCategory?.id || '',
      condition: editableData.condition,
      price: editableData.price,
      submission_type: editableData.submission_type,
      images: selectedImage ? [selectedImage] : []
    });

    resetState();
  };

  const handleEdit = (field: string, value: string) => {
    setEditableData({ ...editableData, [field]: value });
  };

  const resetState = () => {
    setAnalyzing(false);
    setAnalysis(null);
    setSelectedImage(null);
    setError('');
    setEditableData(null);
  };

  if (!analysis && !analyzing && !error) {
    return (
      <div className="block mb-8">
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  Upload Product with AI
                </h3>
                <p className="text-purple-100 text-sm">
                  Automatic analysis using Gemini & DeepSeek AI
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-white hover:bg-purple-50 text-purple-600 font-bold px-6 py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Try Now
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="bg-white rounded-xl p-12 border-2 border-blue-200 mb-8">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing...</h3>
          <p className="text-gray-600">AI is analyzing the product now</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-8 border-2 border-red-200 mb-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Analysis Failed</h3>
          <p className="text-red-600">{error}</p>
        </div>
        <button
          onClick={resetState}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (analysis && editableData) {
    return (
      <div className="bg-white rounded-xl p-8 border-2 border-green-200 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Analysis Complete!</h3>
              <p className="text-sm text-gray-600">Review and edit data if needed</p>
            </div>
          </div>
          <button onClick={resetState} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {selectedImage && (
          <div className="mb-6">
            <img
              src={URL.createObjectURL(selectedImage)}
              alt="Product"
              className="w-full h-48 object-cover rounded-lg"
            />
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Product Name</label>
            <input
              type="text"
              value={editableData.title}
              onChange={(e) => handleEdit('title', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
            <textarea
              value={editableData.description}
              onChange={(e) => handleEdit('description', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Condition</label>
              <select
                value={editableData.condition}
                onChange={(e) => handleEdit('condition', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option>Brand New</option>
                <option>Like New</option>
                <option>Good</option>
                <option>Fair</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Price (USD)</label>
              <input
                type="number"
                value={editableData.price}
                onChange={(e) => handleEdit('price', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Submission Type</label>
            <select
              value={editableData.submission_type}
              onChange={(e) => handleEdit('submission_type', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="donation">Donate to Platform</option>
              <option value="symbolic_sale">Symbolic Price Sale</option>
              <option value="public_sale">Regular Sale</option>
            </select>
          </div>

          {analysis.charityMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-center">{analysis.charityMessage}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={resetState}
            className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Confirm & Continue
          </button>
        </div>
      </div>
    );
  }

  return null;
}

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Upload, Loader2, Check, X, MessageSquare, DollarSign, Tag, Wand2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Category {
  id: string;
  name: string;
}

interface AIAnalysisResult {
  productName: string;
  description: string;
  features: string[];
  material: string;
  targetAudience: string;
  suggestedCategories: string[];
  colors: string[];
  brandInfo: string;
  tags: string[];
}

interface PriceAnalysis {
  marketAnalysis: string;
  pricePoints: {
    budget: { price: number; reasoning: string };
    competitive: { price: number; reasoning: string };
    premium: { price: number; reasoning: string };
  };
  recommendedPrice: number;
  pricingStrategy: string;
}

interface AISmartProductUploadProps {
  categories: Category[];
  onComplete: (data: any) => void;
  onClose: () => void;
}

export default function AISmartProductUpload({ categories, onComplete, onClose }: AISmartProductUploadProps) {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review'>('upload');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<'idle' | 'image' | 'price' | 'finalizing'>('idle');
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [priceAnalysis, setPriceAnalysis] = useState<PriceAnalysis | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedPriceOption, setSelectedPriceOption] = useState<'budget' | 'competitive' | 'premium' | 'custom'>('competitive');
  const modalContentRef = useRef<HTMLDivElement>(null);

  const [editedData, setEditedData] = useState({
    title: '',
    description: '',
    category_id: '',
    price: '',
    features: [] as string[],
    tags: [] as string[],
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const compressImage = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const maxSize = 1024;
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const mimeType = file.type || 'image/jpeg';
          const base64 = canvas.toDataURL(mimeType, 0.85);

          resolve({ base64, mimeType });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const analyzeWithAI = async () => {
    if (!selectedImage) return;

    setAnalyzing(true);
    setStep('analyzing');
    setAnalysisStage('image');

    try {
      console.log('Starting image analysis...');
      console.log('Image file:', {
        name: selectedImage.name,
        type: selectedImage.type,
        size: selectedImage.size,
        sizeInMB: (selectedImage.size / 1024 / 1024).toFixed(2)
      });

      const { base64, mimeType } = await compressImage(selectedImage);
      console.log('Image compressed successfully. MIME type:', mimeType);

      const imageAnalysisPromise = supabase.functions.invoke('gemini-analyze-image', {
        body: { imageBase64: base64, mimeType }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('image_analysis_timeout')), 45000)
      );

      const { data: imageAnalysis, error: imageError } = await Promise.race([
        imageAnalysisPromise,
        timeoutPromise
      ]) as any;

      if (imageError) {
        console.error('Image analysis error:', imageError);
        console.error('Error details:', JSON.stringify(imageError, null, 2));
        throw imageError;
      }

      console.log('Image analysis response:', imageAnalysis);

      if (!imageAnalysis) {
        console.error('No response from image analysis');
        throw new Error('invalid_image_response');
      }

      if (imageAnalysis.error) {
        console.error('Error in image analysis:', imageAnalysis.error);
        throw new Error(imageAnalysis.error);
      }

      if (!imageAnalysis.analysis) {
        console.error('No analysis data in response');
        throw new Error('invalid_image_response');
      }

      const analysis = imageAnalysis.analysis;
      setAiResult(analysis);

      setAnalysisStage('price');

      const pricePromise = supabase.functions.invoke('deepseek-analyze', {
        body: {
          action: 'research_price',
          data: {
            productName: analysis.productName,
            description: analysis.description,
            features: analysis.features,
            category: analysis.suggestedCategories[0] || 'General'
          }
        }
      });

      const { data: priceData, error: priceError } = await Promise.race([
        pricePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('price_analysis_timeout')), 30000))
      ]) as any;

      if (priceError) {
        console.error('Price analysis error:', priceError);
        throw new Error('price_analysis_failed');
      }

      if (!priceData || !priceData.result) {
        throw new Error('invalid_price_response');
      }

      setPriceAnalysis(priceData.result);

      setAnalysisStage('finalizing');

      const matchedCategory = categories.find(cat => {
        const categoryName = cat.name.toLowerCase();
        return analysis.suggestedCategories.some(suggested => {
          const suggestedLower = suggested.toLowerCase();
          return (
            categoryName === suggestedLower ||
            categoryName.includes(suggestedLower) ||
            suggestedLower.includes(categoryName) ||
            (suggestedLower.includes('electronic') && categoryName === 'electronics') ||
            (suggestedLower.includes('fashion') && categoryName === 'fashion') ||
            (suggestedLower.includes('home') && categoryName === 'home & garden') ||
            (suggestedLower.includes('garden') && categoryName === 'home & garden') ||
            (suggestedLower.includes('sport') && categoryName === 'sports & outdoors') ||
            (suggestedLower.includes('outdoor') && categoryName === 'sports & outdoors') ||
            (suggestedLower.includes('book') && categoryName === 'books & media') ||
            (suggestedLower.includes('media') && categoryName === 'books & media') ||
            (suggestedLower.includes('toy') && categoryName === 'toys & games') ||
            (suggestedLower.includes('game') && categoryName === 'toys & games') ||
            (suggestedLower.includes('automotive') && categoryName === 'automotive') ||
            (suggestedLower.includes('tool') && categoryName.includes('tool'))
          );
        });
      });

      setEditedData({
        title: analysis.productName,
        description: analysis.description,
        category_id: matchedCategory?.id || '',
        price: priceData.result.recommendedPrice.toString(),
        features: analysis.features,
        tags: analysis.tags,
      });

      setStep('review');
    } catch (error: any) {
      console.error('Error analyzing:', error);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });

      let errorMessage = 'An error occurred during analysis. Please try again.';
      let technicalDetails = '';

      if (error.message === 'image_analysis_timeout') {
        errorMessage = 'Image analysis is taking too long. Check your internet connection and try again.';
      } else if (error.message === 'price_analysis_timeout') {
        errorMessage = 'Price analysis is taking too long. Check your internet connection and try again.';
      } else if (error.message === 'invalid_image_response') {
        errorMessage = 'Invalid response from image analysis service. Please try again.';
      } else if (error.message === 'invalid_price_response') {
        errorMessage = 'Invalid response from price analysis service. Please try again.';
      } else if (error.message?.includes('GEMINI_API_KEY') || error.message?.includes('مفتاح API')) {
        errorMessage = 'Image analysis service is currently unavailable. Please contact technical support.';
      } else if (error.message?.includes('DEEPSEEK_API_KEY')) {
        errorMessage = 'Price analysis service is currently unavailable. Please contact technical support.';
      } else if (error.message?.includes('فشل')) {
        errorMessage = error.message;
      } else {
        technicalDetails = error.message;
      }

      const fullMessage = technicalDetails
        ? `${errorMessage}\n\nTechnical details: ${technicalDetails}`
        : errorMessage;

      alert(fullMessage);
      setStep('upload');
      setAnalysisStage('idle');
    } finally {
      setAnalyzing(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('deepseek-analyze', {
        body: {
          action: 'chat_assistant',
          data: {
            message: userMessage,
            context: {
              productName: editedData.title,
              description: editedData.description,
              price: editedData.price,
            }
          }
        }
      });

      if (error) throw error;

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.result.response || 'I could not understand the question. Please try again.'
      }]);
    } catch (error) {
      console.error('Error in chat:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again.'
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const enhanceDescription = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('deepseek-analyze', {
        body: {
          action: 'enhance_description',
          data: {
            productName: editedData.title,
            description: editedData.description,
            features: editedData.features,
            targetAudience: aiResult?.targetAudience
          }
        }
      });

      if (error) throw error;

      setEditedData(prev => ({
        ...prev,
        description: data.result.enhancedDescription
      }));

      alert('Description enhanced successfully!');
    } catch (error) {
      console.error('Error enhancing:', error);
      alert('Failed to enhance description.');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (step === 'review' && modalContentRef.current) {
      setTimeout(() => {
        modalContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [step]);

  const handleComplete = () => {
    onComplete({
      ...editedData,
      images: [selectedImage],
      aiAnalysis: aiResult,
      priceAnalysis: priceAnalysis,
    });
  };

  if (step === 'upload') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl my-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">AI Smart Upload</h2>
                <p className="text-sm text-gray-600">Smart Analysis using Gemini & DeepSeek</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center bg-gradient-to-br from-blue-50 to-purple-50">
            {imagePreview ? (
              <div className="space-y-4">
                <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow-lg" />
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview('');
                  }}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Remove Image
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                <label className="cursor-pointer">
                  <span className="text-lg font-semibold text-purple-600 hover:text-purple-700">
                    Choose Product Image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-600 mt-2">
                  AI will analyze the image and automatically fill all data
                </p>
              </>
            )}
          </div>

          {selectedImage && (
            <button
              onClick={analyzeWithAI}
              className="w-full mt-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition flex items-center justify-center gap-2 shadow-lg"
            >
              <Sparkles className="w-5 h-5" />
              Start Smart Analysis
            </button>
          )}

          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-blue-50 rounded-lg">
              <Wand2 className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">Image Analysis</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">Price Suggestions</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <Tag className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700">Description Generation</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'analyzing') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center my-8">
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto flex items-center justify-center animate-pulse">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing...</h3>
          <p className="text-gray-600 mb-4">AI is analyzing the product now</p>
          <div className="space-y-2 text-sm text-gray-500">
            <p className={`flex items-center justify-center gap-2 ${analysisStage === 'image' || analysisStage === 'price' || analysisStage === 'finalizing' ? 'text-gray-900' : ''}`}>
              {analysisStage === 'image' ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (analysisStage === 'price' || analysisStage === 'finalizing') ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <span className="w-4 h-4" />
              )}
              Image analysis via Gemini (45 seconds)
            </p>
            <p className={`flex items-center justify-center gap-2 ${analysisStage === 'price' || analysisStage === 'finalizing' ? 'text-gray-900' : 'text-gray-400'}`}>
              {analysisStage === 'price' ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : analysisStage === 'finalizing' ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <span className="w-4 h-4" />
              )}
              Searching market prices (30 seconds)
            </p>
            <p className={`flex items-center justify-center gap-2 ${analysisStage === 'finalizing' ? 'text-gray-900' : 'text-gray-400'}`}>
              {analysisStage === 'finalizing' ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <span className="w-4 h-4" />
              )}
              Generating description and keywords
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div ref={modalContentRef} className="bg-white rounded-2xl max-w-6xl w-full my-8 shadow-2xl">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Review & Edit Data</h2>
                <p className="text-sm text-purple-100">Check the data and edit what you want before uploading</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {imagePreview && (
              <div>
                <img src={imagePreview} alt="Product" className="w-full h-64 object-cover rounded-xl shadow-lg" />
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Product Name</label>
              <input
                type="text"
                value={editedData.title}
                onChange={(e) => setEditedData({...editedData, title: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-gray-900">Description</label>
                <button
                  onClick={enhanceDescription}
                  disabled={analyzing}
                  className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200 transition flex items-center gap-1"
                >
                  <Wand2 className="w-3 h-3" />
                  {analyzing ? 'Enhancing...' : 'Enhance with AI'}
                </button>
              </div>
              <textarea
                value={editedData.description}
                onChange={(e) => setEditedData({...editedData, description: e.target.value})}
                rows={6}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                Category
                {editedData.category_id && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Selected
                  </span>
                )}
              </label>
              <select
                value={editedData.category_id}
                onChange={(e) => setEditedData({...editedData, category_id: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-6">
            {priceAnalysis && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Market Price Analysis
                </h3>
                <div className="space-y-3 mb-4">
                  <button
                    onClick={() => {
                      setEditedData({...editedData, price: priceAnalysis.pricePoints.budget.price.toString()});
                      setSelectedPriceOption('budget');
                    }}
                    className={`w-full text-left p-3 bg-white rounded-lg hover:bg-green-50 transition border-2 ${
                      selectedPriceOption === 'budget' ? 'border-green-500 ring-2 ring-green-200' : 'border-transparent hover:border-green-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Budget Price</span>
                      <span className="text-xl font-bold text-green-600">${priceAnalysis.pricePoints.budget.price}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{priceAnalysis.pricePoints.budget.reasoning}</p>
                  </button>

                  <button
                    onClick={() => {
                      setEditedData({...editedData, price: priceAnalysis.pricePoints.competitive.price.toString()});
                      setSelectedPriceOption('competitive');
                    }}
                    className={`w-full text-left p-3 bg-white rounded-lg hover:bg-blue-50 transition border-2 ${
                      selectedPriceOption === 'competitive' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Competitive Price (Recommended)</span>
                      <span className="text-xl font-bold text-blue-600">${priceAnalysis.pricePoints.competitive.price}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{priceAnalysis.pricePoints.competitive.reasoning}</p>
                  </button>

                  <button
                    onClick={() => {
                      setEditedData({...editedData, price: priceAnalysis.pricePoints.premium.price.toString()});
                      setSelectedPriceOption('premium');
                    }}
                    className={`w-full text-left p-3 bg-white rounded-lg hover:bg-purple-50 transition border-2 ${
                      selectedPriceOption === 'premium' ? 'border-purple-500 ring-2 ring-purple-200' : 'border-transparent hover:border-purple-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Premium Price</span>
                      <span className="text-xl font-bold text-purple-600">${priceAnalysis.pricePoints.premium.price}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{priceAnalysis.pricePoints.premium.reasoning}</p>
                  </button>
                </div>
                <p className="text-sm text-gray-700">
                  <strong>Strategy:</strong> {priceAnalysis.pricingStrategy}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Final Price</label>
              <input
                type="number"
                step="0.01"
                value={editedData.price}
                onChange={(e) => {
                  setEditedData({...editedData, price: e.target.value});
                  setSelectedPriceOption('custom');
                }}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg font-bold"
              />
            </div>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <button
                onClick={() => setShowChat(!showChat)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                  <span className="font-bold text-gray-900">AI Assistant</span>
                </div>
                <span className="text-purple-600">{showChat ? '▼' : '▶'}</span>
              </button>

              {showChat && (
                <div className="mt-4">
                  <div className="bg-white rounded-lg p-4 max-h-48 overflow-y-auto mb-3 space-y-2">
                    {chatMessages.length === 0 && (
                      <p className="text-sm text-gray-500 text-center">Ask any question about improving your product!</p>
                    )}
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`p-2 rounded-lg text-sm ${msg.role === 'user' ? 'bg-purple-100 text-right' : 'bg-gray-100'}`}>
                        {msg.content}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder="Type your question..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={chatLoading || !chatInput.trim()}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex justify-between">
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition flex items-center gap-2 shadow-lg"
          >
            <Check className="w-5 h-5" />
            Confirm & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

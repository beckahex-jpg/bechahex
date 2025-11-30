import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Upload, FileText, DollarSign, Image as ImageIcon, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AISmartProductUpload from '../components/AISmartProductUpload';

interface Category {
  id: string;
  name: string;
}

interface ProductFormData {
  title: string;
  description: string;
  category_id: string;
  condition: string;
  price: string;
  original_price: string;
  submission_type: 'donation' | 'symbolic_sale' | 'public_sale';
  images: File[];
}

const STEPS = [
  { id: 1, name: 'Basic Info', icon: FileText },
  { id: 2, name: 'Price & Inventory', icon: DollarSign },
  { id: 3, name: 'Description', icon: FileText },
  { id: 4, name: 'Images', icon: ImageIcon },
];

export default function SubmitProduct() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAIUpload, setShowAIUpload] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    description: '',
    category_id: '',
    condition: 'Like New',
    price: '',
    original_price: '',
    submission_type: 'donation',
    images: [],
  });

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadCategories();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user, navigate]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (error) {
        if (error.message.includes('JWT expired')) {
          alert('Your session has expired. Please log in again.');
          navigate('/');
          return;
        }
        throw error;
      }
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + formData.images.length > 5) {
      alert('You can upload a maximum of 5 images');
      return;
    }
    setFormData({ ...formData, images: [...formData.images, ...files] });
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  const uploadImages = async (): Promise<string[]> => {
    const imageUrls: string[] = [];

    for (let i = 0; i < formData.images.length; i++) {
      const file = formData.images[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}-${i}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      imageUrls.push(data.publicUrl);
    }

    return imageUrls;
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const imageUrls: string[] = formData.images.length > 0
        ? await uploadImages()
        : [];

      const { data: newSubmission, error } = await supabase.from('product_submissions').insert({
        user_id: user?.id,
        title: formData.title,
        description: formData.description,
        category_id: formData.category_id || null,
        condition: formData.condition,
        price: parseFloat(formData.price) || 0,
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        submission_type: formData.submission_type,
        images: imageUrls,
        status: 'pending',
      }).select().single();

      if (error) throw error;

      // Call AI validation Edge Function
      if (newSubmission) {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-new-submission`;
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ submission_id: newSubmission.id })
        }).catch(err => console.error('AI processing error:', err));
      }

      alert('Product submitted successfully! Our AI is reviewing it now.');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting product:', error);
      alert('Failed to submit product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.title && formData.category_id;
      case 2:
        return formData.price;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
                <p className="text-sm text-gray-600">Enter the basic details about your product</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Product Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Laptop"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Category <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Condition</label>
              <div className="grid grid-cols-2 gap-3">
                {['Brand New', 'Like New', 'Good', 'Fair'].map((condition) => (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => setFormData({ ...formData, condition })}
                    className={`px-4 py-3 border-2 rounded-lg font-medium transition ${
                      formData.condition === condition
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {condition}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Price & Inventory</h2>
                <p className="text-sm text-gray-600">Set your pricing and stock details</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Submission Type <span className="text-red-600">*</span>
              </label>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 mb-4">
                <p className="text-green-800 font-semibold text-center">
                  🙏 Would you like to donate this product as charity?
                </p>
                <p className="text-green-700 text-sm text-center mt-2">
                  The platform will handle the sale and all proceeds go to charity ❤️
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, submission_type: 'donation', price: '0' })}
                  className={`w-full px-6 py-5 border-2 rounded-xl text-right transition-all shadow-sm hover:shadow-md ${
                    formData.submission_type === 'donation'
                      ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 shadow-md'
                      : 'border-gray-300 hover:border-green-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-3xl">🎁</div>
                    <div className="flex-1 mr-4">
                      <div className="font-bold text-gray-900 text-lg">Donate to Platform</div>
                      <div className="text-sm text-gray-600 mt-1">Platform sells and all proceeds go to charity</div>
                      {formData.submission_type === 'donation' && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
                          ✓ Highly Recommended
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, submission_type: 'symbolic_sale' })}
                  className={`w-full px-6 py-5 border-2 rounded-xl text-right transition-all shadow-sm hover:shadow-md ${
                    formData.submission_type === 'symbolic_sale'
                      ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-md'
                      : 'border-gray-300 hover:border-blue-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-3xl">💵</div>
                    <div className="flex-1 mr-4">
                      <div className="font-bold text-gray-900 text-lg">Symbolic Price Sale</div>
                      <div className="text-sm text-gray-600 mt-1">Simple price and platform takes a percentage for charity</div>
                      {formData.submission_type === 'symbolic_sale' && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                          ✓ Recommended
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, submission_type: 'public_sale' })}
                  className={`w-full px-6 py-5 border-2 rounded-xl text-right transition-all shadow-sm hover:shadow-md ${
                    formData.submission_type === 'public_sale'
                      ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 shadow-md'
                      : 'border-gray-300 hover:border-purple-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-3xl">💰</div>
                    <div className="flex-1 mr-4">
                      <div className="font-bold text-gray-900 text-lg">Regular Sale</div>
                      <div className="text-sm text-gray-600 mt-1">Market price and platform takes a small commission</div>
                      {formData.submission_type === 'public_sale' && (
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">
                          ✓ Recommended
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {formData.submission_type !== 'donation' && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Price (USD) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                {formData.submission_type === 'symbolic_sale' && (
                  <p className="text-sm text-blue-600 mt-2" dir="rtl">
                    💡 السعر الرمزي المقترح: $1 - $5
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Original Price (USD) <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.original_price}
                onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Description & Details</h2>
                <p className="text-sm text-gray-600">Add a detailed description</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Product Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={8}
                placeholder="Describe your product in detail..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
              <p className="text-sm text-gray-500 mt-2">
                Provide detailed information about the product, its features, and condition
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-100 rounded-lg">
                <ImageIcon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Product Images</h2>
                <p className="text-sm text-gray-600">Add clear photos of your product (Optional)</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <label className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-700 font-semibold">
                  Choose product images
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-gray-500 mt-2">
                You can select up to 5 images (Max 5 MB per image)
              </p>
            </div>

            {formData.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {formData.images.map((file, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const handleAIComplete = (aiData: any) => {
    setFormData({
      ...formData,
      title: aiData.title,
      description: aiData.description,
      category_id: aiData.category_id,
      price: aiData.price,
      images: aiData.images || [],
    });
    setShowAIUpload(false);
    setCurrentStep(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 pb-24 lg:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {showAIUpload && (
          <AISmartProductUpload
            categories={categories}
            onComplete={handleAIComplete}
            onClose={() => setShowAIUpload(false)}
          />
        )}

        <div className="mb-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Sparkles className="w-10 h-10" />
              <div>
                <h3 className="text-xl font-bold">Upload Product with AI</h3>
                <p className="text-sm text-purple-100">Automatic analysis using Gemini & DeepSeek</p>
              </div>
            </div>
            <button
              onClick={() => setShowAIUpload(true)}
              className="px-6 py-3 bg-white text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition shadow-lg"
            >
              Try Now
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-8 text-white">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-white hover:text-gray-200 mb-4 inline-flex items-center gap-2 text-sm"
            >
              <X className="w-4 h-4" />
              Close
            </button>
            <h1 className="text-2xl font-bold">Submit New Product</h1>
            <p className="text-blue-100 mt-1">Share your items and make a difference</p>
          </div>

          <div className="px-6 py-8 border-b border-gray-200">
            <div className="flex justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div key={step.id} className="flex-1 relative">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition ${
                          isCompleted
                            ? 'bg-green-600 text-white'
                            : isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                      </div>
                      <span
                        className={`text-xs font-medium text-center ${
                          isActive ? 'text-blue-600' : 'text-gray-500'
                        }`}
                      >
                        {step.name}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`absolute top-6 left-1/2 w-full h-0.5 -z-10 transition ${
                          isCompleted ? 'bg-green-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-8">{renderStep()}</div>

          <div className="px-6 py-6 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition order-2 sm:order-1"
              >
                Cancel
              </button>
              <div className="flex gap-3 order-1 sm:order-2">
                {currentStep > 1 && (
                  <button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="flex-1 sm:flex-none px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition"
                  >
                    Previous
                  </button>
                )}
                {currentStep < STEPS.length ? (
                  <button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={!canProceed()}
                    className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-semibold transition ${
                      canProceed()
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !canProceed()}
                    className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                      loading || !canProceed()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Submit Product
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

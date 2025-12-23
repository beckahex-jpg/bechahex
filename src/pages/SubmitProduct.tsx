import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Upload, Check, Sparkles, ChevronLeft, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AISmartProductUpload from '../components/AISmartProductUpload';
import { useToast } from '../contexts/ToastContext';

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
  seller_symbolic_price: string;
  submission_type: 'donation' | 'symbolic_sale' | 'public_sale';
  images: File[];
}

const AUTOSAVE_KEY = 'product_submission_draft';

export default function SubmitProduct() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAIUpload, setShowAIUpload] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const [formData, setFormData] = useState<ProductFormData>(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          images: []
        };
      } catch {
        return {
          title: '',
          description: '',
          category_id: '',
          condition: 'Like New',
          price: '0',
          original_price: '',
          seller_symbolic_price: '',
          submission_type: 'donation',
          images: [],
        };
      }
    }
    return {
      title: '',
      description: '',
      category_id: '',
      condition: 'Like New',
      price: '0',
      original_price: '',
      seller_symbolic_price: '',
      submission_type: 'donation',
      images: [],
    };
  });

  useEffect(() => {
    if (!user) {
      openAuthModal('Please sign in to sell products');
      navigate('/');
      return;
    }
    loadCategories();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user, navigate]);

  useEffect(() => {
    if (formData.submission_type === 'donation') {
      setFormData(prev => ({
        ...prev,
        price: prev.original_price || '0',
        seller_symbolic_price: '0'
      }));
    } else if (formData.submission_type === 'symbolic_sale') {
      if (formData.price === '0') {
        setFormData(prev => ({ ...prev, price: '' }));
      }
    } else {
      if (formData.price === '0') {
        setFormData(prev => ({ ...prev, price: '' }));
      }
      setFormData(prev => ({ ...prev, seller_symbolic_price: '' }));
    }
  }, [formData.submission_type]);

  useEffect(() => {
    if (formData.submission_type === 'donation' && formData.original_price) {
      setFormData(prev => ({ ...prev, price: prev.original_price }));
    }
  }, [formData.original_price, formData.submission_type]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const dataToSave = {
        ...formData,
        images: []
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataToSave));
      setLastSaved(new Date());
    }, 1000);

    return () => clearTimeout(timer);
  }, [formData]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (error) {
        if (error.message.includes('JWT expired')) {
          showError('Your session has expired. Please log in again.');
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

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          let width = img.width;
          let height = img.height;
          const maxDimension = 1920;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + formData.images.length > 5) {
      showWarning('You can upload a maximum of 5 images');
      return;
    }

    const validFiles: File[] = [];
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        showWarning(`${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        showWarning(`${file.name} is not an image file.`);
        continue;
      }
      try {
        const compressedFile = await compressImage(file);
        if (compressedFile.size > 5 * 1024 * 1024) {
          showWarning(`${file.name} could not be compressed enough. Please use a smaller image.`);
          continue;
        }
        validFiles.push(compressedFile);
      } catch (error) {
        console.error('Error compressing image:', error);
        showError(`Failed to process ${file.name}`);
      }
    }

    if (validFiles.length > 0) {
      setFormData({ ...formData, images: [...formData.images, ...validFiles] });
    }
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

      const finalPrice = formData.submission_type === 'donation'
        ? parseFloat(formData.original_price) || 0
        : parseFloat(formData.price) || 0;

      const { data: newSubmission, error } = await supabase.from('product_submissions').insert({
        user_id: user?.id,
        title: formData.title,
        description: formData.description,
        category_id: formData.category_id || null,
        condition: formData.condition,
        price: finalPrice,
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        seller_symbolic_price: formData.seller_symbolic_price ? parseFloat(formData.seller_symbolic_price) : null,
        submission_type: formData.submission_type,
        images: imageUrls,
        status: 'pending',
      }).select().single();

      if (error) throw error;

      localStorage.removeItem(AUTOSAVE_KEY);
      showSuccess('Product submitted successfully! Our AI is reviewing it now.');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting product:', error);
      showError('Failed to submit product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const completionPercentage = useMemo(() => {
    let completed = 0;
    let total = 0;

    if (formData.images.length > 0) completed++;
    total++;

    if (formData.title) completed++;
    total++;

    if (formData.category_id) completed++;
    total++;

    if (formData.submission_type === 'donation') {
      if (formData.original_price && formData.original_price !== '0') completed++;
      total++;
    } else if (formData.submission_type === 'symbolic_sale') {
      if (formData.original_price && formData.original_price !== '0') completed++;
      if (formData.seller_symbolic_price && formData.seller_symbolic_price !== '0') completed++;
      if (formData.price && formData.price !== '0') completed++;
      total += 3;
    } else {
      if (formData.price && formData.price !== '0') completed++;
      total++;
    }

    return Math.round((completed / total) * 100);
  }, [formData]);

  const canSubmit = useMemo(() => {
    if (!formData.title || !formData.category_id || formData.images.length === 0) return false;

    if (formData.submission_type === 'donation') {
      return formData.original_price && formData.original_price !== '0';
    } else if (formData.submission_type === 'symbolic_sale') {
      return formData.original_price && formData.original_price !== '0' &&
             formData.seller_symbolic_price && formData.seller_symbolic_price !== '0' &&
             formData.price && formData.price !== '0';
    } else {
      return formData.price && formData.price !== '0';
    }
  }, [formData]);

  const handleAIComplete = (aiData: any) => {
    const aiPrice = parseFloat(aiData.price) || 0;

    let updatedFormData = {
      ...formData,
      title: aiData.title,
      description: aiData.description,
      category_id: aiData.category_id,
      images: aiData.images || [],
    };

    if (formData.submission_type === 'donation') {
      updatedFormData = {
        ...updatedFormData,
        original_price: aiPrice.toFixed(2),
        price: aiPrice.toFixed(2),
        seller_symbolic_price: '0'
      };
    } else if (formData.submission_type === 'symbolic_sale') {
      const symbolicPrice = (aiPrice * 0.35).toFixed(2);
      const publicPrice = (aiPrice * 0.65).toFixed(2);
      updatedFormData = {
        ...updatedFormData,
        original_price: aiPrice.toFixed(2),
        seller_symbolic_price: symbolicPrice,
        price: publicPrice
      };
    } else {
      const salePrice = (aiPrice * 0.85).toFixed(2);
      updatedFormData = {
        ...updatedFormData,
        price: salePrice,
        original_price: aiPrice.toFixed(2)
      };
    }

    setFormData(updatedFormData);
    setShowAIUpload(false);
  };

  const selectedCategory = categories.find(cat => cat.id === formData.category_id);

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {showAIUpload && (
          <AISmartProductUpload
            categories={categories}
            onComplete={handleAIComplete}
            onClose={() => setShowAIUpload(false)}
          />
        )}

        <div className="mb-4 sm:mb-6 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl p-4 sm:p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-base sm:text-xl font-bold truncate">AI-Powered Product Upload</h3>
                <p className="text-xs sm:text-sm text-blue-100 truncate">Automatic analysis using Gemini & DeepSeek</p>
              </div>
            </div>
            <button
              onClick={() => setShowAIUpload(true)}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-blue-600 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base hover:bg-blue-50 transition shadow-lg active:scale-95"
            >
              Try AI Upload
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 sm:px-6 py-6 sm:py-8 text-white relative overflow-hidden">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-white hover:text-gray-200 mb-3 sm:mb-4 inline-flex items-center gap-2 text-xs sm:text-sm active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Dashboard</span>
                </button>
                <h1 className="text-xl sm:text-2xl font-bold">Add New Product</h1>
                <p className="text-green-100 mt-1 text-xs sm:text-sm">Fill out the form below to list your product</p>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Completion</span>
                    <span className="text-sm font-bold">{completionPercentage}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-white h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>

                {lastSaved && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-green-100">
                    <Save className="w-3.5 h-3.5" />
                    <span>Auto-saved {Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s ago</span>
                  </div>
                )}
              </div>

              <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-8">
                <section>
                  <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-gray-200">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-bold">1</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        Product Images
                        <span className="text-red-600">*</span>
                        {formData.images.length > 0 && <Check className="w-4 h-4 text-green-600" />}
                      </h2>
                      <p className="text-sm text-gray-600">Add at least one clear photo of your product</p>
                    </div>
                  </div>

                  <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    formData.images.length === 0
                      ? 'border-red-300 bg-red-50 hover:border-red-400'
                      : 'border-gray-300 hover:border-blue-500'
                  }`}>
                    <Upload className={`w-12 h-12 mx-auto mb-4 ${
                      formData.images.length === 0 ? 'text-red-400' : 'text-gray-400'
                    }`} />
                    <label className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-700 font-semibold text-lg">
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
                    {formData.images.length === 0 && (
                      <p className="text-sm text-red-600 font-semibold mt-3">
                        At least one image is required to submit your product
                      </p>
                    )}
                  </div>

                  {formData.images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                      {formData.images.map((file, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg hover:bg-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            {index === 0 ? 'Main' : `#${index + 1}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-gray-200">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <span className="text-green-600 font-bold">2</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Basic Information</h2>
                      <p className="text-sm text-gray-600">Enter the basic details about your product</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        Product Name
                        <span className="text-red-600">*</span>
                        {formData.title && <Check className="w-4 h-4 text-green-600" />}
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., Laptop"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          Category
                          <span className="text-red-600">*</span>
                          {formData.category_id && <Check className="w-4 h-4 text-green-600" />}
                        </label>
                        <select
                          value={formData.category_id}
                          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
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
                        <div className="grid grid-cols-2 gap-2">
                          {['Brand New', 'Like New', 'Good', 'Fair'].map((condition) => (
                            <button
                              key={condition}
                              type="button"
                              onClick={() => setFormData({ ...formData, condition })}
                              className={`px-3 py-2.5 border-2 rounded-lg font-medium transition text-sm ${
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
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-gray-200">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                      <span className="text-orange-600 font-bold">3</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Submission Type & Pricing</h2>
                      <p className="text-sm text-gray-600">Choose how you want to sell your product</p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 mb-5">
                    <p className="text-green-800 font-semibold text-center">
                      Would you like to donate this product as charity?
                    </p>
                    <p className="text-green-700 text-sm text-center mt-2">
                      The platform will handle the sale and all proceeds go to charity
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, submission_type: 'donation' })}
                      className={`px-5 py-6 border-2 rounded-xl transition-all shadow-sm hover:shadow-md ${
                        formData.submission_type === 'donation'
                          ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md ring-2 ring-green-500'
                          : 'border-gray-300 hover:border-green-400 bg-white'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-3">🎁</div>
                        <div className="font-bold text-gray-900 text-base mb-1">Donate to Platform</div>
                        <div className="text-xs text-gray-600">Platform sells, all proceeds to charity</div>
                        {formData.submission_type === 'donation' && (
                          <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
                            <Check className="w-3 h-3" />
                            Selected
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, submission_type: 'symbolic_sale' })}
                      className={`px-5 py-6 border-2 rounded-xl transition-all shadow-sm hover:shadow-md ${
                        formData.submission_type === 'symbolic_sale'
                          ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-md ring-2 ring-blue-500'
                          : 'border-gray-300 hover:border-blue-400 bg-white'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-3">💵</div>
                        <div className="font-bold text-gray-900 text-base mb-1">Symbolic Price Sale</div>
                        <div className="text-xs text-gray-600">You get a symbolic amount</div>
                        {formData.submission_type === 'symbolic_sale' && (
                          <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                            <Check className="w-3 h-3" />
                            Selected
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, submission_type: 'public_sale' })}
                      className={`px-5 py-6 border-2 rounded-xl transition-all shadow-sm hover:shadow-md ${
                        formData.submission_type === 'public_sale'
                          ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 shadow-md ring-2 ring-orange-500'
                          : 'border-gray-300 hover:border-orange-400 bg-white'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-4xl mb-3">💰</div>
                        <div className="font-bold text-gray-900 text-base mb-1">Regular Sale</div>
                        <div className="text-xs text-gray-600">Market price, small commission</div>
                        {formData.submission_type === 'public_sale' && (
                          <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-orange-600 text-white text-xs font-semibold rounded-full">
                            <Check className="w-3 h-3" />
                            Selected
                          </div>
                        )}
                      </div>
                    </button>
                  </div>

                  {formData.submission_type === 'donation' && (
                    <div className="bg-green-50 border-2 border-green-300 rounded-xl p-5">
                      <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        Product Sale Price (USD)
                        <span className="text-red-600">*</span>
                        {formData.original_price && formData.original_price !== '0' && <Check className="w-4 h-4 text-green-600" />}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.original_price}
                        onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      />
                      <div className="mt-3 bg-white border border-green-300 rounded-lg p-3">
                        <p className="text-sm text-green-800 font-semibold mb-2 flex items-center gap-2">
                          <span>💰</span>
                          <span>How Donation Works:</span>
                        </p>
                        <ul className="text-sm text-green-700 space-y-1">
                          <li>• Buyers will pay this full amount ({formData.original_price ? `$${formData.original_price}` : '$___'})</li>
                          <li>• You receive nothing (full donation)</li>
                          <li>• 100% goes to charity</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {formData.submission_type === 'symbolic_sale' && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-5">
                        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          Original Product Price (USD)
                          <span className="text-red-600">*</span>
                          {formData.original_price && formData.original_price !== '0' && <Check className="w-4 h-4 text-green-600" />}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.original_price}
                          onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <p className="text-sm text-blue-700 mt-2">
                          This is the actual market value shown to buyers
                        </p>
                      </div>

                      <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-5">
                        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          Your Symbolic Price (USD)
                          <span className="text-red-600">*</span>
                          {formData.seller_symbolic_price && formData.seller_symbolic_price !== '0' && <Check className="w-4 h-4 text-green-600" />}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.seller_symbolic_price}
                          onChange={(e) => setFormData({ ...formData, seller_symbolic_price: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <p className="text-sm text-blue-700 mt-2">
                          The symbolic amount you want to receive (private)
                        </p>
                      </div>

                      <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-5">
                        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          Public Sale Price (USD)
                          <span className="text-red-600">*</span>
                          {formData.price && formData.price !== '0' && <Check className="w-4 h-4 text-green-600" />}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <p className="text-sm text-blue-600 mt-2">
                          The price buyers will pay (between symbolic and original)
                        </p>
                      </div>
                    </div>
                  )}

                  {formData.submission_type === 'public_sale' && (
                    <div className="space-y-4">
                      <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-5">
                        <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          Sale Price (USD)
                          <span className="text-red-600">*</span>
                          {formData.price && formData.price !== '0' && <Check className="w-4 h-4 text-green-600" />}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        />
                        <p className="text-sm text-gray-600 mt-2">
                          Set a competitive market price for your product
                        </p>
                      </div>

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
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <p className="text-sm text-gray-600 mt-2">
                          Show the original retail price to highlight savings
                        </p>
                      </div>
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-gray-200">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <span className="text-red-600 font-bold">4</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Description & Details</h2>
                      <p className="text-sm text-gray-600">Add a detailed description (Optional)</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Product Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={6}
                      placeholder="Describe your product in detail..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-sm text-gray-500">
                        Provide detailed information about the product, its features, and condition
                      </p>
                      <span className="text-sm text-gray-500">{formData.description.length} characters</span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="px-4 sm:px-6 py-4 sm:py-6 bg-gray-50 border-t-2 border-gray-200 sticky bottom-0 z-10">
                <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 items-stretch sm:items-center">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold text-base hover:bg-gray-100 transition active:scale-95"
                  >
                    Cancel
                  </button>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSubmit}
                      disabled={loading || !canSubmit}
                      className={`flex-1 sm:flex-none px-8 py-3 rounded-lg font-semibold text-base transition flex items-center justify-center gap-2 active:scale-95 ${
                        loading || !canSubmit
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                      }`}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          <span>Submit Product</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {!canSubmit && (
                  <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                    <p className="font-semibold mb-1">Please complete the following:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {formData.images.length === 0 && <li>Add at least one product image</li>}
                      {!formData.title && <li>Enter product name</li>}
                      {!formData.category_id && <li>Select a category</li>}
                      {formData.submission_type === 'donation' && (!formData.original_price || formData.original_price === '0') && (
                        <li>Enter product sale price</li>
                      )}
                      {formData.submission_type === 'symbolic_sale' && (
                        <>
                          {(!formData.original_price || formData.original_price === '0') && <li>Enter original product price</li>}
                          {(!formData.seller_symbolic_price || formData.seller_symbolic_price === '0') && <li>Enter your symbolic price</li>}
                          {(!formData.price || formData.price === '0') && <li>Enter public sale price</li>}
                        </>
                      )}
                      {formData.submission_type === 'public_sale' && (!formData.price || formData.price === '0') && (
                        <li>Enter sale price</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showPreview && (
            <div className="hidden lg:block w-80 xl:w-96">
              <div className="sticky top-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-4 py-4 text-white flex items-center justify-between">
                    <h3 className="font-bold">Live Preview</h3>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="text-white hover:text-gray-300 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4">
                    <div className={`rounded-lg aspect-square mb-4 flex items-center justify-center overflow-hidden ${
                      formData.images.length === 0 ? 'bg-red-50 border-2 border-red-200' : 'bg-gray-100'
                    }`}>
                      {formData.images.length > 0 ? (
                        <img
                          src={URL.createObjectURL(formData.images[0])}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-red-400 text-center px-4">
                          <Upload className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-sm font-semibold">Image Required</p>
                          <p className="text-xs text-gray-500 mt-1">Please add at least one image</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-lg text-gray-900 line-clamp-2">
                          {formData.title || 'Product Name'}
                        </h4>
                        {selectedCategory && (
                          <p className="text-sm text-gray-500">{selectedCategory.name}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          {formData.condition}
                        </span>
                        {formData.submission_type === 'donation' && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            Donation
                          </span>
                        )}
                      </div>

                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex items-baseline gap-2">
                          {formData.submission_type === 'donation' && formData.original_price ? (
                            <span className="text-2xl font-bold text-green-600">
                              ${formData.original_price}
                            </span>
                          ) : formData.price && formData.price !== '0' ? (
                            <>
                              <span className="text-2xl font-bold text-gray-900">
                                ${formData.price}
                              </span>
                              {formData.original_price && formData.original_price !== '0' && (
                                <span className="text-lg text-gray-400 line-through">
                                  ${formData.original_price}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-2xl font-bold text-gray-400">$0.00</span>
                          )}
                        </div>
                      </div>

                      {formData.description && (
                        <div className="pt-3 border-t border-gray-200">
                          <p className="text-sm text-gray-600 line-clamp-4">
                            {formData.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, Eye, AlertCircle, Clock, Search, User, Mail, Phone, MapPin, Calendar, Package, DollarSign, Upload, Trash2, Save } from 'lucide-react';

interface Submission {
  id: string;
  title: string;
  description: string;
  price: number;
  final_price: number | null;
  condition: string;
  images: string[];
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  user_id: string;
  category_id: string;
  ai_validation_status?: string | null;
  ai_suggested_price?: number | null;
  ai_validation_notes?: string | null;
  requires_manual_review?: boolean;
  auto_published?: boolean;
  profiles: {
    full_name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  categories: {
    name: string;
  };
}

interface ProductSubmissionsProps {
  onSubmissionChange?: () => void;
}

export default function ProductSubmissions({ onSubmissionChange }: ProductSubmissionsProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [finalPrice, setFinalPrice] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedCondition, setEditedCondition] = useState('');
  const [editedCategoryId, setEditedCategoryId] = useState('');
  const [editedImages, setEditedImages] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    fetchCategories();
  }, [filter]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('product_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data: submissionsData, error } = await query;

      if (error) {
        console.error('Error fetching submissions:', error);
        throw error;
      }

      const enrichedData = await Promise.all(
        (submissionsData || []).map(async (sub) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, phone, address, city, country')
            .eq('id', sub.user_id)
            .maybeSingle();

          const { data: category } = await supabase
            .from('categories')
            .select('name')
            .eq('id', sub.category_id)
            .maybeSingle();

          return {
            ...sub,
            profiles: profile || { full_name: 'Unknown', email: '', phone: '', address: '', city: '', country: '' },
            categories: category || { name: 'N/A' }
          };
        })
      );

      setSubmissions(enrichedData);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (submission: Submission) => {
    setSelectedSubmission(submission);
    setFinalPrice(submission.final_price?.toString() || submission.ai_suggested_price?.toString() || submission.price.toString());
    setRejectionReason('');
    setEditedTitle(submission.title);
    setEditedDescription(submission.description);
    setEditedCondition(submission.condition);
    setEditedCategoryId(submission.category_id);
    setEditedImages([...submission.images]);
    setNewImageUrl('');
    setShowReviewModal(true);
  };

  const handleAddImage = () => {
    if (newImageUrl.trim()) {
      setEditedImages([...editedImages, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setEditedImages(editedImages.filter((_, i) => i !== index));
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingImage(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setEditedImages([...editedImages, publicUrl]);
      alert('✅ Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedSubmission || !finalPrice) return;

    try {
      setProcessing(true);

      const productData = {
        title: editedTitle,
        description: editedDescription,
        price: parseFloat(finalPrice),
        category_id: editedCategoryId,
        image_url: editedImages && editedImages.length > 0 ? editedImages[0] : '',
        condition: editedCondition,
        seller_id: selectedSubmission.user_id,
        status: 'available'
      };

      const { error: productError } = await supabase
        .from('products')
        .insert(productData);

      if (productError) throw productError;

      const { error: updateError } = await supabase
        .from('product_submissions')
        .update({
          status: 'approved',
          final_price: parseFloat(finalPrice),
          title: editedTitle,
          description: editedDescription,
          condition: editedCondition,
          category_id: editedCategoryId,
          images: editedImages
        })
        .eq('id', selectedSubmission.id);

      if (updateError) throw updateError;

      const priceChange = parseFloat(finalPrice) !== parseFloat(selectedSubmission.price.toString());
      const priceDiff = priceChange ? parseFloat(finalPrice) - parseFloat(selectedSubmission.price.toString()) : 0;

      let notificationMessage = `Congratulations! Your product "${selectedSubmission.title}" has been approved and is now live on the marketplace.\n\n`;
      notificationMessage += `Final selling price: $${finalPrice}`;

      if (priceChange) {
        notificationMessage += `\n(${priceDiff > 0 ? 'Increased' : 'Decreased'} by $${Math.abs(priceDiff).toFixed(2)} from your requested price of $${selectedSubmission.price})`;
      }

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedSubmission.user_id,
          title: '✅ Product Approved!',
          message: notificationMessage,
          type: 'success'
        });

      if (notificationError) console.error('Notification error:', notificationError);

      alert(`✅ Product approved successfully!\n\nThe product "${selectedSubmission.title}" has been published at $${finalPrice} and the seller has been notified.`);
      setShowReviewModal(false);
      fetchSubmissions();
    } catch (error) {
      console.error('Error approving submission:', error);
      alert('Failed to approve product. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;

    try {
      setProcessing(true);

      const { error: updateError } = await supabase
        .from('product_submissions')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason || 'No reason provided'
        })
        .eq('id', selectedSubmission.id);

      if (updateError) throw updateError;

      let notificationMessage = `Unfortunately, your product submission "${selectedSubmission.title}" has been reviewed and could not be approved at this time.\n\n`;
      notificationMessage += `Reason: ${rejectionReason || 'No specific reason provided'}\n\n`;
      notificationMessage += `You can resubmit the product after making the necessary adjustments.`;

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedSubmission.user_id,
          title: '❌ Product Submission Rejected',
          message: notificationMessage,
          type: 'error'
        });

      if (notificationError) console.error('Notification error:', notificationError);

      alert(`❌ Product rejected.\n\nThe seller has been notified with the rejection reason.`);
      setShowReviewModal(false);
      fetchSubmissions();
    } catch (error) {
      console.error('Error rejecting submission:', error);
      alert('Failed to reject product. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateSubmission = async () => {
    if (!selectedSubmission) return;

    try {
      setProcessing(true);

      const { error: updateError } = await supabase
        .from('product_submissions')
        .update({
          title: editedTitle,
          description: editedDescription,
          condition: editedCondition,
          category_id: editedCategoryId,
          images: editedImages
        })
        .eq('id', selectedSubmission.id);

      if (updateError) throw updateError;

      if (selectedSubmission.status === 'approved') {
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .eq('seller_id', selectedSubmission.user_id)
          .eq('title', selectedSubmission.title)
          .maybeSingle();

        if (products) {
          const { error: productError } = await supabase
            .from('products')
            .update({
              title: editedTitle,
              description: editedDescription,
              condition: editedCondition,
              category_id: editedCategoryId,
              image_url: editedImages && editedImages.length > 0 ? editedImages[0] : ''
            })
            .eq('id', products.id);

          if (productError) console.error('Error updating product:', productError);
        }
      }

      alert('✅ Submission updated successfully!');
      setShowReviewModal(false);
      fetchSubmissions();
    } catch (error) {
      console.error('Error updating submission:', error);
      alert('Failed to update submission. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteSubmission = async () => {
    if (!selectedSubmission) return;

    if (!confirm(`⚠️ Are you sure you want to delete this submission?\n\nThis will permanently delete:\n- The submission record\n- The published product (if approved)\n- All related data\n\nThis action cannot be undone!`)) {
      return;
    }

    try {
      setProcessing(true);

      if (selectedSubmission.status === 'approved') {
        const { data: products } = await supabase
          .from('products')
          .select('id, title')
          .eq('seller_id', selectedSubmission.user_id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (products && products.length > 0) {
          const matchingProduct = products.find(p =>
            p.title.toLowerCase() === editedTitle.toLowerCase() ||
            p.title.toLowerCase() === selectedSubmission.title.toLowerCase()
          );

          if (matchingProduct) {
            const { error: productError } = await supabase
              .from('products')
              .delete()
              .eq('id', matchingProduct.id);

            if (productError) {
              console.error('Error deleting product:', productError);
            }
          }
        }
      }

      const { error: submissionError } = await supabase
        .from('product_submissions')
        .delete()
        .eq('id', selectedSubmission.id);

      if (submissionError) throw submissionError;

      alert('✅ Submission deleted successfully!' + (selectedSubmission.status === 'approved' ? '\n\nThe associated product has also been removed from the marketplace.' : ''));
      setShowReviewModal(false);
      fetchSubmissions();
      if (onSubmissionChange) {
        onSubmissionChange();
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
      alert(`Failed to delete submission. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub =>
    sub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>;
      case 'approved':
        return <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case 'rejected':
        return <span className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Submissions</h1>
        <p className="text-gray-600">Review and manage product submissions from sellers</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({submissions.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'pending'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setFilter('approved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'approved'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setFilter('rejected')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === 'rejected'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Rejected
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search submissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading submissions...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No submissions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Seller</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={submission.images[0] || '/placeholder.png'}
                          alt={submission.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{submission.title}</p>
                          <p className="text-sm text-gray-500">{submission.condition}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{submission.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{submission.profiles?.email || ''}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">{submission.categories?.name || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">${submission.price}</p>
                      {submission.final_price && (
                        <p className="text-xs text-emerald-600">Final: ${submission.final_price}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(submission.status)}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">
                        {new Date(submission.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openReviewModal(submission)}
                        className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showReviewModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-6xl w-full my-8 shadow-2xl">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Product Submission Review</h2>
                  <p className="text-emerald-100 mt-1">Submission ID: {selectedSubmission.id.slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(selectedSubmission.status)}
                  <p className="text-emerald-100 text-sm mt-1 flex items-center gap-1 justify-end">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedSubmission.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
              {selectedSubmission.auto_published && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 p-5 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <AlertCircle className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-purple-900">🤖 AI Auto-Published Product</p>
                      <p className="text-sm text-purple-700 mt-1">This product was automatically validated and published by AI</p>
                      {selectedSubmission.ai_suggested_price && (
                        <div className="mt-3 bg-white bg-opacity-60 rounded-lg p-3">
                          <p className="text-xs font-semibold text-purple-800 uppercase">AI Suggested Price</p>
                          <p className="text-2xl font-bold text-purple-600">${selectedSubmission.ai_suggested_price}</p>
                          {selectedSubmission.ai_validation_notes && (
                            <p className="text-xs text-purple-700 mt-2 italic">"{selectedSubmission.ai_validation_notes}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedSubmission.requires_manual_review && selectedSubmission.status === 'pending' && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 p-5 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <AlertCircle className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-yellow-900">⚠️ AI Flagged for Manual Review</p>
                      <p className="text-sm text-yellow-700 mt-1">This product requires admin review</p>
                      {selectedSubmission.ai_validation_notes && (
                        <div className="mt-3 bg-white bg-opacity-60 rounded-lg p-3">
                          <p className="text-xs font-semibold text-yellow-800 uppercase">AI Notes</p>
                          <p className="text-sm text-yellow-900 mt-1">{selectedSubmission.ai_validation_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <div className="flex items-start">
                  <Package className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Edit Product Information</p>
                    <p className="text-xs text-blue-700 mt-1">You can edit all product details at any time</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-600" />
                      Product Details <span className="text-xs text-blue-600 font-normal">(Editable)</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="w-full mt-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-semibold text-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category <span className="text-red-500">*</span></label>
                          <select
                            value={editedCategoryId}
                            onChange={(e) => setEditedCategoryId(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                          >
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Condition <span className="text-red-500">*</span></label>
                          <select
                            value={editedCondition}
                            onChange={(e) => setEditedCondition(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
                          >
                            <option value="New">New</option>
                            <option value="Like New">Like New</option>
                            <option value="Good">Good</option>
                            <option value="Fair">Fair</option>
                            <option value="Poor">Poor</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seller Requested Price</label>
                          <p className="font-bold text-emerald-600 mt-1 text-xl flex items-center gap-1">
                            <DollarSign className="w-5 h-5" />
                            ${selectedSubmission.price}
                          </p>
                        </div>
                        {selectedSubmission.ai_suggested_price && (
                          <div>
                            <label className="text-xs font-semibold text-purple-500 uppercase tracking-wide">🤖 AI Suggested Price</label>
                            <p className="font-bold text-purple-600 mt-1 text-xl flex items-center gap-1">
                              <DollarSign className="w-5 h-5" />
                              ${selectedSubmission.ai_suggested_price}
                            </p>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
                        <textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          rows={4}
                          className="w-full mt-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Product description..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-600" />
                      Product Images <span className="text-xs text-blue-600 font-normal">(Editable)</span>
                    </h3>
                    {editedImages && editedImages.length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          {editedImages.map((img, idx) => (
                            <div key={idx} className="relative group">
                              <img
                                src={img}
                                alt={`Product ${idx + 1}`}
                                className="w-full h-48 object-cover rounded-lg border-2 border-gray-200 group-hover:border-emerald-500 transition"
                              />
                              <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                                {idx + 1}/{editedImages.length}
                              </div>
                              <button
                                onClick={() => handleRemoveImage(idx)}
                                className="absolute top-2 left-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition"
                                title="Remove image"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 space-y-3">
                          <div className="p-3 bg-white border-2 border-dashed border-emerald-300 rounded-lg">
                            <label className="text-xs font-semibold text-emerald-700 uppercase mb-2 block">📁 Upload from Device</label>
                            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium cursor-pointer">
                              <Upload className="w-4 h-4" />
                              {uploadingImage ? 'Uploading...' : 'Choose Image File'}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageFileSelect}
                                disabled={uploadingImage}
                              />
                            </label>
                            <p className="text-xs text-gray-500 mt-2 text-center">PNG, JPG, WEBP (MAX. 5MB)</p>
                          </div>
                          <div className="p-3 bg-white border-2 border-dashed border-gray-300 rounded-lg">
                            <label className="text-xs font-semibold text-gray-600 uppercase">🔗 Or Add Image URL</label>
                            <div className="flex gap-2 mt-2">
                              <input
                                type="url"
                                value={newImageUrl}
                                onChange={(e) => setNewImageUrl(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                placeholder="https://example.com/image.jpg"
                              />
                              <button
                                onClick={handleAddImage}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-100 rounded-lg p-8 text-center">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 mb-3">No images provided</p>
                        <div className="mt-4 space-y-3">
                          <div className="p-3 bg-white border-2 border-dashed border-emerald-300 rounded-lg">
                            <label className="text-xs font-semibold text-emerald-700 uppercase mb-2 block">📁 Upload from Device</label>
                            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium cursor-pointer">
                              <Upload className="w-4 h-4" />
                              {uploadingImage ? 'Uploading...' : 'Choose Image File'}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageFileSelect}
                                disabled={uploadingImage}
                              />
                            </label>
                            <p className="text-xs text-gray-500 mt-2 text-center">PNG, JPG, WEBP (MAX. 5MB)</p>
                          </div>
                          <div className="p-3 bg-white border-2 border-dashed border-gray-300 rounded-lg">
                            <label className="text-xs font-semibold text-gray-600 uppercase">🔗 Or Add Image URL</label>
                            <div className="flex gap-2 mt-2">
                              <input
                                type="url"
                                value={newImageUrl}
                                onChange={(e) => setNewImageUrl(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                placeholder="https://example.com/image.jpg"
                              />
                              <button
                                onClick={handleAddImage}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      Seller Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Full Name</label>
                          <p className="font-semibold text-gray-900">{selectedSubmission.profiles?.full_name || 'Not provided'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Email</label>
                          <p className="font-medium text-gray-900 text-sm break-all">{selectedSubmission.profiles?.email || 'Not provided'}</p>
                        </div>
                      </div>
                      {selectedSubmission.profiles?.phone && (
                        <div className="flex items-start gap-3">
                          <Phone className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Phone</label>
                            <p className="font-medium text-gray-900">{selectedSubmission.profiles.phone}</p>
                          </div>
                        </div>
                      )}
                      {(selectedSubmission.profiles?.address || selectedSubmission.profiles?.city) && (
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Location</label>
                            <p className="font-medium text-gray-900 text-sm">
                              {selectedSubmission.profiles?.address && <span>{selectedSubmission.profiles.address}<br /></span>}
                              {selectedSubmission.profiles?.city && <span>{selectedSubmission.profiles.city}</span>}
                              {selectedSubmission.profiles?.country && <span>, {selectedSubmission.profiles.country}</span>}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedSubmission.status === 'pending' && (
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                        Admin Decision
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Set Final Price ($) <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={finalPrice}
                              onChange={(e) => setFinalPrice(e.target.value)}
                              className="w-full px-4 py-3 border-2 border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-semibold text-lg"
                              placeholder="Enter final selling price"
                              min="0"
                              step="0.01"
                            />
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                              $
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span className="text-gray-600">Seller requested: ${selectedSubmission.price}</span>
                            {finalPrice && parseFloat(finalPrice) !== parseFloat(selectedSubmission.price.toString()) && (
                              <span className={`font-semibold ${parseFloat(finalPrice) > parseFloat(selectedSubmission.price.toString()) ? 'text-red-600' : 'text-green-600'}`}>
                                {parseFloat(finalPrice) > parseFloat(selectedSubmission.price.toString()) ? '+' : ''}
                                ${(parseFloat(finalPrice) - parseFloat(selectedSubmission.price.toString())).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Rejection Reason (if rejecting)
                          </label>
                          <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            rows={3}
                            placeholder="Explain why this product is being rejected (optional but recommended)"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSubmission.status === 'approved' && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-green-900">Product Approved</p>
                          <p className="text-sm text-green-700 mt-1">
                            This product has been approved and published at ${selectedSubmission.final_price || selectedSubmission.price}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedSubmission.status === 'rejected' && selectedSubmission.rejection_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-6 h-6 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-900">Product Rejected</p>
                          <p className="text-sm text-red-700 mt-1 font-medium">Reason:</p>
                          <p className="text-sm text-red-800 mt-1 italic">{selectedSubmission.rejection_reason}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3 justify-between rounded-b-2xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
                  disabled={processing}
                >
                  Close
                </button>
                <button
                  onClick={handleDeleteSubmission}
                  disabled={processing}
                  className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition disabled:opacity-50 flex items-center gap-2 font-semibold"
                >
                  <Trash2 className="w-5 h-5" />
                  {processing ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              {selectedSubmission.status === 'pending' ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleReject}
                    disabled={processing}
                    className="px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition disabled:opacity-50 flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl"
                  >
                    <XCircle className="w-5 h-5" />
                    {processing ? 'Rejecting...' : 'Reject'}
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processing || !finalPrice || parseFloat(finalPrice) <= 0}
                    className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {processing ? 'Publishing...' : 'Approve & Publish'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleUpdateSubmission}
                  disabled={processing}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50 flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl"
                >
                  <Save className="w-5 h-5" />
                  {processing ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

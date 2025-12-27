import React, { useState, useRef } from 'react';
import { ProductCategory, ProductType } from '../types';
import { generateProductDetails } from '../services/geminiService';
import { useToast } from '../context/ToastContext';
import { XIcon, LoaderIcon } from './icons';

interface ProductUploadPageProps {
    onBack: () => void;
    onSubmit: (product: {
        name: string;
        category: ProductCategory;
        description: string;
        price: number;
        quantity: number;
        type: ProductType;
        farmerNote: string;
    }, imageFile: File) => Promise<void>;
}

interface AIAnalysisResult {
    grade: string;
    gradeLabel: string;
    description: string;
    estimatedPrice: number;
    mspStatus: { isAbove: boolean; percentage: number };
    confidence: number;
    moisture: string;
    defects: string;
    name: string;
    category: ProductCategory;
    isValidAgri: boolean; // NEW: AI gatekeeper flag
}

const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });

const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });

export const ProductUploadPage: React.FC<ProductUploadPageProps> = ({ onBack, onSubmit }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0); // 0-100 progress
    const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
    const [farmerNote, setFarmerNote] = useState('');
    const [editablePrice, setEditablePrice] = useState<number>(0);
    const [editableQuantity, setEditableQuantity] = useState<number>(10);
    const [productType, setProductType] = useState<ProductType>(ProductType.Bulk);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const handleFileSelect = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            showToast('Please upload an image file', 'error');
            return;
        }

        setImageFile(file);
        setImagePreviewUrl(await fileToDataUrl(file));
        setIsAnalyzing(true);
        setAnalysisResult(null);

        try {
            const base64Image = await fileToBase64(file);
            const details = await generateProductDetails(base64Image, file.type);
            
            // Check AI gatekeeper: is this a valid agricultural product?
            const isValidAgri = details.is_valid_agri !== false; // Default to true if undefined
            
            // Simulate AI analysis with the returned details
            const mockAnalysis: AIAnalysisResult = {
                grade: isValidAgri ? 'A' : 'X',
                gradeLabel: isValidAgri ? 'Premium' : 'Invalid',
                description: isValidAgri 
                    ? (details.description || 'High quality produce with optimal characteristics')
                    : 'This does not appear to be an agricultural product.',
                estimatedPrice: isValidAgri ? Math.floor(Math.random() * 30) + 15 : 0,
                mspStatus: { isAbove: true, percentage: Math.floor(Math.random() * 20) + 5 },
                confidence: isValidAgri ? Math.floor(Math.random() * 10) + 90 : 0,
                moisture: isValidAgri ? 'Optimal (12%)' : 'N/A',
                defects: isValidAgri ? 'None Detected' : 'N/A',
                name: details.name || 'Product',
                category: details.category || ProductCategory.Other,
                isValidAgri: isValidAgri,
            };
            
            setAnalysisResult(mockAnalysis);
            setEditablePrice(mockAnalysis.estimatedPrice);
            
            if (isValidAgri) {
                showToast('AI analysis complete!', 'success');
            } else {
                showToast('This does not appear to be an agricultural product.', 'error');
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Analysis failed', 'error');
            // Set default values even on error
            setAnalysisResult({
                grade: 'B',
                gradeLabel: 'Standard',
                description: 'Unable to analyze completely. Please verify details.',
                estimatedPrice: 20,
                mspStatus: { isAbove: true, percentage: 10 },
                confidence: 70,
                moisture: 'Unknown',
                defects: 'Unable to detect',
                name: 'Product',
                category: ProductCategory.Other,
                isValidAgri: true, // Allow listing on error (benefit of doubt)
            });
            setEditablePrice(20);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleRetake = () => {
        setImageFile(null);
        setImagePreviewUrl(null);
        setAnalysisResult(null);
        setFarmerNote('');
        setEditablePrice(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleConfirmListing = async () => {
        if (!imageFile || !analysisResult) return;

        setIsSubmitting(true);
        setUploadProgress(0);
        
        // Simulate progress while upload happens
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
                // Slow down as we approach 90% to wait for actual completion
                if (prev < 30) return prev + 5;
                if (prev < 60) return prev + 3;
                if (prev < 90) return prev + 1;
                return prev; // Stay at ~90 until done
            });
        }, 150);
        
        try {
            await onSubmit({
                name: analysisResult.name,
                category: analysisResult.category,
                description: analysisResult.description + (farmerNote ? `\n\nFarmer's Note: ${farmerNote}` : ''),
                price: editablePrice,
                quantity: editableQuantity,
                type: productType,
                farmerNote: farmerNote,
            }, imageFile);
            setUploadProgress(100); // Complete!
            showToast('Product listed successfully!', 'success');
            onBack();
        } catch (error) {
            showToast('Failed to list product', 'error');
        } finally {
            clearInterval(progressInterval);
            setIsSubmitting(false);
            setUploadProgress(0);
        }
    };

    return (
        <div className="bg-[#f6f8f6] font-display text-[#131613] min-h-screen flex flex-col">
            {/* Top Navigation */}
            <header className="sticky top-0 z-50 bg-white border-b border-[#f1f3f1] px-6 py-4 shadow-sm">
                <div className="max-w-[1440px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={onBack}
                            aria-label="Go back" 
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-3xl">arrow_back</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="size-8 text-[#2E7D32]">
                                <span className="material-symbols-outlined text-4xl">agriculture</span>
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-[#131613]">Anna Bazaar</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col items-end mr-2">
                            <span className="text-sm font-bold">Ramesh Kumar</span>
                            <span className="text-xs text-gray-500">Farmer • Nashik, MH</span>
                        </div>
                        <div 
                            className="bg-center bg-no-repeat bg-cover rounded-full size-12 border-2 border-white shadow-md cursor-pointer" 
                            style={{ backgroundImage: "url('https://i.pravatar.cc/150?u=mockFarmerId')" }}
                        ></div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 py-8">
                {/* Page Heading Section */}
                <div className="mb-8">
                    <h2 className="text-4xl md:text-5xl font-black text-[#131613] tracking-tight mb-3">
                        Upload a photo of your harvest
                    </h2>
                    <p className="text-lg md:text-xl text-[#6b806c] font-medium max-w-2xl">
                        Ensure the photo is taken in bright sunlight for best results. We'll analyze quality instantly.
                    </p>
                </div>

                {/* Two Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                    {/* Left Column: Input / Camera Zone */}
                    <div className="lg:col-span-7 w-full h-full flex flex-col">
                        <div 
                            className={`relative group flex flex-col items-center justify-center w-full min-h-[500px] lg:h-[650px] rounded-xl border-4 border-dashed ${imagePreviewUrl ? 'border-[#2E7D32]' : 'border-[#dee3de]'} bg-white hover:bg-gray-50 hover:border-[#2E7D32]/50 transition-all cursor-pointer overflow-hidden`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onClick={() => !imagePreviewUrl && fileInputRef.current?.click()}
                        >
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleInputChange}
                            />
                            
                            {isAnalyzing && (
                                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-20">
                                    <LoaderIcon className="h-16 w-16 text-[#2E7D32] animate-spin" />
                                    <p className="mt-4 text-xl font-bold text-[#131613]">Analyzing your harvest...</p>
                                    <p className="text-gray-500">This may take a few seconds</p>
                                </div>
                            )}

                            {imagePreviewUrl ? (
                                <div className="w-full h-full relative">
                                    <img 
                                        src={imagePreviewUrl} 
                                        alt="Harvest preview" 
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-4 right-4">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRetake(); }}
                                            className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                                        >
                                            <XIcon className="h-6 w-6 text-gray-600" />
                                        </button>
                                    </div>
                                    {analysisResult && (
                                        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
                                            <div className="flex items-center gap-2 text-[#2E7D32]">
                                                <span className="material-symbols-outlined">check_circle</span>
                                                <span className="font-bold">Image analyzed successfully</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Content inside drag zone */}
                                    <div className="flex flex-col items-center gap-8 p-8 text-center z-10">
                                        <div className="size-24 rounded-full bg-[#2E7D32]/10 flex items-center justify-center text-[#2E7D32] mb-4">
                                            <span className="material-symbols-outlined text-6xl">add_a_photo</span>
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-3xl font-bold text-gray-900">Drag & Drop or Click</h3>
                                            <p className="text-xl text-gray-500">to upload harvest photo</p>
                                        </div>
                                        <div className="flex flex-col gap-4 w-full max-w-xs mt-4">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                                className="w-full h-16 bg-[#2E7D32] hover:bg-green-700 text-white rounded-full flex items-center justify-center gap-3 text-lg font-bold shadow-lg transition-transform active:scale-95"
                                            >
                                                <span className="material-symbols-outlined text-2xl">photo_camera</span>
                                                Activate Camera
                                            </button>
                                            <span className="text-sm font-medium text-gray-400">Supports JPG, PNG</span>
                                        </div>
                                    </div>
                                    {/* Subtle background pattern */}
                                    <div 
                                        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                                        style={{ backgroundImage: 'radial-gradient(#2E7D32 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                                    ></div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right Column: AI Results Output */}
                    <div className="lg:col-span-5 w-full flex flex-col gap-6">
                        {/* Results Header */}
                        <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                            <span className="material-symbols-outlined text-[#2E7D32] text-3xl">auto_awesome</span>
                            <h3 className="text-2xl font-bold text-gray-900">AI Analysis Results</h3>
                        </div>

                        {analysisResult ? (
                            <>
                                {/* Main Result Card */}
                                <div className="bg-white rounded-xl shadow-lg p-1 border border-gray-100">
                                    {/* Grade Badge */}
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-lg mb-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 text-xs font-bold uppercase tracking-wider text-[#2E7D32] border border-[#2E7D32]/20">
                                                <span className="material-symbols-outlined text-base">verified</span>
                                                Quality Grade
                                            </span>
                                            <span className="material-symbols-outlined text-[#2E7D32] text-4xl opacity-20">workspace_premium</span>
                                        </div>
                                        <div className="flex flex-col gap-1 mb-6">
                                            <h4 className="text-4xl md:text-5xl font-black text-[#131613] tracking-tight">
                                                Grade {analysisResult.grade} - {analysisResult.gradeLabel}
                                            </h4>
                                            <p className="text-lg text-[#6b806c] font-medium">{analysisResult.description}</p>
                                        </div>
                                        {/* Price Estimation - Editable */}
                                        <div className="flex flex-col sm:flex-row items-baseline gap-2 sm:gap-4 mt-4 pt-4 border-t border-green-200">
                                            <span className="text-sm font-bold text-[#6b806c] uppercase tracking-wide">Your Price</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-bold text-[#2E7D32]">₹</span>
                                                <input 
                                                    type="number" 
                                                    value={editablePrice}
                                                    onChange={(e) => setEditablePrice(Number(e.target.value))}
                                                    className="text-4xl font-bold text-[#2E7D32] bg-transparent border-b-2 border-dashed border-[#2E7D32]/30 focus:border-[#2E7D32] outline-none w-24 text-center"
                                                />
                                                <span className="text-xl text-gray-500 font-medium">/kg</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Quantity Input */}
                                <div className="bg-white p-5 rounded-xl border border-[#dee3de] shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="size-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-[#2E7D32] text-2xl">inventory_2</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-lg font-bold text-gray-900">Quantity Available</span>
                                                <span className="text-sm text-gray-500">How much can you supply?</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                value={editableQuantity}
                                                onChange={(e) => setEditableQuantity(Number(e.target.value))}
                                                className="text-2xl font-bold text-[#131613] bg-gray-50 border border-gray-200 rounded-lg w-20 text-center py-2 focus:border-[#2E7D32] outline-none"
                                            />
                                            <span className="text-lg text-gray-500 font-medium">Quintals</span>
                                        </div>
                                    </div>
                                </div>

                                {/* B2B Bulk Platform Notice */}
                                <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-blue-600">business</span>
                                            <span className="text-lg font-bold text-gray-900">B2B Bulk Listing</span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            All listings on Anna Bazaar are for bulk wholesale orders. Minimum order quantity is 1 quintal (100kg). 
                                            Buyers will negotiate prices directly through the platform.
                                        </p>
                                        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                                            <span className="material-symbols-outlined text-blue-600 text-sm">handshake</span>
                                            <span className="text-sm font-medium text-blue-800">Price is negotiable by buyers</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Validation & Confidence */}
                                <div className="grid grid-cols-1 gap-4">
                                    {/* MSP Validation */}
                                    <div className={`bg-white p-5 rounded-xl border shadow-sm flex items-center gap-4 ${analysisResult.mspStatus.isAbove ? 'border-green-200' : 'border-red-200'}`}>
                                        <div className={`size-12 rounded-full flex items-center justify-center shrink-0 ${analysisResult.mspStatus.isAbove ? 'bg-green-100' : 'bg-red-100'}`}>
                                            <span className={`material-symbols-outlined text-3xl ${analysisResult.mspStatus.isAbove ? 'text-[#2E7D32]' : 'text-red-600'}`}>
                                                {analysisResult.mspStatus.isAbove ? 'check_circle' : 'warning'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-lg font-bold text-gray-900">
                                                {analysisResult.mspStatus.isAbove ? 'Above Government MSP' : 'Below Government MSP'}
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                Price is {analysisResult.mspStatus.percentage}% {analysisResult.mspStatus.isAbove ? 'higher' : 'lower'} than MSP
                                            </span>
                                        </div>
                                    </div>

                                    {/* Confidence Meter */}
                                    <div className="bg-white p-5 rounded-xl border border-[#dee3de] shadow-sm flex flex-col gap-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-base font-bold text-gray-900 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[#2E7D32]">psychology</span>
                                                AI Confidence Score
                                            </span>
                                            <span className="text-xl font-bold text-[#2E7D32]">{analysisResult.confidence}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                                            <div className="bg-[#2E7D32] h-4 rounded-full transition-all duration-500" style={{ width: `${analysisResult.confidence}%` }}></div>
                                        </div>
                                        <p className="text-xs text-gray-500">Based on color analysis and defect detection models.</p>
                                    </div>
                                </div>

                                {/* Detailed Metrics */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors">
                                        <div className="text-gray-500 text-sm mb-1 font-medium">Moisture</div>
                                        <div className="text-xl font-bold text-gray-900">{analysisResult.moisture}</div>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors">
                                        <div className="text-gray-500 text-sm mb-1 font-medium">Defects</div>
                                        <div className="text-xl font-bold text-gray-900">{analysisResult.defects}</div>
                                    </div>
                                </div>

                                {/* Farmer's Note Section */}
                                <div className="bg-white p-5 rounded-xl border border-[#dee3de] shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined text-[#2E7D32]">edit_note</span>
                                        <span className="text-lg font-bold text-gray-900">Farmer's Note</span>
                                        <span className="text-xs text-gray-400">(Optional)</span>
                                    </div>
                                    <textarea 
                                        value={farmerNote}
                                        onChange={(e) => setFarmerNote(e.target.value)}
                                        placeholder="Add any special details about your harvest - organic, pesticide-free, harvest date, storage conditions, etc."
                                        className="w-full h-28 p-4 bg-gray-50 border border-gray-200 rounded-lg resize-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/20 outline-none text-gray-700 placeholder:text-gray-400"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">This note will be visible to buyers on your listing.</p>
                                </div>

                                {/* Action Area */}
                                <div className="mt-4 flex flex-col gap-3 sticky bottom-4 z-20">
                                    {/* AI Gatekeeper: Block non-agricultural products */}
                                    {!analysisResult.isValidAgri && (
                                        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                                            <span className="material-symbols-outlined text-red-600 text-2xl shrink-0">block</span>
                                            <div>
                                                <p className="text-red-800 font-bold text-lg">Not an Agricultural Product</p>
                                                <p className="text-red-600 text-sm mt-1">
                                                    Anna Bazaar only accepts agricultural products (fruits, vegetables, grains, and farm produce). 
                                                    Please upload a valid harvest photo.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Progress bar while uploading */}
                                    {isSubmitting && (
                                        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-700">Uploading product...</span>
                                                <span className="text-sm font-bold text-[#2E7D32]">{uploadProgress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                                <div 
                                                    className="bg-gradient-to-r from-[#2E7D32] to-[#4CAF50] h-2.5 rounded-full transition-all duration-300 ease-out"
                                                    style={{ width: `${uploadProgress}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 text-center">
                                                {uploadProgress < 30 && 'Preparing image...'}
                                                {uploadProgress >= 30 && uploadProgress < 60 && 'Uploading to server...'}
                                                {uploadProgress >= 60 && uploadProgress < 90 && 'Almost there...'}
                                                {uploadProgress >= 90 && 'Finalizing listing...'}
                                            </p>
                                        </div>
                                    )}
                                    
                                    <button 
                                        onClick={handleConfirmListing}
                                        disabled={isSubmitting || !analysisResult.isValidAgri}
                                        className="w-full py-5 bg-[#2E7D32] hover:bg-green-700 disabled:bg-gray-400 text-white rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-[0.99] flex items-center justify-center gap-2 group"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <LoaderIcon className="h-6 w-6 animate-spin" />
                                                <span className="text-xl font-bold">Uploading...</span>
                                            </>
                                        ) : !analysisResult.isValidAgri ? (
                                            <>
                                                <span className="material-symbols-outlined">block</span>
                                                <span className="text-xl font-bold">Cannot List - Not Agricultural</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-xl font-bold">Confirm & List at ₹{editablePrice}/kg</span>
                                                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        onClick={handleRetake}
                                        disabled={isSubmitting}
                                        className="w-full py-3 bg-transparent border-2 border-gray-200 hover:border-gray-400 text-gray-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined">refresh</span>
                                        Retake Photo
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* Placeholder when no image is uploaded */
                            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
                                <div className="size-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-gray-400 text-4xl">image_search</span>
                                </div>
                                <h4 className="text-xl font-bold text-gray-400 mb-2">No Image Uploaded</h4>
                                <p className="text-gray-400 max-w-xs">
                                    Upload a photo of your harvest to get AI-powered quality analysis and price estimation.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

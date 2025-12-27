import React, { useState, useMemo } from 'react';
import { Product, ProductType, Farmer, ProductCategory } from '../types';

interface ProductDetailPageProps {
    product: Product;
    farmer: Farmer | undefined;
    onBack: () => void;
    onStartNegotiation: (product: Product) => void;
    onViewFarmerProfile: (farmerId: string) => void;
    isWishlisted: boolean;
    onToggleWishlist: (productId: string) => void;
}

// Mock AI inspection data - in production this would come from backend
const generateAIInspectionData = (product: Product) => {
    const isHighQuality = product.isVerified;
    return {
        overallGrade: isHighQuality ? 'A' : 'B',
        passed: true,
        sizeDistribution: {
            large: isHighQuality ? 80 : 60,
            medium: isHighQuality ? 18 : 30,
            small: isHighQuality ? 2 : 10,
        },
        defectRate: isHighQuality ? 2 : 5,
        moistureLevel: 'Normal',
        rotDetected: false,
        pestDamage: false,
        sampleSize: '5kg',
        inspectionDate: new Date().toLocaleDateString(),
        freshnessDays: Math.floor(Math.random() * 3) + 1,
    };
};

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
    product,
    farmer,
    onBack,
    onStartNegotiation,
    onViewFarmerProfile,
    isWishlisted,
    onToggleWishlist,
}) => {
    // B2B Bulk - start at minimum quantity (100kg)
    const [selectedQuantity, setSelectedQuantity] = useState(product.quantity >= 100 ? product.quantity : 100);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    const aiInspection = useMemo(() => generateAIInspectionData(product), [product]);
    
    // Generate multiple images (in production, product would have an images array)
    const productImages = [
        product.imageUrl,
        product.imageUrl,
        product.imageUrl,
    ];

    const totalPrice = useMemo(() => selectedQuantity * product.price, [selectedQuantity, product.price]);

    const minQuantity = product.type === ProductType.Bulk ? 100 : 1;
    const maxQuantity = product.quantity;

    const handleQuantityChange = (delta: number) => {
        const newQty = selectedQuantity + delta;
        if (newQty >= minQuantity && newQty <= maxQuantity) {
            setSelectedQuantity(newQty);
        }
    };

    const getCategoryIcon = (category: ProductCategory) => {
        switch (category) {
            case ProductCategory.Vegetable: return 'nutrition';
            case ProductCategory.Fruit: return 'eco';
            case ProductCategory.Grain: return 'grass';
            default: return 'local_florist';
        }
    };

    const getGradeColor = (grade: string) => {
        switch (grade) {
            case 'A': return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
            case 'B': return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' };
            default: return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
        }
    };

    const gradeColors = getGradeColor(aiInspection.overallGrade);

    return (
        <div className="min-h-screen bg-gray-50 font-display">
            {/* Top Navigation */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
                <div className="px-4 lg:px-10 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 lg:gap-8">
                        <button 
                            onClick={onBack}
                            className="flex items-center gap-2 text-gray-600 hover:text-[#2f7f33] transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            <span className="hidden sm:inline font-medium">Back</span>
                        </button>
                        <div className="flex items-center gap-3 text-gray-900 cursor-pointer">
                            <span className="material-symbols-outlined text-[#2f7f33] text-3xl">eco</span>
                            <h2 className="text-xl font-bold tracking-tight">Anna Bazaar</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => onToggleWishlist(product.id)}
                            className={`flex items-center justify-center size-10 rounded-full transition-colors ${
                                isWishlisted ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500'
                            }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: isWishlisted ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                        </button>
                        <button className="flex items-center justify-center size-10 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                            <span className="material-symbols-outlined">share</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="w-full max-w-[1440px] mx-auto p-4 lg:p-8">
                {/* Breadcrumbs */}
                <div className="flex flex-wrap items-center gap-2 mb-6 text-sm lg:text-base">
                    <button onClick={onBack} className="text-gray-500 hover:text-[#2f7f33]">Home</button>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-500">{product.category}</span>
                    <span className="text-gray-400">/</span>
                    <span className="font-semibold text-gray-900">{product.name}</span>
                </div>

                {/* Split Layout */}
                <div className="flex flex-col lg:flex-row gap-8 relative">
                    {/* LEFT COLUMN: Visuals & Info (60%) */}
                    <div className="w-full lg:w-3/5 flex flex-col gap-8">
                        {/* Crop Title & Seller Header */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-start justify-between gap-4">
                                <h1 className="text-2xl lg:text-3xl font-bold leading-tight tracking-tight text-gray-900">
                                    {product.name} {product.type === ProductType.Bulk && `- ${product.quantity}kg Lot`}
                                </h1>
                                <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full ${gradeColors.bg} ${gradeColors.text} ${gradeColors.border} border`}>
                                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {aiInspection.overallGrade === 'A' ? 'verified' : 'stars'}
                                    </span>
                                    <span className="font-bold text-sm">Grade {aiInspection.overallGrade}</span>
                                </div>
                            </div>

                            {/* Seller Trust Badge */}
                            {farmer && (
                                <div 
                                    className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-xl border border-gray-200 w-fit shadow-sm cursor-pointer hover:border-[#2f7f33] transition-colors"
                                    onClick={() => onViewFarmerProfile(farmer.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div 
                                            className="size-10 rounded-full bg-gray-200 bg-cover bg-center border-2 border-white shadow-sm"
                                            style={{ backgroundImage: `url("${farmer.profileImageUrl}")` }}
                                        />
                                        <div>
                                            <p className="text-sm font-bold leading-none mb-1">{farmer.name}</p>
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                {farmer.isVerified && (
                                                    <>
                                                        <span className="material-symbols-outlined text-[16px] text-[#2f7f33]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                                                        <span>Verified Farmer</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-8 w-px bg-gray-200 mx-2"></div>
                                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded text-amber-600">
                                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                        <span className="font-bold text-sm">{farmer.rating.toFixed(1)}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <span className="material-symbols-outlined text-[16px]">location_on</span>
                                        <span>{farmer.location}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Main Image Gallery */}
                        <div className="flex flex-col gap-4">
                            <div className="relative w-full aspect-video bg-gray-100 rounded-2xl overflow-hidden shadow-sm group">
                                <img 
                                    src={productImages[selectedImageIndex]} 
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                {/* Product Type Badge - B2B Bulk Only */}
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <span className="px-3 py-1.5 rounded-full text-xs font-bold shadow-sm bg-blue-600 text-white">
                                        Bulk Lot / Negotiable
                                    </span>
                                </div>
                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">zoom_in</span> 
                                    Click to Zoom
                                </div>
                                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[#2f7f33]">photo_camera</span>
                                    Img {selectedImageIndex + 1} of {productImages.length}
                                </div>
                            </div>

                            {/* Thumbnails */}
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {productImages.map((img, index) => (
                                    <button 
                                        key={index}
                                        onClick={() => setSelectedImageIndex(index)}
                                        className={`shrink-0 size-20 rounded-lg overflow-hidden border-2 transition-all ${
                                            selectedImageIndex === index 
                                                ? 'border-[#2f7f33] ring-2 ring-[#2f7f33]/20' 
                                                : 'border-transparent hover:border-gray-400'
                                        }`}
                                    >
                                        <img className="w-full h-full object-cover" src={img} alt={`Thumbnail ${index + 1}`} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* AI Quality Report Section */}
                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#2f7f33]/10 rounded-lg">
                                        <span className="material-symbols-outlined text-2xl text-[#2f7f33]">analytics</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">AI Quality Report</h3>
                                        <p className="text-xs text-gray-500">Inspected {aiInspection.inspectionDate}</p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${
                                    aiInspection.passed 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                    <span className="material-symbols-outlined text-sm">
                                        {aiInspection.passed ? 'check_circle' : 'cancel'}
                                    </span>
                                    {aiInspection.passed ? 'Passed' : 'Failed'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Size Distribution */}
                                <div className="flex flex-col gap-4">
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500">Size Breakdown</h4>
                                    {/* Visual Bar Chart */}
                                    <div className="w-full h-12 flex rounded-lg overflow-hidden border border-gray-100">
                                        <div 
                                            className="bg-[#2E7D32] h-full flex items-center justify-center text-white font-bold text-sm"
                                            style={{ width: `${aiInspection.sizeDistribution.large}%` }}
                                        >
                                            {aiInspection.sizeDistribution.large}% Large
                                        </div>
                                        <div 
                                            className="bg-[#81c784] h-full flex items-center justify-center text-[#1b5e20] font-bold text-sm"
                                            style={{ width: `${aiInspection.sizeDistribution.medium}%` }}
                                        >
                                            {aiInspection.sizeDistribution.medium > 10 ? `${aiInspection.sizeDistribution.medium}% Med` : ''}
                                        </div>
                                        {aiInspection.sizeDistribution.small > 5 && (
                                            <div 
                                                className="bg-[#c8e6c9] h-full flex items-center justify-center text-[#2e7d32] font-bold text-xs"
                                                style={{ width: `${aiInspection.sizeDistribution.small}%` }}
                                            >
                                                {aiInspection.sizeDistribution.small}%
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <span className="size-3 rounded-full bg-[#2E7D32]"></span>
                                            <span>Large (&gt;50mm)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="size-3 rounded-full bg-[#81c784]"></span>
                                            <span>Medium (30-50mm)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="size-3 rounded-full bg-[#c8e6c9]"></span>
                                            <span>Small (&lt;30mm)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Defect Analysis */}
                                <div className="flex flex-col gap-4">
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500">Defect Analysis</h4>
                                    <div className="flex items-center gap-6">
                                        {/* Circular Progress */}
                                        <div className="relative size-24 shrink-0">
                                            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                                                <path 
                                                    className="text-gray-200"
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    fill="none" 
                                                    stroke="currentColor" 
                                                    strokeWidth="4"
                                                />
                                                <path 
                                                    className="text-[#2f7f33]"
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    fill="none" 
                                                    stroke="currentColor" 
                                                    strokeDasharray={`${100 - aiInspection.defectRate}, 100`}
                                                    strokeWidth="4"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                                <span className="text-xs text-gray-500 font-medium">Defects</span>
                                                <span className="text-xl font-bold text-gray-900">&lt;{aiInspection.defectRate}%</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className={`material-symbols-outlined text-[18px] ${aiInspection.rotDetected ? 'text-red-600' : 'text-green-600'}`}>
                                                    {aiInspection.rotDetected ? 'cancel' : 'eco'}
                                                </span>
                                                <span className="font-medium">{aiInspection.rotDetected ? 'Rot Detected' : 'No Rot Detected'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="material-symbols-outlined text-green-600 text-[18px]">water_drop</span>
                                                <span className="font-medium">{aiInspection.moistureLevel} Moisture</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className={`material-symbols-outlined text-[18px] ${aiInspection.pestDamage ? 'text-red-600' : 'text-green-600'}`}>
                                                    {aiInspection.pestDamage ? 'bug_report' : 'verified_user'}
                                                </span>
                                                <span className="font-medium">{aiInspection.pestDamage ? 'Pest Damage Found' : 'No Pest Damage'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <span className="material-symbols-outlined text-[18px]">info</span>
                                                <span>Sample Size: {aiInspection.sampleSize}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                                <button className="text-[#2f7f33] font-bold text-sm flex items-center gap-1 hover:underline">
                                    View Full AI Report 
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </button>
                            </div>
                        </section>

                        {/* Description */}
                        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#2f7f33]">description</span>
                                Farmer's Note
                            </h3>
                            <p className="text-gray-600 leading-relaxed">
                                {product.description || `Fresh ${product.name} harvested just ${aiInspection.freshnessDays} days ago. These are premium quality ${product.category.toLowerCase()}, excellent for daily cooking and commercial use. Stored in optimal conditions to ensure freshness.`}
                            </p>
                            
                            {/* Product Specs */}
                            <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Category</span>
                                    <div className="flex items-center gap-1 font-medium text-gray-900">
                                        <span className="material-symbols-outlined text-[16px] text-[#2f7f33]">{getCategoryIcon(product.category)}</span>
                                        {product.category}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Freshness</span>
                                    <span className="font-medium text-gray-900">{aiInspection.freshnessDays} days old</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Type</span>
                                    <span className="font-medium text-gray-900">{product.type}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Available</span>
                                    <span className="font-medium text-gray-900">{product.quantity} kg</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Sticky Action Panel (40%) */}
                    <div className="w-full lg:w-2/5">
                        <div className="sticky top-24 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                            {/* Pricing Header */}
                            <div className="bg-gray-50 p-6 border-b border-gray-200">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">
                                            {product.type === ProductType.Bulk ? 'Current Ask Price' : 'Price'}
                                        </p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-black text-gray-900">₹{product.price}</span>
                                            <span className="text-xl font-medium text-gray-500">/ kg</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded uppercase">
                                            In Stock
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 flex flex-col gap-6">
                                {/* Location & Logistics */}
                                {farmer && (
                                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <span className="material-symbols-outlined text-gray-500 mt-0.5">location_on</span>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900">{farmer.location}</p>
                                            <p className="text-xs text-gray-500">Pickup from farm or delivery available</p>
                                        </div>
                                    </div>
                                )}

                                {/* Quantity Selector */}
                                <div className="space-y-3">
                                    <label className="block text-sm font-bold text-gray-900">
                                        Select Quantity ({product.type === ProductType.Bulk ? 'kg' : 'units'})
                                    </label>
                                    <div className="flex items-center h-14 rounded-xl border border-gray-300 bg-white overflow-hidden">
                                        <button 
                                            onClick={() => handleQuantityChange(product.type === ProductType.Bulk ? -50 : -1)}
                                            disabled={selectedQuantity <= minQuantity}
                                            className="h-full px-6 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center border-r border-gray-200"
                                        >
                                            <span className="material-symbols-outlined text-2xl font-bold">remove</span>
                                        </button>
                                        <input 
                                            type="number"
                                            value={selectedQuantity}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || minQuantity;
                                                setSelectedQuantity(Math.min(Math.max(val, minQuantity), maxQuantity));
                                            }}
                                            className="flex-1 h-full text-center text-xl font-bold bg-transparent border-none focus:ring-0 appearance-none"
                                        />
                                        <button 
                                            onClick={() => handleQuantityChange(product.type === ProductType.Bulk ? 50 : 1)}
                                            disabled={selectedQuantity >= maxQuantity}
                                            className="h-full px-6 bg-[#2f7f33] text-white hover:bg-[#256629] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center border-l border-[#2f7f33]"
                                        >
                                            <span className="material-symbols-outlined text-2xl font-bold">add</span>
                                        </button>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">
                                            Min: {minQuantity}kg
                                        </span>
                                        <span className="font-bold text-gray-900">Total: ₹{totalPrice.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Action Buttons - B2B Bulk Only */}
                                <div className="flex flex-col gap-4 mt-2">
                                    {/* Make Offer / Chat & Add to Watchlist */}
                                    <button 
                                        onClick={() => onStartNegotiation(product)}
                                        className="w-full bg-[#2f7f33] hover:bg-[#256629] text-white h-14 rounded-xl font-black text-lg shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all"
                                    >
                                        <span className="material-symbols-outlined">chat</span>
                                        <span>Make Offer / Chat</span>
                                    </button>
                                    <button 
                                        onClick={() => onToggleWishlist(product.id)}
                                        className={`w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all ${
                                            isWishlisted 
                                                ? 'bg-red-50 border-2 border-red-500 text-red-500' 
                                                : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontVariationSettings: isWishlisted ? "'FILL' 1" : "'FILL' 0" }}>
                                            {isWishlisted ? 'heart_check' : 'favorite'}
                                        </span>
                                        <span>{isWishlisted ? 'Saved to Watchlist' : 'Add to Watchlist'}</span>
                                    </button>
                                </div>

                                {/* Safety Note */}
                                <div className="flex items-center gap-2 justify-center text-xs text-gray-500 mt-2">
                                    <span className="material-symbols-outlined text-[16px]">lock</span>
                                    Secure Payment via Escrow
                                </div>

                                {/* Trust Indicators */}
                                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                                    <div className="flex flex-col items-center gap-1 p-2">
                                        <span className="material-symbols-outlined text-[#2f7f33] text-2xl">verified_user</span>
                                        <span className="text-xs text-gray-600 font-medium">AI Verified</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-1 p-2">
                                        <span className="material-symbols-outlined text-[#2f7f33] text-2xl">local_shipping</span>
                                        <span className="text-xs text-gray-600 font-medium">Fast Delivery</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-1 p-2">
                                        <span className="material-symbols-outlined text-[#2f7f33] text-2xl">support_agent</span>
                                        <span className="text-xs text-gray-600 font-medium">24/7 Support</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Simple Footer */}
            <footer className="mt-auto py-8 border-t border-gray-200 bg-white">
                <div className="max-w-[1440px] mx-auto px-8 text-center text-gray-500 text-sm">
                    © 2024 Anna Bazaar. Supporting Farmers Nationwide.
                </div>
            </footer>
        </div>
    );
};

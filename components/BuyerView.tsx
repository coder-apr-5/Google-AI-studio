import React, { useState, useMemo } from 'react';
import { Product, Negotiation, ProductType, NegotiationStatus, ProductCategory, Farmer, ChatMessage, User } from '../types';
import { XIcon } from './icons';
import { ProductDetailPage } from './ProductDetailPage';
import { BuyerNegotiationConsole } from './BuyerNegotiationConsole';
import { ProductCardSkeleton } from './ProductCardSkeleton';
import { firebaseService } from '../services/firebaseService';

// B2B Platform - Cart functionality removed, all purchases via negotiation
interface BuyerViewProps {
    products: Product[];
    negotiations: Negotiation[];
    messages: ChatMessage[];
    currentUserId: string;
    currentUser: User;
    onStartNegotiation: (product: Product) => void;
    onRespondToCounter: (negotiationId: string, response: 'Accepted' | 'Rejected') => void;
    onOpenChat: (negotiation: Negotiation) => void;
    onSendMessage: (negotiationId: string, text: string) => void;
    onStartCall?: (negotiationId: string) => void;
    wishlist: string[];
    onToggleWishlist: (productId: string) => void;
    farmers: Farmer[];
    onViewFarmerProfile: (farmerId: string) => void;
    onSwitchRole: () => void;
    isLoadingProducts?: boolean;
}

export const BuyerView = ({ 
    products, 
    negotiations,
    messages,
    currentUserId,
    currentUser,
    onStartNegotiation, 
    onRespondToCounter, 
    onOpenChat,
    onSendMessage,
    onStartCall,
    wishlist, 
    onToggleWishlist, 
    farmers, 
    onViewFarmerProfile,
    onSwitchRole,
    isLoadingProducts = false
}: BuyerViewProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<ProductCategory | 'All'>('All');
    // B2B platform - always show bulk listings only
    const [filterType] = useState<'Bulk'>('Bulk');
    const [sortOrder, setSortOrder] = useState<'relevance' | 'price-asc' | 'price-desc'>('relevance');
    const [selectedGrades, setSelectedGrades] = useState<string[]>(['A', 'B']);
    const [priceRange, setPriceRange] = useState({ min: 0, max: 500 });
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showNegotiationsPanel, setShowNegotiationsPanel] = useState(false);
    const [activeNegotiationId, setActiveNegotiationId] = useState<string | null>(null);

    const farmerMap = useMemo(() => new Map(farmers.map(f => [f.id, f])), [farmers]);

    const displayedProducts = useMemo(() => {
        let filtered = [...products];

        if (searchQuery.trim() !== '') {
            const lowercasedQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(lowercasedQuery) ||
                p.category.toLowerCase().includes(lowercasedQuery)
            );
        }

        if (filterCategory !== 'All') {
            filtered = filtered.filter(p => p.category === filterCategory);
        }

        // B2B bulk only - show all products (all go through negotiation now)
        filtered = filtered.filter(p => p.type === ProductType.Bulk);

        filtered = filtered.filter(p => p.price >= priceRange.min && p.price <= priceRange.max);

        // Filter by grade
        filtered = filtered.filter(p => {
            const grade = p.isVerified ? 'A' : 'B';
            return selectedGrades.includes(grade);
        });

        if (sortOrder === 'price-asc') {
            filtered.sort((a, b) => a.price - b.price);
        } else if (sortOrder === 'price-desc') {
            filtered.sort((a, b) => b.price - a.price);
        }
        
        return filtered;
    }, [products, filterCategory, sortOrder, searchQuery, priceRange, selectedGrades]);

    const categoryChips = [
        { id: 'All', label: 'All', icon: 'grid_view' },
        { id: ProductCategory.Vegetable, label: 'Vegetables', icon: 'nutrition' },
        { id: ProductCategory.Fruit, label: 'Fruits', icon: 'eco' },
        { id: ProductCategory.Grain, label: 'Grains', icon: 'grass' },
        { id: ProductCategory.Other, label: 'Other', icon: 'local_florist' },
    ];

    const getGradeInfo = (product: Product) => {
        if (product.isVerified) {
            return { grade: 'A', bgClass: 'bg-[#2f7f33]', textClass: 'text-white', icon: 'verified' };
        }
        return { grade: 'B', bgClass: 'bg-yellow-500', textClass: 'text-black', icon: 'stars' };
    };

    const toggleGrade = (grade: string) => {
        setSelectedGrades(prev => 
            prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
        );
    };

    // If a product is selected, show the detail page
    if (selectedProduct) {
        const selectedFarmer = farmerMap.get(selectedProduct.farmerId);
        return (
            <ProductDetailPage
                product={selectedProduct}
                farmer={selectedFarmer}
                onBack={() => setSelectedProduct(null)}
                onStartNegotiation={(product) => {
                    onStartNegotiation(product);
                    setSelectedProduct(null);
                }}
                onViewFarmerProfile={onViewFarmerProfile}
                isWishlisted={wishlist.includes(selectedProduct.id)}
                onToggleWishlist={onToggleWishlist}
            />
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-display -mx-4 -my-4 sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8">
            {/* Top Navigation Bar - Mobile First */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-8 py-2 sm:py-3 shadow-sm">
                <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center justify-between gap-2 sm:gap-4">
                    {/* Logo & Brand */}
                    <div className="flex items-center gap-2 sm:gap-4 w-full lg:w-auto justify-between lg:justify-start">
                        <div className="flex items-center gap-2 sm:gap-3 text-gray-900 cursor-pointer">
                            <span className="material-symbols-outlined text-2xl sm:text-3xl lg:text-4xl text-[#2f7f33]">agriculture</span>
                            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight">Anna Bazaar</h1>
                        </div>
                        {/* Mobile Menu Button */}
                        <button className="lg:hidden p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
                            <span className="material-symbols-outlined text-xl">menu</span>
                        </button>
                    </div>

                    {/* Search & Location */}
                    <div className="flex flex-1 items-center gap-2 sm:gap-4 w-full max-w-3xl">
                        {/* Location Selector - Hidden on mobile */}
                        <button className="hidden md:flex items-center gap-2 whitespace-nowrap bg-gray-100 hover:bg-gray-200 px-3 lg:px-4 h-10 lg:h-12 rounded-lg border border-gray-200 transition-colors">
                            <span className="material-symbols-outlined text-[#2f7f33]">location_on</span>
                            <div className="flex flex-col items-start leading-tight">
                                <span className="text-xs text-gray-500 font-medium">Deliver to</span>
                                <span className="text-sm font-bold truncate max-w-[120px] text-gray-900">WB, 700001</span>
                            </div>
                            <span className="material-symbols-outlined text-sm ml-1 text-gray-500">expand_more</span>
                        </button>

                        {/* Search Bar */}
                        <label className="flex w-full items-center h-10 sm:h-12 rounded-lg bg-gray-100 border border-gray-200 focus-within:border-[#2f7f33] focus-within:ring-2 focus-within:ring-[#2f7f33]/20 overflow-hidden transition-all shadow-sm">
                            <div className="flex items-center justify-center pl-3 sm:pl-4 text-gray-500">
                                <span className="material-symbols-outlined text-xl sm:text-2xl">search</span>
                            </div>
                            <input 
                                className="w-full h-full bg-transparent border-none focus:ring-0 px-2 sm:px-4 text-sm sm:text-base placeholder:text-gray-400 text-gray-900" 
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </label>
                    </div>

                    {/* Right Actions */}
                    <div className="hidden lg:flex items-center gap-6">
                        <nav className="flex items-center gap-6">
                            <a className="text-sm font-semibold hover:text-[#2f7f33] transition-colors" href="#">Home</a>
                            <a className="text-sm font-semibold hover:text-[#2f7f33] transition-colors" href="#">My Orders</a>
                            <button 
                                onClick={() => setShowNegotiationsPanel(true)}
                                className="text-sm font-semibold hover:text-[#2f7f33] transition-colors relative"
                            >
                                Negotiations
                                {negotiations.length > 0 && (
                                    <span className="absolute -top-2 -right-4 bg-[#2f7f33] text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                        {negotiations.length}
                                    </span>
                                )}
                            </button>
                        </nav>
                        <div className="flex items-center gap-3">
                            <button className="flex items-center justify-center size-10 rounded-full bg-gray-100 hover:bg-[#2f7f33]/10 text-gray-700 transition-colors">
                                <span className="material-symbols-outlined">help</span>
                            </button>
                            <button className="flex items-center justify-center size-10 rounded-full bg-gray-100 hover:bg-[#2f7f33]/10 text-gray-700 transition-colors">
                                <span className="material-symbols-outlined">notifications</span>
                            </button>
                            {/* Role Toggle Switch */}
                            <button 
                                onClick={onSwitchRole}
                                className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors border border-gray-200"
                            >
                                <span className="text-sm font-medium text-gray-500">Farmer</span>
                                <div className="relative w-12 h-6 bg-[#2f7f33] rounded-full transition-colors">
                                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[#2f7f33] text-xs">shopping_bag</span>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-[#2f7f33]">Buyer</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 w-full max-w-7xl mx-auto px-0 sm:px-2 lg:px-4">
                {/* Left Sidebar (Filters) - Hidden on mobile */}
                <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 border-r border-gray-200 bg-white p-4 xl:p-6 h-[calc(100vh-70px)] sticky top-[70px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                            <span className="material-symbols-outlined text-[#2f7f33]">filter_alt</span>
                            Filters
                        </h2>
                        <button 
                            onClick={() => {
                                setFilterCategory('All');
                                setSelectedGrades(['A', 'B']);
                                setPriceRange({ min: 0, max: 500 });
                            }}
                            className="text-sm text-[#2f7f33] font-medium hover:underline"
                        >
                            Reset All
                        </button>
                    </div>

                    {/* B2B Platform Notice */}
                    <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                            <span className="material-symbols-outlined text-[18px]">business</span>
                            B2B Bulk Platform
                        </div>
                        <p className="text-xs text-blue-600 mt-1">All listings are bulk wholesale with minimum 100kg orders.</p>
                    </div>

                    {/* Crop Category */}
                    <div className="mb-8">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Crop Category</h3>
                        <div className="space-y-2">
                            {Object.values(ProductCategory).map(cat => (
                                <label key={cat} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer group">
                                    <input 
                                        type="checkbox" 
                                        checked={filterCategory === cat}
                                        onChange={() => setFilterCategory(filterCategory === cat ? 'All' : cat)}
                                        className="rounded border-gray-300 text-[#2f7f33] focus:ring-[#2f7f33] w-5 h-5"
                                    />
                                    <span className="flex-1 font-medium text-gray-700 group-hover:text-[#2f7f33] transition-colors">{cat}</span>
                                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                        {products.filter(p => p.category === cat).length}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Price Range */}
                    <div className="mb-8">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Price Range (₹/kg)</h3>
                        <div className="px-2">
                            <div className="flex gap-4 mb-4">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">Min</label>
                                    <input 
                                        type="number" 
                                        value={priceRange.min}
                                        onChange={(e) => setPriceRange(prev => ({ ...prev, min: Number(e.target.value) }))}
                                        className="w-full bg-gray-100 border border-gray-200 rounded-lg text-gray-900 text-sm py-2 px-3"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500">Max</label>
                                    <input 
                                        type="number" 
                                        value={priceRange.max}
                                        onChange={(e) => setPriceRange(prev => ({ ...prev, max: Number(e.target.value) }))}
                                        className="w-full bg-gray-100 border border-gray-200 rounded-lg text-gray-900 text-sm py-2 px-3"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quality Grade */}
                    <div className="mb-8">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">AI Quality Grade</h3>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={selectedGrades.includes('A')}
                                    onChange={() => toggleGrade('A')}
                                    className="rounded border-gray-300 text-[#2f7f33] focus:ring-[#2f7f33] w-5 h-5"
                                />
                                <div className="flex items-center gap-2 px-3 py-1 rounded bg-green-100 border border-green-300">
                                    <span className="material-symbols-outlined text-[#2f7f33] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                                    <span className="text-sm font-bold text-green-700">Grade A</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={selectedGrades.includes('B')}
                                    onChange={() => toggleGrade('B')}
                                    className="rounded border-gray-300 text-[#2f7f33] focus:ring-[#2f7f33] w-5 h-5"
                                />
                                <div className="flex items-center gap-2 px-3 py-1 rounded bg-yellow-100 border border-yellow-300">
                                    <span className="material-symbols-outlined text-yellow-600 text-sm">stars</span>
                                    <span className="text-sm font-bold text-yellow-700">Grade B</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 p-3 sm:p-4 lg:p-6 xl:p-8 overflow-x-hidden">
                    {/* Quick Filter Chips - Horizontal scroll on mobile */}
                    <div className="flex gap-2 sm:gap-3 pb-4 sm:pb-6 overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                        {categoryChips.map(chip => (
                            <button 
                                key={chip.id}
                                onClick={() => setFilterCategory(chip.id as ProductCategory | 'All')}
                                className={`flex shrink-0 items-center justify-center gap-x-1.5 sm:gap-x-2 rounded-full h-8 sm:h-10 pl-2.5 sm:pl-3 pr-3 sm:pr-5 text-xs sm:text-sm font-medium transition-all active:scale-95 ${
                                    filterCategory === chip.id 
                                        ? 'bg-[#2f7f33] text-white shadow-md' 
                                        : 'bg-white border border-gray-200 hover:border-[#2f7f33] text-gray-600 hover:text-[#2f7f33]'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{chip.icon}</span>
                                {chip.label}
                            </button>
                        ))}
                    </div>

                    {/* Results Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                                {filterCategory === 'All' ? 'All Products' : filterCategory}
                                {' - Bulk Lots'}
                            </h2>
                            <p className="text-sm text-gray-500">Found {displayedProducts.length} listings</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-gray-200 p-1 rounded-lg">
                            <span className="text-sm px-3 text-gray-500">Sort by:</span>
                            <select 
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                                className="bg-transparent border-none text-sm font-bold focus:ring-0 py-1 pl-0 pr-8 cursor-pointer text-gray-900"
                            >
                                <option value="relevance">Relevance</option>
                                <option value="price-asc">Price: Low to High</option>
                                <option value="price-desc">Price: High to Low</option>
                            </select>
                        </div>
                    </div>

                    {/* Listings Grid - Mobile First: 1 col -> 2 col -> 3 col -> 4 col */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                        {/* Show skeletons while loading */}
                        {isLoadingProducts && (
                            <>
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <ProductCardSkeleton key={`skeleton-${i}`} />
                                ))}
                            </>
                        )}
                        
                        {/* Show products when loaded */}
                        {!isLoadingProducts && displayedProducts.map(product => {
                            const farmer = farmerMap.get(product.farmerId);
                            const gradeInfo = getGradeInfo(product);
                            const isWishlisted = wishlist.includes(product.id);

                            return (
                                <div 
                                    key={product.id}
                                    onClick={() => setSelectedProduct(product)}
                                    className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-[#2f7f33]/50 flex flex-col cursor-pointer"
                                >
                                    <div className="relative aspect-[4/3] w-full bg-gray-100 overflow-hidden">
                                        <img 
                                            src={product.imageUrl} 
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        {/* Badges */}
                                        <div className="absolute top-3 left-3 flex flex-col gap-2">
                                            <span className={`${gradeInfo.bgClass} ${gradeInfo.textClass} text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1`}>
                                                <span className="material-symbols-outlined text-[16px]">{gradeInfo.icon}</span>
                                                AI Grade {gradeInfo.grade}
                                            </span>
                                            {/* B2B Platform - All products are negotiable bulk lots */}
                                            <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                                                Bulk Lot - Negotiable
                                            </span>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }}
                                            className={`absolute top-3 right-3 size-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
                                                isWishlisted ? 'bg-red-500 text-white' : 'bg-black/40 text-white hover:bg-[#2f7f33]'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isWishlisted ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                                        </button>
                                    </div>
                                    <div className="p-4 flex flex-col flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-lg leading-tight line-clamp-1 text-gray-900">{product.name}</h3>
                                        </div>
                                        <div className="flex items-baseline gap-1 mb-3">
                                            <span className="text-2xl font-extrabold text-gray-900">₹{product.price}</span>
                                            <span className="text-sm font-medium text-gray-500">/kg</span>
                                        </div>
                                        <div className="flex flex-col gap-2 mb-4 text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[18px]">person</span>
                                                <span 
                                                    className="hover:text-[#2f7f33] cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); farmer && onViewFarmerProfile(farmer.id); }}
                                                >
                                                    {farmer?.name || 'Unknown Farmer'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[18px] text-[#2f7f33]">location_on</span>
                                                <span className="font-medium text-gray-900">{farmer?.location || 'Unknown'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs bg-blue-50 w-fit px-2 py-1 rounded text-blue-700 border border-blue-200">
                                                <span className="material-symbols-outlined text-[14px]">business</span>
                                                Bulk: Min {product.quantity >= 100 ? product.quantity : 100}kg
                                            </div>
                                        </div>
                                        <div className="mt-auto pt-3 border-t border-gray-200">
                                            {/* B2B Platform - All products are negotiable */}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onStartNegotiation(product); }}
                                                className="w-full h-10 rounded-lg border-2 border-[#2f7f33] text-[#2f7f33] font-bold hover:bg-[#2f7f33] hover:text-white transition-all flex items-center justify-center gap-2 group/btn"
                                            >
                                                Start Bulk Negotiation
                                                <span className="material-symbols-outlined text-lg group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {displayedProducts.length === 0 && (
                        <div className="text-center py-20">
                            <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">search_off</span>
                            <h3 className="text-xl font-bold text-gray-600 mb-2">No bulk listings found</h3>
                            <p className="text-gray-500">Try adjusting your filters or search query</p>
                        </div>
                    )}

                    {/* Load More */}
                    {displayedProducts.length > 0 && (
                        <div className="flex justify-center mt-12 mb-8">
                            <button className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-bold text-[#2f7f33] transition-colors shadow-sm">
                                <span className="material-symbols-outlined">autorenew</span>
                                Load More Listings
                            </button>
                        </div>
                    )}
                </main>
            </div>

            {/* Negotiations Slide-out Panel */}
            {showNegotiationsPanel && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowNegotiationsPanel(false)}></div>
                    <div className="ml-auto w-full max-w-md bg-white h-full overflow-y-auto relative z-10 shadow-2xl">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">My Negotiations</h2>
                            <button 
                                onClick={() => setShowNegotiationsPanel(false)}
                                className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                            >
                                <XIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            {negotiations.length === 0 ? (
                                <div className="text-center py-10">
                                    <span className="material-symbols-outlined text-5xl text-gray-300 mb-2">handshake</span>
                                    <p className="text-gray-500">No active negotiations</p>
                                </div>
                            ) : (
                                negotiations.map(neg => (
                                    <div 
                                        key={neg.id}
                                        className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                                    >
                                        <div className="flex gap-4">
                                            <img 
                                                src={neg.productImageUrl} 
                                                alt={neg.productName}
                                                className="w-20 h-20 rounded-lg object-cover"
                                            />
                                            <div className="flex-1">
                                                <h3 className="font-bold text-lg text-gray-900">{neg.productName}</h3>
                                                <p className="text-sm text-gray-500">Quantity: {neg.quantity} kg</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                        neg.status === NegotiationStatus.Pending ? 'bg-yellow-500/20 text-yellow-500' :
                                                        (neg.status === NegotiationStatus.CounterByFarmer || neg.status === NegotiationStatus.CounterOffer) ? 'bg-blue-500/20 text-blue-500' :
                                                        neg.status === NegotiationStatus.CounterByBuyer ? 'bg-orange-500/20 text-orange-500' :
                                                        neg.status === NegotiationStatus.Accepted ? 'bg-green-500/20 text-green-500' :
                                                        'bg-red-500/20 text-red-500'
                                                    }`}>
                                                        {neg.status === NegotiationStatus.CounterByFarmer || neg.status === NegotiationStatus.CounterOffer 
                                                            ? 'Counter from Farmer' 
                                                            : neg.status === NegotiationStatus.CounterByBuyer 
                                                                ? 'Your Counter' 
                                                                : neg.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-gray-500">Your Offer</p>
                                                <p className="text-lg font-bold text-[#2f7f33]">₹{neg.offeredPrice}/kg</p>
                                            </div>
                                            {neg.counterPrice && (
                                                <div>
                                                    <p className="text-xs text-gray-500">Counter</p>
                                                    <p className="text-lg font-bold text-blue-600">₹{neg.counterPrice}/kg</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 flex gap-2">
                                            <button 
                                                onClick={() => setActiveNegotiationId(neg.id)}
                                                className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-lg">chat</span>
                                                Chat
                                            </button>
                                            {(neg.status === NegotiationStatus.CounterByFarmer || neg.status === NegotiationStatus.CounterOffer) && (
                                                <>
                                                    <button 
                                                        onClick={() => onRespondToCounter(neg.id, 'Accepted')}
                                                        className="py-2 px-4 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition-colors"
                                                    >
                                                        Accept
                                                    </button>
                                                    <button 
                                                        onClick={() => onRespondToCounter(neg.id, 'Rejected')}
                                                        className="py-2 px-4 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Buyer Negotiation Console */}
            {activeNegotiationId && (
                <BuyerNegotiationConsole
                    negotiation={negotiations.find(n => n.id === activeNegotiationId)!}
                    farmer={farmerMap.get(negotiations.find(n => n.id === activeNegotiationId)?.farmerId!)}
                    messages={messages.filter(m => m.negotiationId === activeNegotiationId)}
                    currentUserId={currentUserId}
                    currentUser={currentUser}
                    onClose={() => setActiveNegotiationId(null)}
                    onSendMessage={(text) => {
                        if (activeNegotiationId) {
                            onSendMessage(activeNegotiationId, text);
                        }
                    }}
                    onStartCall={onStartCall}
                    onUpdateOffer={async (price, quantity) => {
                        if (activeNegotiationId) {
                            try {
                                await firebaseService.updateNegotiation(activeNegotiationId, {
                                    offeredPrice: price,
                                    quantity: quantity,
                                    status: NegotiationStatus.CounterByBuyer,
                                    lastUpdated: new Date(),
                                });
                            } catch (error) {
                                console.error('Failed to update offer:', error);
                            }
                        }
                    }}
                    onAcceptOffer={() => {
                        if (activeNegotiationId) {
                            onRespondToCounter(activeNegotiationId, 'Accepted');
                            setActiveNegotiationId(null);
                        }
                    }}
                    onDeclineOffer={() => {
                        if (activeNegotiationId) {
                            onRespondToCounter(activeNegotiationId, 'Rejected');
                            setActiveNegotiationId(null);
                        }
                    }}
                />
            )}
        </div>
    );
};
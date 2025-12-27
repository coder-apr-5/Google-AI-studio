
import React from 'react';
import { Product, Farmer } from '../types';
import { HeartIcon, CheckCircleIcon, StarIcon, MapPinIcon } from './icons';

interface ProductCardProps {
    product: Product;
    onNegotiate: (product: Product) => void;
    isInWishlist: boolean;
    onToggleWishlist: (productId: string) => void;
    farmer: Farmer;
    onViewFarmerProfile: (farmerId: string) => void;
}

// B2B Platform - ProductCard always shows Negotiate button (no Add to Cart)
export const ProductCard: React.FC<ProductCardProps> = ({ product, onNegotiate, isInWishlist, onToggleWishlist, farmer, onViewFarmerProfile }) => (
    <div className="bg-background-alt rounded-xl shadow-md overflow-hidden group transform hover:-translate-y-1 transition-all duration-300 flex flex-col h-full border border-stone-200/80 hover:shadow-xl">
        <div className="relative">
             <button 
                onClick={() => onToggleWishlist(product.id)}
                className={`absolute top-3 right-3 z-10 p-2 rounded-full transition-all duration-300 ${isInWishlist ? 'bg-red-500/20 text-red-500' : 'text-stone-500 bg-white/70 backdrop-blur-sm hover:text-red-500 hover:bg-white'}`}
                aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
                <HeartIcon isFilled={isInWishlist} className="w-5 h-5" />
            </button>
            <img src={product.imageUrl} alt={product.name} className="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-105"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        </div>
        <div className="p-5 flex-grow flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold font-heading text-lg text-stone-800 tracking-wide pr-2">{product.name}</h3>
                {product.isVerified && (
                    <div 
                        className="flex-shrink-0 flex items-center space-x-1 bg-green-100 text-green-800 rounded-full px-2.5 py-1 text-xs font-semibold cursor-help"
                        title={product.verificationFeedback || 'Verified by Anna AI for quality and authenticity.'}
                    >
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>Verified</span>
                    </div>
                )}
            </div>
            
            <p className="text-stone-500 text-sm mb-4 flex-grow line-clamp-2">{product.description}</p>
            
            <button 
                onClick={() => onViewFarmerProfile(farmer.id)} 
                className="w-full text-left group mb-4 p-2 -mx-2 rounded-lg hover:bg-stone-100 transition-colors"
                aria-label={`View profile for ${farmer.name}`}
            >
                <div className="flex items-center space-x-3">
                    <img src={farmer.profileImageUrl} alt={farmer.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                            <p className="font-semibold text-sm text-stone-800 group-hover:text-primary truncate">{farmer.name}</p>
                            {farmer.isVerified && <CheckCircleIcon className="h-4 w-4 text-blue-500 flex-shrink-0" title="Verified Farmer" />}
                        </div>
                         <div className="flex items-center space-x-3 mt-1">
                            <div className="flex items-center space-x-1">
                                <StarIcon className="h-3.5 w-3.5 text-yellow-400" />
                                <span className="text-xs text-stone-500 font-medium">{farmer.rating.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-stone-500">
                                <MapPinIcon className="h-3.5 w-3.5" />
                                <span>{farmer.location.split(',')[0]}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </button>

            <div className="flex justify-between items-center mt-auto pt-4 border-t border-stone-200/80">
                <span className="text-2xl font-bold text-primary font-heading">₹{product.price}</span>
                {/* B2B Platform - All products use negotiation */}
                <button 
                    onClick={() => onNegotiate(product)} 
                    className="bg-secondary text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-secondary-dark transform hover:scale-105 transition-all duration-300 shadow-sm"
                >
                    Negotiate
                </button>
            </div>
        </div>
    </div>
);
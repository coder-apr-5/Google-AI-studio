
import React, { useState } from 'react';
import { Farmer, Product } from '../types';
import { ProductCard } from './ProductCard';
import { ArrowLeftIcon, CheckCircleIcon, StarIcon, MapPinIcon, LeafIcon, PackageIcon, ShieldCheckIcon, LoaderIcon } from './icons';

interface FarmerProfileProps {
    farmer: Farmer;
    products: Product[];
    onBack: () => void;
    onNegotiate: (product: Product) => void;
    wishlist: string[];
    onToggleWishlist: (productId: string) => void;
    onVerifyFarmer: (farmer: Farmer) => Promise<void>;
    onContactFarmer?: (farmerId: string) => void;
}

const StatItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => (
    <div className="flex items-center space-x-3">
        <div className="bg-stone-100 p-2 rounded-full">
            {icon}
        </div>
        <div>
            <p className="font-semibold text-stone-800">{value}</p>
            <p className="text-xs text-stone-500">{label}</p>
        </div>
    </div>
);

export const FarmerProfile = ({ farmer, products, onBack, onNegotiate, wishlist, onToggleWishlist, onVerifyFarmer, onContactFarmer }: FarmerProfileProps) => {
    const [isVerifying, setIsVerifying] = useState(false);

    const handleVerifyClick = async () => {
        setIsVerifying(true);
        await onVerifyFarmer(farmer);
        setIsVerifying(false);
    };
    
    // A no-op handler for product cards on the profile page itself.
    const noopViewProfile = () => {}; 
    
    return (
        <div className="animate-fade-in">
            <button
                onClick={onBack}
                className="flex items-center space-x-2 text-primary font-semibold hover:underline mb-6"
            >
                <ArrowLeftIcon className="h-5 w-5" />
                <span>Back to Products</span>
            </button>

            <header className="bg-background-alt p-6 sm:p-8 rounded-xl shadow-sm border border-stone-200/80">
                <div className="relative h-32 rounded-lg bg-gradient-to-r from-primary/80 via-green-600/70 to-primary-light/80 -m-6 sm:-m-8 mb-16 overflow-hidden">
                    {/* Farm-themed pattern overlay */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjAgMEwyNSAyMEwyMCA0MEwxNSAyMEwyMCAwWiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=')] bg-repeat"></div>
                    </div>
                    <div className="absolute -bottom-14 left-4 sm:left-8">
                        <img src={farmer.profileImageUrl || ''} alt={farmer.name} className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white shadow-md bg-stone-200" onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).classList.add('flex', 'items-center', 'justify-center'); }}/>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-grow text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start space-x-2">
                            <h1 className="text-3xl font-bold font-heading text-stone-800">{farmer.name}</h1>
                            {farmer.isVerified && <CheckCircleIcon className="h-6 w-6 text-blue-500" title={`Verified: ${farmer.verificationFeedback}`} />}
                        </div>
                        <div className="flex items-center justify-center sm:justify-start space-x-1 mt-1 text-yellow-500">
                            <StarIcon className="h-5 w-5"/>
                            <span className="font-bold text-lg text-stone-800">{farmer.rating.toFixed(1)}</span>
                            <span className="text-sm text-stone-500">(Rating)</span>
                        </div>
                    </div>
                     <div className="flex items-center space-x-3">
                        {!farmer.isVerified && (
                            <button 
                                onClick={handleVerifyClick}
                                disabled={isVerifying}
                                className="bg-blue-500 text-white px-6 py-3 rounded-full font-bold hover:bg-blue-600 transition-colors shadow-sm whitespace-nowrap flex items-center justify-center disabled:bg-blue-300"
                            >
                                {isVerifying ? (
                                    <LoaderIcon className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <ShieldCheckIcon className="h-5 w-5 mr-2" />
                                )}
                                {isVerifying ? 'Verifying...' : 'Verify Farmer'}
                            </button>
                        )}
                        <button 
                            onClick={() => onContactFarmer?.(farmer.id)}
                            className="bg-primary text-white px-6 py-3 rounded-full font-bold hover:bg-primary-dark transition-colors shadow-sm whitespace-nowrap"
                        >
                            Contact Farmer
                        </button>
                    </div>
                </div>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
                <aside className="lg:col-span-1 space-y-6">
                     <div className="bg-background-alt p-6 rounded-xl shadow-sm border border-stone-200/80">
                        <h3 className="text-lg font-bold font-heading text-stone-800 mb-3">About {farmer.name.split(' ')[0]}</h3>
                        <p className="text-stone-500 text-sm">{farmer.bio}</p>
                    </div>
                     <div className="bg-background-alt p-6 rounded-xl shadow-sm border border-stone-200/80 space-y-4">
                         <h3 className="text-lg font-bold font-heading text-stone-800 mb-3">Stats</h3>
                        <StatItem icon={<PackageIcon className="h-5 w-5 text-primary"/>} label="Products Listed" value={products.length}/>
                        <StatItem icon={<LeafIcon className="h-5 w-5 text-green-500"/>} label="Years Farming" value={farmer.yearsFarming ? `${farmer.yearsFarming} Years` : 'New Farmer'}/>
                        <StatItem icon={<MapPinIcon className="h-5 w-5 text-red-500"/>} label="Location" value={farmer.location}/>
                    </div>
                </aside>

                <section className="lg:col-span-3">
                    <h2 className="text-2xl font-bold font-heading text-stone-800 mb-6">Products from {farmer.name}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                         {products.map(p => (
                            <ProductCard 
                                key={p.id}
                                product={p} 
                                onNegotiate={onNegotiate}
                                isInWishlist={wishlist.includes(p.id)}
                                onToggleWishlist={onToggleWishlist} 
                                farmer={farmer}
                                onViewFarmerProfile={noopViewProfile}
                            />
                        ))}
                    </div>
                     {products.length === 0 && <p className="text-stone-500 bg-background-alt p-6 rounded-xl text-center border border-stone-200/80">This farmer has not listed any products yet.</p>}
                </section>
            </main>
        </div>
    );
};
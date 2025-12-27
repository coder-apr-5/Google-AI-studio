import React, { useState, useEffect, useMemo } from 'react';
import { Farmer, FarmerDashboardWeather, MarketRate, Negotiation, ProductCategory, NegotiationStatus, Product, ProductType, ChatMessage, User } from '../types';
import { generateProductDetails } from '../services/geminiService';
import { XIcon, LoaderIcon, PlusIcon } from './icons';
import { useToast } from '../context/ToastContext';
import { ProductUploadPage } from './ProductUploadPage';
import { NegotiationChat } from './NegotiationChat';
import { FarmerWallet } from './FarmerWallet';
import { firebaseService } from '../services/firebaseService';
import { WeatherWidget } from './WeatherWidget';

interface FarmerViewProps {
    products: Product[];
    negotiations: Negotiation[];
    messages: ChatMessage[];
    currentUserId: string;
    currentUser: User;
    onAddNewProduct: (product: Omit<Product, 'id' | 'farmerId' | 'imageUrl' | 'isVerified' | 'verificationFeedback'>, imageFile: File) => Promise<void>;
    onUpdateProduct: (product: Product) => void;
    onRespond: (negotiationId: string, response: 'Accepted' | 'Rejected') => void;
    onCounter: (negotiation: Negotiation) => void;
    onOpenChat: (negotiation: Negotiation) => void;
    onSendMessage: (negotiationId: string, text: string) => void;
}

type FormErrors = { [key in keyof Omit<Product, 'id' | 'farmerId' | 'imageUrl' | 'isVerified' | 'verificationFeedback'>]?: string } & { image?: string };

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
        reader.onerror = error => reject(error);
    });

export const FarmerView = ({ products, negotiations, messages, currentUserId, currentUser, onAddNewProduct, onUpdateProduct, onRespond, onCounter, onOpenChat, onSendMessage }: FarmerViewProps) => {
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [formIsSubmitting, setFormIsSubmitting] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    const [activeFormTab, setActiveFormTab] = useState<ProductType>(ProductType.Bulk);
    const initialFormState = { name: '', category: ProductCategory.Other, description: '', price: 0, quantity: 100, type: ProductType.Bulk };
    const [newProductForm, setNewProductForm] = useState(initialFormState);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [showUploadPage, setShowUploadPage] = useState(false);
    const [showNegotiationChat, setShowNegotiationChat] = useState(false);
    const [selectedNegotiationId, setSelectedNegotiationId] = useState<string | undefined>(undefined);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editForm, setEditForm] = useState<Product | null>(null);
    const [editFormErrors, setEditFormErrors] = useState<FormErrors>({});
    const [editTouched, setEditTouched] = useState<{ [key: string]: boolean }>({});

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeNav, setActiveNav] = useState('home');

    const [farmerProfile, setFarmerProfile] = useState<Farmer | null>(null);
    const [dashboardWeather, setDashboardWeather] = useState<FarmerDashboardWeather | null>(null);
    const [marketRates, setMarketRates] = useState<MarketRate[]>([]);
    const [buyerProfiles, setBuyerProfiles] = useState<Record<string, User>>({});

    const { showToast } = useToast();

    const myProducts = useMemo(
        () => products.filter((p) => p.farmerId === currentUserId),
        [products, currentUserId]
    );

    const activeOffers = useMemo(
        () =>
            negotiations
                .filter((n) => n.status !== NegotiationStatus.Accepted && n.status !== NegotiationStatus.Rejected)
                .sort((a, b) => (b.lastUpdated?.getTime?.() ?? 0) - (a.lastUpdated?.getTime?.() ?? 0)),
        [negotiations]
    );

    const incomingOffers = useMemo(() => activeOffers.slice(0, 2), [activeOffers]);
    const messagesBadgeCount = useMemo(() => activeOffers.length, [activeOffers.length]);

    const buyerIdsInOffers = useMemo(() => {
        const ids = new Set<string>();
        for (const offer of activeOffers) ids.add(offer.buyerId);
        return Array.from(ids);
    }, [activeOffers]);

    useEffect(() => {
        if (!currentUserId) return;
        const unsubFarmer = firebaseService.subscribeFarmerProfile(currentUserId, setFarmerProfile);
        const unsubWeather = firebaseService.subscribeFarmerDashboardWeather(currentUserId, setDashboardWeather);
        return () => {
            unsubFarmer();
            unsubWeather();
        };
    }, [currentUserId]);

    useEffect(() => {
        const unsubRates = firebaseService.subscribeMarketRates((rates) => setMarketRates(rates));
        return () => unsubRates();
    }, []);

    useEffect(() => {
        const unsub = firebaseService.subscribeUserProfiles(buyerIdsInOffers, setBuyerProfiles);
        return () => unsub();
    }, [buyerIdsInOffers]);

    useEffect(() => {
        setNewProductForm(prev => ({ ...prev, type: activeFormTab }));
    }, [activeFormTab]);

    const validateForm = (form: Omit<Product, 'id' | 'farmerId' | 'isVerified' | 'verificationFeedback' | 'imageUrl'>, forEdit = false): FormErrors => {
        const errors: FormErrors = {};
        if (!forEdit && !imageFile) errors.image = 'Product image is required.';
        if (!form.name.trim()) errors.name = 'Product name is required.';
        if (!form.description.trim()) errors.description = 'Description is required.';
        if (form.price <= 0) errors.price = 'Price must be a positive number.';
        if (form.quantity <= 0) errors.quantity = 'Stock quantity must be a positive number.';
        return errors;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewProductForm(prev => ({ ...prev, [name]: name === 'price' || name === 'quantity' ? parseFloat(value) || 0 : value }));
    };

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setTouched(prev => ({ ...prev, [e.target.name]: true }));
        setFormErrors(validateForm(newProductForm));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImageFile(file);
        setImagePreviewUrl(await fileToDataUrl(file));
        setTouched(prev => ({ ...prev, image: true }));
        setFormErrors(prev => ({ ...prev, image: undefined }));

        setAiIsLoading(true);
        try {
            const base64Image = await fileToBase64(file);
            const details = await generateProductDetails(base64Image, file.type);
            setNewProductForm(prev => ({ ...prev, ...details }));
            showToast('AI analysis complete!', 'info');
        } catch (error) {
            showToast(error instanceof Error ? error.message : "An unknown error occurred", 'error');
        } finally {
            setAiIsLoading(false);
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreviewUrl(null);
        setNewProductForm(prev => ({ ...prev, name: '', category: ProductCategory.Other, description: '' }));
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTouched({ name: true, description: true, price: true, quantity: true, image: true });
        const errors = validateForm(newProductForm);
        if (Object.keys(errors).length > 0 || !imageFile) {
            setFormErrors(errors);
            return;
        }
        setFormIsSubmitting(true);
        try {
            await onAddNewProduct(newProductForm, imageFile);
            setNewProductForm({ ...initialFormState, type: activeFormTab });
            setImageFile(null);
            setImagePreviewUrl(null);
            setTouched({});
            setFormErrors({});
            setIsAddModalOpen(false);
        } catch (error) {
            console.error("Failed to add product:", error);
        } finally {
            setFormIsSubmitting(false);
        }
    };

    const handleOpenEditModal = (product: Product) => {
        setEditingProduct(product);
        setEditForm(product);
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingProduct(null);
        setEditForm(null);
        setEditFormErrors({});
        setEditTouched({});
    };

    const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!editForm) return;
        const { name, value } = e.target;
        setEditForm({ ...editForm, [name]: name === 'price' || name === 'quantity' ? parseFloat(value) || 0 : value });
    };

    const handleEditInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (!editForm) return;
        setEditTouched(prev => ({ ...prev, [e.target.name]: true }));
        setEditFormErrors(validateForm(editForm, true));
    };

    const handleUpdateProductSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editForm) return;
        const errors = validateForm(editForm, true);
        if (Object.keys(errors).length > 0) {
            setEditFormErrors(errors);
            return;
        }
        onUpdateProduct(editForm);
        handleCloseEditModal();
    };

    const inputClasses = (hasError: boolean) =>
        `mt-1 block w-full rounded-lg bg-[#fcfaf8] border text-[#1c160d] sm:text-sm px-3 py-2.5 focus:border-[#f9a824] focus:ring-2 focus:ring-[#f9a824]/50 ${hasError ? 'border-red-500' : 'border-[#e9dece]'
        }`;

    const navItems = [
        { id: 'home', label: 'Home', icon: 'home' },
        { id: 'listings', label: 'My Listings', icon: 'list_alt' },
        { id: 'messages', label: 'Messages', icon: 'chat' },
        { id: 'wallet', label: 'Wallet', icon: 'account_balance_wallet' },
        { id: 'settings', label: 'Settings', icon: 'settings' },
    ];

    const fallbackRates: MarketRate[] = useMemo(
        () => [
            { id: 'wheat', crop: 'Wheat', pricePerQuintal: 2125, changePct: 2.4, trend: 'up', updatedAt: new Date() },
            { id: 'mustard', crop: 'Mustard', pricePerQuintal: 5450, changePct: 0.1, trend: 'flat', updatedAt: new Date() },
            { id: 'chana', crop: 'Chana', pricePerQuintal: 4800, changePct: -1.2, trend: 'down', updatedAt: new Date() },
        ],
        []
    );

    const effectiveRates = marketRates.length > 0 ? marketRates.slice(0, 3) : fallbackRates;

    const displayName = currentUser.name?.split(' ')[0] || 'Farmer';
    const avatarUrl = currentUser.avatarUrl || farmerProfile?.profileImageUrl;
    const todayLabel = useMemo(() => {
        try {
            return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date());
        } catch {
            return new Date().toDateString();
        }
    }, []);

    // Weather is now handled by WeatherWidget component
    const farmerLocationForWeather = farmerProfile?.location || currentUser.location || 'India';

    const handleUploadSubmit = async (product: {
        name: string;
        category: ProductCategory;
        description: string;
        price: number;
        quantity: number;
        type: ProductType;
        farmerNote: string;
    }, imageFile: File) => {
        await onAddNewProduct({
            name: product.name,
            category: product.category,
            description: product.description,
            price: product.price,
            quantity: product.quantity,
            type: product.type,
        }, imageFile);
        setShowUploadPage(false);
    };

    const handleOpenNegotiationChat = (negotiationId?: string) => {
        setSelectedNegotiationId(negotiationId);
        setShowNegotiationChat(true);
    };

    const handleNavClick = (navId: string) => {
        setActiveNav(navId);
        setIsSidebarOpen(false);

        if (navId === 'messages') {
            handleOpenNegotiationChat();
        }
    };

    // Show Negotiation Chat when Messages is clicked
    if (showNegotiationChat) {
        return (
            <NegotiationChat
                negotiations={negotiations}
                messages={messages}
                currentUserId={currentUserId}
                onClose={() => setShowNegotiationChat(false)}
                onSendMessage={onSendMessage}
                onRespond={onRespond}
                onCounter={onCounter}
                initialNegotiationId={selectedNegotiationId}
            />
        );
    }

    // Show Upload Page when New Listing is clicked
    if (showUploadPage) {
        return (
            <ProductUploadPage
                onBack={() => setShowUploadPage(false)}
                onSubmit={handleUploadSubmit}
            />
        );
    }

    // Show Wallet when Wallet is clicked
    if (activeNav === 'wallet') {
        return (
            <FarmerWallet
                farmerId={currentUserId}
                onNavigate={(section) => setActiveNav(section)}
            />
        );
    }

    return (
        <div className="h-screen w-full overflow-hidden text-stone-800 bg-background relative">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
                <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
                <div className="absolute -bottom-24 right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
            </div>

            <div className="flex h-full w-full relative">
                {/* Sidebar */}
                <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 sm:w-80 lg:w-72 xl:w-80 border-r border-white/50 bg-white/40 backdrop-blur-xl lg:backdrop-blur-2xl p-4 sm:p-6 overflow-y-auto shadow-card transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                    <div className="flex flex-col gap-6 sm:gap-10 min-h-full">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 sm:gap-4 group">
                                <div className="relative flex items-center justify-center h-10 w-10 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-card transition-transform group-hover:scale-105">
                                    <span className="material-symbols-outlined text-2xl sm:text-4xl">agriculture</span>
                                    <div className="absolute inset-0 rounded-2xl bg-white/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </div>
                                <div className="flex flex-col">
                                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold tracking-tight text-stone-900 relative">
                                        Anna Bazaar
                                        <span className="absolute -top-1 -right-2 h-2 w-2 bg-primary rounded-full animate-pulse"></span>
                                    </h1>
                                    <span className="text-[10px] sm:text-xs font-mono text-primary font-bold tracking-widest uppercase">Farmer Mode</span>
                                </div>
                            </div>

                            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 rounded-full hover:bg-white/40">
                                <XIcon className="h-6 w-6 text-stone-700" />
                            </button>
                        </div>

                        <div className="rounded-3xl p-[1px] bg-gradient-to-br from-white/80 to-white/20">
                            <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/40 backdrop-blur-xl">
                                <div className="relative">
                                    <div
                                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-16 w-16 ring-2 ring-white shadow-lg flex items-center justify-center font-bold text-primary"
                                        style={{ backgroundImage: avatarUrl ? `url('${avatarUrl}')` : 'none' }}
                                    >
                                        {!avatarUrl && (displayName?.charAt(0)?.toUpperCase() || 'F')}
                                    </div>
                                    {farmerProfile?.isVerified && (
                                        <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                                            <span className="material-symbols-outlined text-sm">verified</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xl font-bold font-display leading-tight text-stone-900">{currentUser.name || 'Farmer'}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                        <span className="text-xs font-mono uppercase text-stone-500 font-bold">Online</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <nav className="flex flex-col gap-3">
                            {navItems.map((item) => {
                                const isActive = activeNav === item.id;
                                return (
                                    <a
                                        key={item.id}
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNavClick(item.id);
                                        }}
                                        className={
                                            isActive
                                                ? 'flex items-center gap-4 px-6 py-4 rounded-2xl bg-gradient-to-r from-primary/90 to-primary text-white shadow-card transition-all hover:scale-[1.02]'
                                                : 'group flex items-center gap-4 px-6 py-4 rounded-2xl hover:bg-white/60 text-stone-600 hover:text-stone-900 transition-all hover:shadow-card border border-transparent hover:border-white/50'
                                        }
                                    >
                                        <span className={`material-symbols-outlined text-2xl ${!isActive ? 'group-hover:scale-110 transition-transform' : ''}`}>{item.icon}</span>
                                        <span className={`text-lg ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                                        {item.id === 'messages' && messagesBadgeCount > 0 && (
                                            <span className="ml-auto bg-gradient-to-r from-farmer-primary to-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-card">
                                                {messagesBadgeCount}
                                            </span>
                                        )}
                                    </a>
                                );
                            })}
                        </nav>

                        <div className="mt-auto">
                            <button className="w-full py-4 px-6 rounded-2xl bg-stone-900 text-white font-bold flex items-center justify-center gap-3 shadow-card hover:shadow-xl hover:-translate-y-0.5 transition-all">
                                <span className="material-symbols-outlined">headset_mic</span>
                                <span>Help Support</span>
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Mobile overlay */}
                {isSidebarOpen && (
                    <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
                )}

                {/* Main */}
                <main className="flex-1 flex flex-col h-full overflow-hidden relative lg:ml-0">
                    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 md:px-6 lg:px-8 md:py-4 lg:py-6 shrink-0 z-10 bg-gradient-to-b from-white/40 to-transparent backdrop-blur-sm">
                        <div className="flex flex-col gap-1 sm:gap-2 relative">
                            <div className="absolute -left-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-white/60 backdrop-blur-md text-stone-900 shadow-card border border-white/50">
                                    <span className="material-symbols-outlined text-xl sm:text-2xl lg:text-3xl">menu</span>
                                </button>
                                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-bold text-stone-900 tracking-tight">
                                    Namaste, {displayName}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 text-stone-600 font-medium text-xs sm:text-sm lg:text-base bg-white/30 w-fit px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 rounded-full border border-white/40 backdrop-blur-sm">
                                <span className="material-symbols-outlined text-primary">calendar_month</span>
                                <span>{todayLabel}</span>
                                <span className="w-1 h-4 bg-stone-300 rounded-full mx-1"></span>
                                <span className="text-primary font-bold">Mandi Open</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4">
                            <button
                                onClick={() => setShowUploadPage(true)}
                                className="relative group overflow-hidden px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 lg:py-4 rounded-xl sm:rounded-full bg-gradient-to-r from-primary to-primary-light text-white shadow-card transition-all duration-300 hover:-translate-y-0.5"
                            >
                                <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-700 ease-in-out skew-x-12 -translate-x-full"></div>
                                <div className="flex items-center gap-2 sm:gap-3 relative z-10">
                                    <span className="material-symbols-outlined text-xl sm:text-2xl lg:text-3xl font-bold">add_circle</span>
                                    <span className="text-sm sm:text-base lg:text-xl font-bold tracking-wide">New Listing</span>
                                </div>
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:px-6 lg:px-8 md:pb-12 lg:pb-16 scroll-smooth">
                        <div className="max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6 lg:gap-8">
                            {/* Top grid - Stack on mobile, side by side on xl */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
                                {/* Weather Widget */}
                                <WeatherWidget
                                    weather={dashboardWeather}
                                    farmerId={currentUserId}
                                    farmerLocation={farmerLocationForWeather}
                                    isLoading={false}
                                />

                                {/* Live Mandi Rates (match screenshot style) */}
                                <div className="lg:col-span-8 rounded-2xl sm:rounded-[2rem] p-4 sm:p-5 md:p-6 overflow-hidden relative bg-white/70 backdrop-blur-xl border border-white/70 shadow-card">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-green-700">trending_up</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-stone-900">Mandi Rates (Live)</h3>
                                        </div>
                                        <button
                                            onClick={() => showToast('View all rates coming soon!', 'info')}
                                            className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            View All
                                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 rounded-2xl overflow-hidden border border-stone-100 bg-white">
                                        {effectiveRates.map((rate, idx) => {
                                            const isUp = rate.trend === 'up';
                                            const isDown = rate.trend === 'down';
                                            const statusLabel = isUp ? 'Above MSP' : isDown ? 'Falling' : 'Stable';
                                            const badgeClass = isUp
                                                ? 'bg-green-50 text-green-700 border-green-100'
                                                : isDown
                                                    ? 'bg-red-50 text-red-600 border-red-100'
                                                    : 'bg-amber-50 text-amber-700 border-amber-100';
                                            const iconBoxClass = isUp
                                                ? 'bg-green-100 text-green-700'
                                                : isDown
                                                    ? 'bg-red-100 text-red-600'
                                                    : 'bg-amber-100 text-amber-700';
                                            const icon = isUp ? 'arrow_upward' : isDown ? 'arrow_downward' : 'remove';

                                            return (
                                                <div
                                                    key={rate.id}
                                                    className={
                                                        idx < effectiveRates.length - 1
                                                            ? 'p-5 md:p-6 border-b md:border-b-0 md:border-r border-stone-100'
                                                            : 'p-5 md:p-6'
                                                    }
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-bold text-stone-500">{rate.crop}</p>
                                                            <p className="mt-2 text-3xl font-extrabold text-stone-900">
                                                                ₹{Math.round(rate.pricePerQuintal).toLocaleString()}
                                                                <span className="text-sm font-bold text-stone-400">/q</span>
                                                            </p>
                                                        </div>
                                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconBoxClass}`}>
                                                            <span className="material-symbols-outlined">{icon}</span>
                                                        </div>
                                                    </div>

                                                    <div className={`mt-4 w-full py-2 rounded-xl border text-center text-sm font-bold ${badgeClass}`}>
                                                        {statusLabel}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Incoming Orders */}
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gradient-to-br from-secondary to-secondary-dark rounded-2xl text-white shadow-card">
                                        <span className="material-symbols-outlined text-3xl">shopping_cart_checkout</span>
                                    </div>
                                    <h3 className="text-3xl font-display font-bold text-stone-900">Incoming Orders</h3>
                                    <div className="ml-2">
                                        <span className="bg-white/70 border border-white/70 text-stone-800 text-lg font-bold px-4 py-1 rounded-full shadow-soft">
                                            {incomingOffers.length > 0 ? `${incomingOffers.length} New` : 'No New'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {incomingOffers.map((offer) => (
                                        <div key={offer.id} className="group relative rounded-[2.5rem] transition-all duration-300 hover:-translate-y-1">
                                            <div className="absolute -inset-[2px] bg-gradient-to-r from-secondary/60 to-primary/40 rounded-[2.5rem] opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500"></div>
                                            <div className="relative h-full bg-white/60 backdrop-blur-xl border border-white/70 rounded-[2.5rem] p-0 overflow-hidden shadow-card">
                                                <div className="flex justify-between items-center p-6 border-b border-white/60 bg-white/30">
                                                    <span className="px-4 py-1.5 rounded-full bg-white/60 border border-white/70 text-stone-800 text-sm font-bold uppercase tracking-wider backdrop-blur-sm shadow-soft">
                                                        {offer.status === NegotiationStatus.Pending ? 'New Offer' : 'In Negotiation'}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-stone-900 font-mono font-bold bg-white/60 px-3 py-1 rounded-lg">
                                                        <span className="material-symbols-outlined text-lg">schedule</span>
                                                        <span>
                                                            {(() => {
                                                                const mins = Math.max(0, Math.round((Date.now() - offer.lastUpdated.getTime()) / 60000));
                                                                return mins <= 1 ? 'Just now' : `${mins}m ago`;
                                                            })()}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="p-8 flex flex-col gap-6">
                                                    <div className="flex flex-col gap-1">
                                                        <h4 className="text-3xl font-display font-bold text-stone-900 flex items-center gap-2">
                                                            {buyerProfiles[offer.buyerId]?.name || `Buyer #${offer.buyerId.slice(-4)}`}
                                                            <span className="material-symbols-outlined text-blue-500 text-2xl" title="Verified Buyer">verified</span>
                                                        </h4>
                                                        <p className="text-lg font-medium text-stone-500 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-base">location_on</span>
                                                            {buyerProfiles[offer.buyerId]?.location || '—'}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-6 bg-white/40 p-4 rounded-3xl border border-white/60">
                                                        <div className="h-20 w-20 bg-accent/20 rounded-2xl flex items-center justify-center shadow-inner">
                                                            <span className="material-symbols-outlined text-accent text-5xl">agriculture</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-4xl font-black text-stone-900">{offer.productName}</span>
                                                            <span className="block text-xl font-medium text-stone-500 mt-1">{offer.quantity} Quintals</span>
                                                        </div>
                                                        <div className="ml-auto text-right">
                                                            <span className="block text-xs font-bold uppercase text-stone-400 tracking-wider mb-1">Offer Price</span>
                                                            <span className="block text-4xl font-display font-bold text-primary">₹{Math.round(offer.offeredPrice).toLocaleString()}</span>
                                                            <span className="text-sm font-bold text-stone-400">/quintal</span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-12 gap-3 mt-2">
                                                        <button
                                                            onClick={() => onRespond(offer.id, 'Rejected')}
                                                            className="col-span-3 h-16 rounded-full bg-white/80 hover:bg-red-50 text-red-600 font-bold text-xl flex items-center justify-center border border-red-100 transition-all hover:shadow-soft active:scale-95"
                                                        >
                                                            <span className="material-symbols-outlined text-3xl">close</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenNegotiationChat(offer.id)}
                                                            className="col-span-5 h-16 rounded-full bg-gradient-to-r from-accent to-orange-500 hover:brightness-110 text-white font-bold text-xl flex items-center justify-center gap-2 shadow-card transition-all hover:scale-[1.01] active:scale-95"
                                                        >
                                                            <span className="material-symbols-outlined text-3xl">forum</span>
                                                            Negotiate
                                                        </button>
                                                        <button
                                                            onClick={() => onRespond(offer.id, 'Accepted')}
                                                            className="col-span-4 h-16 rounded-full bg-gradient-to-r from-primary to-primary-light hover:brightness-110 text-white font-bold text-xl flex items-center justify-center gap-2 shadow-card transition-all hover:scale-[1.01] active:scale-95"
                                                        >
                                                            <span className="material-symbols-outlined text-3xl">check</span>
                                                            Accept
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {incomingOffers.length === 0 && (
                                        <div className="lg:col-span-2 bg-white/50 backdrop-blur-xl border border-white/60 rounded-[2rem] p-10 text-center shadow-card">
                                            <p className="text-stone-600 font-medium">No incoming orders right now.</p>
                                            <button
                                                onClick={() => handleOpenNegotiationChat()}
                                                className="mt-4 px-6 py-3 rounded-full bg-stone-900 text-white font-bold"
                                            >
                                                View Messages
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Active listings */}
                            <div className="flex flex-col gap-6">
                                <div className="flex flex-wrap items-end justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                            <span className="material-symbols-outlined text-3xl">storefront</span>
                                        </div>
                                        <h3 className="text-2xl font-display font-bold text-stone-900">Your Active Listings</h3>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => showToast('Filter feature coming soon!', 'info')}
                                            className="px-6 py-3 bg-white/50 backdrop-blur-xl rounded-xl text-lg font-bold shadow-soft hover:bg-white text-stone-600 transition-colors border border-white/60"
                                        >
                                            Filter
                                        </button>
                                        <button
                                            onClick={() => showToast('Sort feature coming soon!', 'info')}
                                            className="px-6 py-3 bg-white/50 backdrop-blur-xl rounded-xl text-lg font-bold shadow-soft hover:bg-white text-stone-600 transition-colors border border-white/60"
                                        >
                                            Sort by Date
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                                    {myProducts.map((product) => {
                                        const productOffers = negotiations.filter(
                                            (n) =>
                                                n.productId === product.id &&
                                                n.status !== NegotiationStatus.Accepted &&
                                                n.status !== NegotiationStatus.Rejected
                                        );
                                        const offersCount = productOffers.length;
                                        const isNegotiating = offersCount > 0;

                                        return (
                                            <div key={product.id} className="group flex flex-col rounded-[2rem] bg-white/50 backdrop-blur-xl p-0 shadow-card hover:shadow-xl transition-all duration-500 overflow-hidden transform hover:-translate-y-1 border border-white/60">
                                                <div className="relative h-64 w-full overflow-hidden">
                                                    <div
                                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                                                        style={{ backgroundImage: `url('${product.imageUrl}')` }}
                                                    ></div>
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
                                                    <div className="absolute top-4 left-4 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-card border border-white/20 backdrop-blur-md flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                                        Active
                                                    </div>
                                                    <div className="absolute bottom-6 left-6 text-white w-full pr-12">
                                                        <h4 className="text-3xl font-display font-bold drop-shadow-md">{product.name}</h4>
                                                        <p className="text-sm opacity-80 font-mono tracking-wider">#{product.id.slice(-6).toUpperCase()}</p>
                                                    </div>
                                                </div>

                                                <div className="p-6 flex flex-col flex-1 gap-6 bg-white/30 backdrop-blur-lg">
                                                    <div className="flex items-center justify-between p-5 bg-white/40 rounded-2xl border border-white/60 shadow-soft">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-stone-500 font-bold uppercase tracking-wide">Quantity</span>
                                                            <span className="text-2xl font-black text-stone-900">{product.quantity} <span className="text-base font-medium text-stone-500">Qtl</span></span>
                                                        </div>
                                                        <div className="h-10 w-px bg-stone-300"></div>
                                                        <div className="flex flex-col text-right">
                                                            <span className="text-xs text-stone-500 font-bold uppercase tracking-wide">Ask Price</span>
                                                            <span className="text-2xl font-black text-primary">₹{Math.round(product.price).toLocaleString()}<span className="text-base font-medium text-stone-500">/q</span></span>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-3 mt-auto">
                                                        <button
                                                            onClick={() => handleOpenEditModal(product)}
                                                            className="flex-1 py-3.5 rounded-xl border-2 border-stone-200 font-bold text-lg text-stone-600 hover:bg-white hover:border-stone-300 transition-colors"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (productOffers[0]) handleOpenNegotiationChat(productOffers[0].id);
                                                                else handleOpenNegotiationChat();
                                                            }}
                                                            className="flex-1 py-3.5 rounded-xl bg-stone-900 text-white font-bold text-lg shadow-card hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            Offers
                                                            <span className="bg-white text-stone-900 text-xs px-1.5 py-0.5 rounded-md font-bold">{offersCount}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <button
                                        onClick={() => setShowUploadPage(true)}
                                        className="group flex flex-col items-center justify-center rounded-[2rem] border-4 border-dashed border-stone-300/60 bg-white/20 hover:bg-white/40 hover:border-primary transition-all duration-300 min-h-[400px] relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                        <div className="flex flex-col items-center gap-6 relative z-10 p-6">
                                            <div className="h-24 w-24 rounded-full bg-white shadow-card flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ring-4 ring-primary/10 group-hover:ring-primary/30">
                                                <span className="material-symbols-outlined text-6xl text-primary font-bold">add</span>
                                            </div>
                                            <div className="text-center">
                                                <span className="block text-3xl font-display font-bold text-stone-700 group-hover:text-primary transition-colors">Add Another Crop</span>
                                                <span className="block text-sm text-stone-500 mt-2 font-medium">Expand your catalog</span>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {myProducts.length === 0 && (
                                    <div className="bg-white/50 backdrop-blur-xl border border-white/60 rounded-[2rem] p-10 text-center shadow-card">
                                        <p className="text-stone-600 font-medium">You haven’t listed any crops yet.</p>
                                        <button
                                            onClick={() => setShowUploadPage(true)}
                                            className="mt-4 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-primary-light text-white font-bold"
                                        >
                                            Create your first listing
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Add Product Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center p-4" onClick={() => setIsAddModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 font-sans animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-[#e9dece] flex justify-between items-center sticky top-0 bg-white z-10">
                            <h2 className="text-2xl font-bold font-display text-[#1c160d]">List Bulk Produce</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-[#4e4639] hover:text-[#1c160d] p-2 rounded-full hover:bg-[#f4efe6]"><XIcon className="h-6 w-6" /></button>
                        </div>

                        <div className="p-6">
                            {/* B2B Bulk Platform Notice */}
                            <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <span className="material-symbols-outlined text-blue-600">business</span>
                                <div>
                                    <p className="font-bold text-blue-900">B2B Bulk Trading Platform</p>
                                    <p className="text-sm text-blue-700">All listings are for bulk orders (minimum 1 quintal / 100kg). Buyers negotiate prices directly.</p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6 relative">
                                {(aiIsLoading || formIsSubmitting) && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20">
                                        <LoaderIcon className="h-10 w-10 text-[#f9a824] animate-spin" />
                                        <p className="mt-3 text-[#1c160d] font-semibold text-lg">{formIsSubmitting ? 'Listing crop...' : 'Analyzing image...'}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-[#1c160d] mb-2">Crop Photo</label>
                                    {imagePreviewUrl ? (
                                        <div className="relative group rounded-xl overflow-hidden border border-[#e9dece]">
                                            <img src={imagePreviewUrl} alt="Preview" className="w-full h-64 object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button type="button" onClick={handleRemoveImage} className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-50">Remove Photo</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`border-2 border-dashed rounded-xl p-8 text-center hover:bg-[#f4efe6] transition-colors ${formErrors.image && touched.image ? 'border-red-500 bg-red-50/50' : 'border-[#e9dece]'}`}>
                                            <div className="space-y-2">
                                                <div className="mx-auto h-12 w-12 text-[#4e4639] bg-[#f4efe6] rounded-full flex items-center justify-center">
                                                    <PlusIcon className="h-6 w-6" />
                                                </div>
                                                <div className="text-sm text-[#4e4639]">
                                                    <label htmlFor="file-upload" className="relative cursor-pointer font-bold text-[#f9a824] hover:underline">
                                                        <span>Upload a photo</span>
                                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} disabled={aiIsLoading || formIsSubmitting} />
                                                    </label>
                                                    <span className="pl-1">or drag and drop</span>
                                                </div>
                                                <p className="text-xs text-[#4e4639]">PNG, JPG up to 10MB</p>
                                            </div>
                                        </div>
                                    )}
                                    {formErrors.image && touched.image && <p className="text-red-500 text-sm mt-1 font-medium">{formErrors.image}</p>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-[#1c160d] mb-1">Crop Name</label>
                                        <input type="text" name="name" placeholder="e.g. Sharbati Wheat" value={newProductForm.name} onChange={handleInputChange} onBlur={handleInputBlur} className={inputClasses(!!(formErrors.name && touched.name))} />
                                        {formErrors.name && touched.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1c160d] mb-1">Category</label>
                                        <select name="category" value={newProductForm.category} onChange={handleInputChange} onBlur={handleInputBlur} className={inputClasses(false)}>
                                            {Object.values(ProductCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-[#1c160d] mb-1">Asking Price (₹ / Qtl)</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-[#4e4639] sm:text-sm">₹</span>
                                            </div>
                                            <input type="number" name="price" placeholder="0" value={newProductForm.price} onChange={handleInputChange} onBlur={handleInputBlur} className={`${inputClasses(!!(formErrors.price && touched.price))} pl-7`} />
                                        </div>
                                        {formErrors.price && touched.price && <p className="text-red-500 text-xs mt-1">{formErrors.price}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1c160d] mb-1">Quantity (Quintals)</label>
                                        <input type="number" name="quantity" placeholder="0" value={newProductForm.quantity} onChange={handleInputChange} onBlur={handleInputBlur} className={inputClasses(!!(formErrors.quantity && touched.quantity))} />
                                        {formErrors.quantity && touched.quantity && <p className="text-red-500 text-xs mt-1">{formErrors.quantity}</p>}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-[#1c160d] mb-1">Description</label>
                                    <textarea name="description" rows={3} placeholder="Describe quality, harvest date, etc." value={newProductForm.description} onChange={handleInputChange} onBlur={handleInputBlur} className={inputClasses(!!(formErrors.description && touched.description))}></textarea>
                                    {formErrors.description && touched.description && <p className="text-red-500 text-xs mt-1">{formErrors.description}</p>}
                                </div>

                                <div className="pt-4 flex items-center justify-end space-x-4">
                                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-[#4e4639] hover:bg-[#f4efe6] transition-colors">Cancel</button>
                                    <button type="submit" disabled={formIsSubmitting} className="px-8 py-3 rounded-xl font-bold text-[#1c160d] bg-[#F9A825] hover:bg-[#f9a824] shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:bg-[#e9dece] disabled:transform-none disabled:shadow-none">
                                        List Crop
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && editForm && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center p-4" onClick={handleCloseEditModal}>
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg m-4 font-sans animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold text-[#1c160d]">Edit Listing</h2>
                            <button onClick={handleCloseEditModal} className="text-[#4e4639] hover:text-[#1c160d]"><XIcon className="h-6 w-6" /></button>
                        </div>
                        <form onSubmit={handleUpdateProductSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[#1c160d] mb-1">Crop Name</label>
                                <input type="text" name="name" value={editForm.name} onChange={handleEditInputChange} onBlur={handleEditInputBlur} className={inputClasses(!!(editFormErrors.name && editTouched.name))} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-[#1c160d] mb-1">Price (₹)</label>
                                    <input type="number" name="price" value={editForm.price} onChange={handleEditInputChange} onBlur={handleEditInputBlur} className={inputClasses(!!(editFormErrors.price && editTouched.price))} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#1c160d] mb-1">Quantity</label>
                                    <input type="number" name="quantity" value={editForm.quantity} onChange={handleEditInputChange} onBlur={handleEditInputBlur} className={inputClasses(!!(editFormErrors.quantity && editTouched.quantity))} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-[#1c160d] mb-1">Description</label>
                                <textarea name="description" rows={4} value={editForm.description} onChange={handleEditInputChange} onBlur={handleEditInputBlur} className={inputClasses(!!(editFormErrors.description && editTouched.description))}></textarea>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={handleCloseEditModal} className="bg-[#f4efe6] text-[#1c160d] px-4 py-2 rounded-lg font-bold hover:bg-[#e9dece] transition-colors">Cancel</button>
                                <button type="submit" className="px-6 py-2 rounded-lg font-bold transition-colors bg-[#F9A825] text-[#1c160d] hover:bg-[#f9a824]">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

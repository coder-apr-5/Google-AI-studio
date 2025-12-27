import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XIcon, LoaderIcon } from './icons';
import { useToast } from '../context/ToastContext';
import { firebaseService } from '../services/firebaseService';
import { User } from '../types';
import { NeonProgressBar, KYC_STEPS } from './ui/NeonProgressBar';

interface FarmerKYCProps {
    isOpen: boolean;
    currentUser: User;
    onClose: () => void;
    onComplete: () => void;
    /** When true, user cannot close the modal - they must complete KYC */
    required?: boolean;
}

type KYCStep = 1 | 2 | 3;

interface PersonalInfo {
    fullName: string;
    mobile: string;
    dateOfBirth: string;
    village: string;
    photoFile: File | null;
    photoPreview: string | null;
}

interface DocumentInfo {
    aadhaarFile: File | null;
    aadhaarPreview: string | null;
    kisanFile: File | null;
    kisanPreview: string | null;
}

interface BankInfo {
    accountHolder: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
}

const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });

export const FarmerKYC = ({ isOpen, currentUser, onClose, onComplete, required = false }: FarmerKYCProps) => {
    const [step, setStep] = useState<KYCStep>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

    const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
        fullName: currentUser.name || '',
        mobile: currentUser.phone || '',
        dateOfBirth: '',
        village: currentUser.location || '',
        photoFile: null,
        photoPreview: currentUser.avatarUrl || null,
    });

    const photoInputRef = useRef<HTMLInputElement>(null);

    const [documents, setDocuments] = useState<DocumentInfo>({
        aadhaarFile: null,
        aadhaarPreview: null,
        kisanFile: null,
        kisanPreview: null,
    });

    const [bankInfo, setBankInfo] = useState<BankInfo>({
        accountHolder: currentUser.name || '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
    });

    const aadhaarInputRef = useRef<HTMLInputElement>(null);
    const kisanInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setPersonalInfo({
                fullName: currentUser.name || '',
                mobile: currentUser.phone || '',
                dateOfBirth: '',
                village: currentUser.location || '',
                photoFile: null,
                photoPreview: currentUser.avatarUrl || null,
            });
            setDocuments({ aadhaarFile: null, aadhaarPreview: null, kisanFile: null, kisanPreview: null });
            setBankInfo({ accountHolder: currentUser.name || '', accountNumber: '', ifscCode: '', bankName: '' });
        }
    }, [isOpen, currentUser]);

    const goToStep = useCallback((newStep: KYCStep) => {
        setSlideDirection(newStep > step ? 'right' : 'left');
        setStep(newStep);
    }, [step]);

    const handlePersonalInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPersonalInfo((prev) => ({ ...prev, [name]: value }));
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const preview = await fileToDataUrl(file);
        setPersonalInfo((prev) => ({ ...prev, photoFile: file, photoPreview: preview }));
    };

    const handleBankInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setBankInfo((prev) => ({ ...prev, [name]: value }));
    };

    const handleAadhaarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const preview = await fileToDataUrl(file);
        setDocuments((prev) => ({ ...prev, aadhaarFile: file, aadhaarPreview: preview }));
    };

    const handleKisanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const preview = await fileToDataUrl(file);
        setDocuments((prev) => ({ ...prev, kisanFile: file, kisanPreview: preview }));
    };

    const removeAadhaar = () => {
        setDocuments((prev) => ({ ...prev, aadhaarFile: null, aadhaarPreview: null }));
        if (aadhaarInputRef.current) aadhaarInputRef.current.value = '';
    };

    const removeKisan = () => {
        setDocuments((prev) => ({ ...prev, kisanFile: null, kisanPreview: null }));
        if (kisanInputRef.current) kisanInputRef.current.value = '';
    };

    const validateStep1 = () => {
        if (!personalInfo.fullName.trim()) {
            showToast('Please enter your full name.', 'error');
            return false;
        }
        if (!personalInfo.mobile.trim() || personalInfo.mobile.length < 10) {
            showToast('Please enter a valid mobile number.', 'error');
            return false;
        }
        if (!personalInfo.village.trim()) {
            showToast('Please enter your village/locality.', 'error');
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        if (!documents.aadhaarFile) {
            showToast('Please upload your Aadhaar card.', 'error');
            return false;
        }
        if (!documents.kisanFile) {
            showToast('Please upload your Kisan card.', 'error');
            return false;
        }
        return true;
    };

    const validateStep3 = () => {
        if (!bankInfo.accountHolder.trim()) {
            showToast('Please enter account holder name.', 'error');
            return false;
        }
        if (!bankInfo.accountNumber.trim() || bankInfo.accountNumber.length < 9) {
            showToast('Please enter a valid account number.', 'error');
            return false;
        }
        if (!bankInfo.ifscCode.trim() || bankInfo.ifscCode.length !== 11) {
            showToast('Please enter a valid IFSC code (11 characters).', 'error');
            return false;
        }
        if (!bankInfo.bankName.trim()) {
            showToast('Please enter your bank name.', 'error');
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) {
            goToStep(2);
        } else if (step === 2 && validateStep2()) {
            goToStep(3);
        }
    };

    const handleBack = () => {
        if (step === 2) goToStep(1);
        else if (step === 3) goToStep(2);
    };

    const handleSubmit = async () => {
        if (!validateStep3()) return;

        setIsSubmitting(true);
        try {
            // Upload documents to Firebase Storage using dedicated KYC upload function
            let aadhaarUrl = '';
            let kisanUrl = '';
            if (documents.aadhaarFile) {
                aadhaarUrl = await firebaseService.uploadKYCDocument(documents.aadhaarFile, currentUser.uid, 'aadhaar');
            }
            if (documents.kisanFile) {
                kisanUrl = await firebaseService.uploadKYCDocument(documents.kisanFile, currentUser.uid, 'kisan');
            }

            // Save KYC data to Firestore
            await firebaseService.saveFarmerKYC(currentUser.uid, {
                personalInfo,
                documents: {
                    aadhaarUrl,
                    kisanUrl,
                },
                bankInfo,
                status: 'pending',
                submittedAt: new Date(),
            });

            // Update user profile with location
            await firebaseService.upsertUserProfile({
                ...currentUser,
                name: personalInfo.fullName,
                phone: personalInfo.mobile,
                location: personalInfo.village,
            });

            showToast('KYC submitted successfully! We will verify your details shortly.', 'success');
            onComplete();
        } catch (error) {
            console.error('KYC submission failed:', error);
            showToast('Failed to submit KYC. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-stone-50 via-green-50/30 to-stone-50 overflow-y-auto">
            {/* Background decorations */}
            <div className="fixed top-20 left-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
            <div className="fixed bottom-20 right-10 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative min-h-full w-full flex flex-col">
                {/* Header */}
                <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/40 px-3 sm:px-4 md:px-10 py-3 sm:py-4 shadow-sm">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {(step > 1 || !required) && (
                                <button
                                    onClick={step === 1 ? onClose : handleBack}
                                    className="flex items-center justify-center p-2 rounded-full hover:bg-white/50 transition-colors text-stone-600"
                                >
                                    <span className="material-symbols-outlined text-3xl">arrow_back</span>
                                </button>
                            )}
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="relative h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center bg-gradient-to-br from-primary to-green-600 text-white rounded-lg sm:rounded-xl shadow-lg">
                                    <span className="material-symbols-outlined text-xl sm:text-2xl">agriculture</span>
                                </div>
                                <h2 className="text-stone-900 text-lg sm:text-xl lg:text-2xl font-black tracking-tight hidden sm:block">Anna Bazaar</h2>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 backdrop-blur-sm hover:bg-white transition-all shadow-sm group border border-white/50">
                                <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform text-xl">help</span>
                                <span className="hidden sm:inline font-bold text-stone-700">Help</span>
                            </button>
                            {!required && (
                                <button onClick={onClose} className="p-2 rounded-full hover:bg-white/50 transition-colors">
                                    <XIcon className="h-6 w-6 text-stone-600" />
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-12 flex flex-col items-center gap-6 sm:gap-8 lg:gap-10 pb-24 sm:pb-32">
                    {/* Neon Progress Stepper */}
                    <NeonProgressBar steps={KYC_STEPS} currentStep={step} className="mt-6" />

                    {/* Step Content with slide animation */}
                    <div className="w-full max-w-3xl overflow-hidden mt-8">
                        <div
                            className={`transform transition-all duration-500 ease-out ${
                                slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
                            }`}
                            key={step}
                        >
                            {step === 1 && (
                                <div className="relative group perspective-1000">
                                    {/* Background decorative blobs */}
                                    <div className="absolute -top-20 -left-20 w-56 h-56 bg-yellow-300/20 rounded-full blur-3xl animate-float pointer-events-none" style={{ animationDelay: '0s' }} />
                                    <div className="absolute top-1/2 -right-20 w-64 h-64 bg-primary/15 rounded-full blur-3xl animate-float pointer-events-none" style={{ animationDelay: '2s' }} />
                                    
                                    {/* Glass card */}
                                    <div className="relative bg-white/65 backdrop-blur-xl sm:backdrop-blur-2xl rounded-2xl sm:rounded-[2.5rem] p-0.5 sm:p-1 border border-white/80 overflow-hidden shadow-[0_10px_30px_-12px_rgba(0,0,0,0.1)] sm:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]">
                                        {/* Inner highlight gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/20 to-transparent pointer-events-none" />
                                        
                                        <div className="relative bg-white/40 rounded-xl sm:rounded-[2.3rem] p-4 sm:p-6 md:p-10 lg:p-12 backdrop-blur-xl z-10">
                                            {/* Header */}
                                            <div className="text-center mb-6 sm:mb-8 lg:mb-10">
                                                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-2 sm:mb-3 lg:mb-4 tracking-tight leading-tight">
                                                    <span className="bg-gradient-to-r from-stone-900 via-primary to-sky-500 bg-clip-text text-transparent bg-[length:200%_200%] animate-shimmer">
                                                        Tell Us About Yourself
                                                    </span>
                                                </h1>
                                                <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-stone-700 font-bold max-w-md mx-auto leading-relaxed drop-shadow-sm">
                                                    Your details help us serve you better.
                                                </p>
                                            </div>

                                            {/* Profile Photo Upload */}
                                            <div className="mb-8 sm:mb-10 lg:mb-12 flex flex-col items-center">
                                                <input
                                                    ref={photoInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handlePhotoUpload}
                                                    className="hidden"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => photoInputRef.current?.click()}
                                                    className="group relative cursor-pointer"
                                                >
                                                    <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 lg:w-44 md:h-40 lg:h-44 rounded-full bg-white/60 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed border-primary/60 hover:border-primary transition-all duration-300 shadow-inner hover:shadow-[0_0_25px_rgba(19,236,30,0.3)] overflow-hidden relative z-10">
                                                        {personalInfo.photoPreview ? (
                                                            <img 
                                                                src={personalInfo.photoPreview} 
                                                                alt="Profile preview" 
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2 transition-opacity duration-300 group-hover:opacity-100 z-20">
                                                                <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1 animate-pulse border border-primary/20">
                                                                    <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                                                                </div>
                                                                <span className="text-xs font-black text-stone-600 uppercase tracking-widest bg-white/60 px-2 py-1 rounded-full">Add Photo</span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                    </div>
                                                    {personalInfo.photoPreview && (
                                                        <div className="absolute bottom-2 right-2 size-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="material-symbols-outlined text-xl">edit</span>
                                                        </div>
                                                    )}
                                                </button>
                                            </div>

                                            <form className="space-y-4 sm:space-y-6 lg:space-y-8" onSubmit={(e) => e.preventDefault()}>
                                                {/* Full Name Input */}
                                                <div className="group/input relative">
                                                    <label className="block text-stone-500 font-extrabold text-[10px] sm:text-xs uppercase tracking-widest mb-2 sm:mb-3 ml-2 sm:ml-4">Full Name</label>
                                                    <div className="relative transition-transform duration-300 group-hover/input:-translate-y-1">
                                                        <div className="absolute inset-y-0 left-0 pl-3 sm:pl-5 flex items-center pointer-events-none z-10">
                                                            <div className="size-9 sm:size-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-white to-stone-50 border border-white shadow-sm flex items-center justify-center text-stone-400 group-focus-within/input:text-primary group-focus-within/input:shadow-[0_0_10px_rgba(19,236,30,0.3)] transition-all duration-300">
                                                                <span className="material-symbols-outlined text-xl sm:text-3xl">person</span>
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            name="fullName"
                                                            value={personalInfo.fullName}
                                                            onChange={handlePersonalInfoChange}
                                                            className="w-full h-14 sm:h-16 lg:h-20 pl-14 sm:pl-20 pr-4 sm:pr-6 rounded-xl sm:rounded-2xl bg-white/60 backdrop-blur-xl border border-white/80 text-stone-800 font-black text-base sm:text-lg md:text-xl lg:text-2xl placeholder:text-stone-400 placeholder:font-bold focus:ring-0 focus:bg-white/95 focus:border-primary/50 focus:shadow-[0_0_0_4px_rgba(19,236,30,0.15),0_10px_20px_-5px_rgba(0,0,0,0.05)] focus:-translate-y-0.5 transition-all shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),inset_0_2px_4px_0_rgba(255,255,255,0.5)]"
                                                            placeholder="Enter your full name"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Mobile Number Input */}
                                                <div className="group/input relative">
                                                    <label className="block text-stone-500 font-extrabold text-[10px] sm:text-xs uppercase tracking-widest mb-2 sm:mb-3 ml-2 sm:ml-4">Mobile Number</label>
                                                    <div className="relative transition-transform duration-300 group-hover/input:-translate-y-1">
                                                        <div className="absolute inset-y-0 left-0 pl-3 sm:pl-5 flex items-center pointer-events-none z-10">
                                                            <div className="size-9 sm:size-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-white to-stone-50 border border-white shadow-sm flex items-center justify-center text-stone-400 group-focus-within/input:text-primary group-focus-within/input:shadow-[0_0_10px_rgba(19,236,30,0.3)] transition-all duration-300">
                                                                <span className="material-symbols-outlined text-xl sm:text-3xl">smartphone</span>
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="tel"
                                                            name="mobile"
                                                            value={personalInfo.mobile}
                                                            onChange={handlePersonalInfoChange}
                                                            className="w-full h-14 sm:h-16 lg:h-20 pl-14 sm:pl-20 pr-4 sm:pr-6 rounded-xl sm:rounded-2xl bg-white/60 backdrop-blur-xl border border-white/80 text-stone-800 font-black text-base sm:text-lg md:text-xl lg:text-2xl placeholder:text-stone-400 placeholder:font-bold focus:ring-0 focus:bg-white/95 focus:border-primary/50 focus:shadow-[0_0_0_4px_rgba(19,236,30,0.15),0_10px_20px_-5px_rgba(0,0,0,0.05)] focus:-translate-y-0.5 transition-all shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),inset_0_2px_4px_0_rgba(255,255,255,0.5)]"
                                                            placeholder="+91 Mobile number"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Date of Birth & Village Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                                                    <div className="group/input relative">
                                                        <label className="block text-stone-500 font-extrabold text-[10px] sm:text-xs uppercase tracking-widest mb-2 sm:mb-3 ml-2 sm:ml-4">Date of Birth</label>
                                                        <div className="relative transition-transform duration-300 group-hover/input:-translate-y-1">
                                                            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-5 flex items-center pointer-events-none z-10">
                                                                <div className="size-9 sm:size-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-white to-stone-50 border border-white shadow-sm flex items-center justify-center text-stone-400 group-focus-within/input:text-primary group-focus-within/input:shadow-[0_0_10px_rgba(19,236,30,0.3)] transition-all duration-300">
                                                                    <span className="material-symbols-outlined text-xl sm:text-3xl">calendar_month</span>
                                                                </div>
                                                            </div>
                                                            <input
                                                                type="date"
                                                                name="dateOfBirth"
                                                                value={personalInfo.dateOfBirth}
                                                                onChange={handlePersonalInfoChange}
                                                                className="w-full h-14 sm:h-16 lg:h-20 pl-14 sm:pl-20 pr-4 sm:pr-6 rounded-xl sm:rounded-2xl bg-white/60 backdrop-blur-xl border border-white/80 text-stone-800 font-black text-base sm:text-lg md:text-xl lg:text-2xl focus:ring-0 focus:bg-white/95 focus:border-primary/50 focus:shadow-[0_0_0_4px_rgba(19,236,30,0.15),0_10px_20px_-5px_rgba(0,0,0,0.05)] focus:-translate-y-0.5 transition-all shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),inset_0_2px_4px_0_rgba(255,255,255,0.5)] cursor-pointer"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="group/input relative">
                                                        <label className="block text-stone-500 font-extrabold text-[10px] sm:text-xs uppercase tracking-widest mb-2 sm:mb-3 ml-2 sm:ml-4">Village / Locality</label>
                                                        <div className="relative transition-transform duration-300 group-hover/input:-translate-y-1">
                                                            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-5 flex items-center pointer-events-none z-10">
                                                                <div className="size-9 sm:size-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-white to-stone-50 border border-white shadow-sm flex items-center justify-center text-stone-400 group-focus-within/input:text-primary group-focus-within/input:shadow-[0_0_10px_rgba(19,236,30,0.3)] transition-all duration-300">
                                                                    <span className="material-symbols-outlined text-xl sm:text-3xl">home_pin</span>
                                                                </div>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                name="village"
                                                                value={personalInfo.village}
                                                                onChange={handlePersonalInfoChange}
                                                                className="w-full h-14 sm:h-16 lg:h-20 pl-14 sm:pl-20 pr-4 sm:pr-6 rounded-xl sm:rounded-2xl bg-white/60 backdrop-blur-xl border border-white/80 text-stone-800 font-black text-base sm:text-lg md:text-xl lg:text-2xl placeholder:text-stone-400 placeholder:font-bold focus:ring-0 focus:bg-white/95 focus:border-primary/50 focus:shadow-[0_0_0_4px_rgba(19,236,30,0.15),0_10px_20px_-5px_rgba(0,0,0,0.05)] focus:-translate-y-0.5 transition-all shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),inset_0_2px_4px_0_rgba(255,255,255,0.5)]"
                                                                placeholder="Enter village"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-white/60 overflow-hidden">
                                    <div className="p-4 sm:p-6 md:p-10 flex flex-col items-center gap-4 sm:gap-6 md:gap-8">
                                        <div className="text-center">
                                            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-stone-900 mb-2 sm:mb-3 tracking-tight">Verify Your Identity</h1>
                                            <p className="text-sm sm:text-base lg:text-lg text-stone-600 font-medium max-w-md mx-auto">
                                                Upload photos of your Aadhaar card and Kisan card to unlock selling features.
                                            </p>
                                        </div>

                                        {/* Visual Instructions */}
                                        <div className="flex gap-4 sm:gap-6 md:gap-8 justify-center w-full max-w-md">
                                            <div className="flex flex-col items-center gap-1 sm:gap-2 text-center">
                                                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-green-100 flex items-center justify-center text-primary mb-1">
                                                    <span className="material-symbols-outlined text-lg sm:text-2xl">wb_sunny</span>
                                                </div>
                                                <span className="text-[10px] sm:text-xs font-bold text-stone-800">Good Light</span>
                                            </div>
                                            <div className="flex flex-col items-center gap-1 sm:gap-2 text-center opacity-60">
                                                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-1">
                                                    <span className="material-symbols-outlined text-lg sm:text-2xl">blur_off</span>
                                                </div>
                                                <span className="text-[10px] sm:text-xs font-bold text-stone-800">No Blur</span>
                                            </div>
                                            <div className="flex flex-col items-center gap-1 sm:gap-2 text-center opacity-60">
                                                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-1">
                                                    <span className="material-symbols-outlined text-lg sm:text-2xl">crop_free</span>
                                                </div>
                                                <span className="text-[10px] sm:text-xs font-bold text-stone-800">All Corners</span>
                                            </div>
                                        </div>

                                        {/* Aadhaar Upload */}
                                        <div className="w-full max-w-[480px]">
                                            <label className="block text-stone-700 font-bold text-xs sm:text-sm mb-2 sm:mb-3 ml-1">AADHAAR CARD (Front) *</label>
                                            {documents.aadhaarPreview ? (
                                                <div className="relative rounded-xl overflow-hidden border-2 border-primary bg-white shadow-lg">
                                                    <img src={documents.aadhaarPreview} alt="Aadhaar Preview" className="w-full h-48 object-cover" />
                                                    <button
                                                        onClick={removeAadhaar}
                                                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                                                    >
                                                        <XIcon className="h-5 w-5" />
                                                    </button>
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary/90 to-transparent p-3">
                                                        <div className="flex items-center gap-2 text-white">
                                                            <span className="material-symbols-outlined">check_circle</span>
                                                            <span className="font-bold">Aadhaar Uploaded</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => aadhaarInputRef.current?.click()}
                                                    className="relative group w-full aspect-[1.586] bg-stone-50 rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center p-6 cursor-pointer hover:border-primary hover:bg-green-50/30 transition-all duration-300"
                                                >
                                                    {/* Scanner corners */}
                                                    <div className="absolute top-0 left-0 w-10 h-10 border-l-4 border-t-4 border-primary rounded-tl-xl"></div>
                                                    <div className="absolute top-0 right-0 w-10 h-10 border-r-4 border-t-4 border-primary rounded-tr-xl"></div>
                                                    <div className="absolute bottom-0 left-0 w-10 h-10 border-l-4 border-b-4 border-primary rounded-bl-xl"></div>
                                                    <div className="absolute bottom-0 right-0 w-10 h-10 border-r-4 border-b-4 border-primary rounded-br-xl"></div>

                                                    <div className="relative z-10 flex flex-col items-center gap-3">
                                                        <div className="h-16 w-16 rounded-full bg-white shadow-lg flex items-center justify-center text-primary mb-2 transform group-hover:scale-110 transition-transform">
                                                            <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                                                        </div>
                                                        <h3 className="text-lg font-bold text-stone-800">Tap to Capture Aadhaar</h3>
                                                        <p className="text-sm text-stone-500 text-center max-w-[200px]">
                                                            Place front of Aadhaar card here
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            <input
                                                ref={aadhaarInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleAadhaarUpload}
                                                className="hidden"
                                            />
                                        </div>

                                        {/* Kisan Card Upload */}
                                        <div className="w-full max-w-[480px]">
                                            <label className="block text-stone-700 font-bold text-sm mb-3 ml-1">KISAN CARD *</label>
                                            {documents.kisanPreview ? (
                                                <div className="relative rounded-xl overflow-hidden border-2 border-primary bg-white shadow-lg">
                                                    <img src={documents.kisanPreview} alt="Kisan Card Preview" className="w-full h-48 object-cover" />
                                                    <button
                                                        onClick={removeKisan}
                                                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                                                    >
                                                        <XIcon className="h-5 w-5" />
                                                    </button>
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary/90 to-transparent p-3">
                                                        <div className="flex items-center gap-2 text-white">
                                                            <span className="material-symbols-outlined">check_circle</span>
                                                            <span className="font-bold">Kisan Card Uploaded</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => kisanInputRef.current?.click()}
                                                    className="relative group w-full aspect-[1.586] bg-stone-50 rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center p-6 cursor-pointer hover:border-primary hover:bg-green-50/30 transition-all duration-300"
                                                >
                                                    {/* Scanner corners */}
                                                    <div className="absolute top-0 left-0 w-10 h-10 border-l-4 border-t-4 border-primary rounded-tl-xl"></div>
                                                    <div className="absolute top-0 right-0 w-10 h-10 border-r-4 border-t-4 border-primary rounded-tr-xl"></div>
                                                    <div className="absolute bottom-0 left-0 w-10 h-10 border-l-4 border-b-4 border-primary rounded-bl-xl"></div>
                                                    <div className="absolute bottom-0 right-0 w-10 h-10 border-r-4 border-b-4 border-primary rounded-br-xl"></div>

                                                    <div className="relative z-10 flex flex-col items-center gap-3">
                                                        <div className="h-16 w-16 rounded-full bg-white shadow-lg flex items-center justify-center text-green-600 mb-2 transform group-hover:scale-110 transition-transform">
                                                            <span className="material-symbols-outlined text-3xl">credit_card</span>
                                                        </div>
                                                        <h3 className="text-lg font-bold text-stone-800">Tap to Capture Kisan Card</h3>
                                                        <p className="text-sm text-stone-500 text-center max-w-[200px]">
                                                            Place your Kisan card here
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            <input
                                                ref={kisanInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleKisanUpload}
                                                className="hidden"
                                            />
                                        </div>
                                    </div>

                                    {/* Security Footer */}
                                    <div className="bg-stone-50 border-t border-stone-100 p-4 flex items-center justify-center gap-6">
                                        <div className="flex items-center gap-2 text-xs text-stone-500">
                                            <span className="material-symbols-outlined text-green-600 text-base">lock</span>
                                            <span>256-bit Encryption</span>
                                        </div>
                                        <div className="w-px h-4 bg-stone-300"></div>
                                        <div className="flex items-center gap-2 text-xs text-stone-500">
                                            <span className="material-symbols-outlined text-green-600 text-base">verified</span>
                                            <span>Govt. Approved Secure</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl p-1 md:p-2 border border-white/60 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-green-400 to-primary"></div>
                                    <div className="bg-white/40 rounded-2xl p-6 md:p-10 backdrop-blur-sm">
                                        <div className="text-center mb-10">
                                            <div className="inline-flex justify-center items-center p-4 bg-gradient-to-br from-green-50 to-white rounded-full shadow-inner mb-4">
                                                <span className="material-symbols-outlined text-primary text-5xl md:text-6xl">account_balance</span>
                                            </div>
                                            <h1 className="text-3xl md:text-4xl font-black text-stone-900 mb-3 tracking-tight">Bank Account Details</h1>
                                            <p className="text-lg md:text-xl text-stone-600 font-medium max-w-md mx-auto">Add your bank details to receive direct payments.</p>
                                        </div>

                                        <form className="space-y-6 md:space-y-8" onSubmit={(e) => e.preventDefault()}>
                                            <div className="group/input">
                                                <label className="block text-stone-700 font-bold text-sm mb-2 ml-1">ACCOUNT HOLDER NAME</label>
                                                <div className="relative transition-all duration-300 transform group-hover/input:-translate-y-1">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                        <span className="material-symbols-outlined text-primary text-2xl">person</span>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        name="accountHolder"
                                                        value={bankInfo.accountHolder}
                                                        onChange={handleBankInfoChange}
                                                        className="w-full h-16 pl-14 pr-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-stone-200/50 text-stone-900 font-bold text-lg placeholder:text-stone-400 focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                                        placeholder="As per bank records"
                                                    />
                                                </div>
                                            </div>

                                            <div className="group/input">
                                                <label className="block text-stone-700 font-bold text-sm mb-2 ml-1">ACCOUNT NUMBER</label>
                                                <div className="relative transition-all duration-300 transform group-hover/input:-translate-y-1">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                        <span className="material-symbols-outlined text-primary text-2xl">pin</span>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        name="accountNumber"
                                                        value={bankInfo.accountNumber}
                                                        onChange={handleBankInfoChange}
                                                        className="w-full h-16 pl-14 pr-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-stone-200/50 text-stone-900 font-bold text-lg placeholder:text-stone-400 focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                                        placeholder="Enter your account number"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                                <div className="group/input">
                                                    <label className="block text-stone-700 font-bold text-sm mb-2 ml-1">IFSC CODE</label>
                                                    <div className="relative transition-all duration-300 transform group-hover/input:-translate-y-1">
                                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                            <span className="material-symbols-outlined text-primary text-2xl">tag</span>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            name="ifscCode"
                                                            value={bankInfo.ifscCode}
                                                            onChange={handleBankInfoChange}
                                                            className="w-full h-16 pl-14 pr-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-stone-200/50 text-stone-900 font-bold text-lg placeholder:text-stone-400 focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all shadow-sm uppercase"
                                                            placeholder="SBIN0001234"
                                                            maxLength={11}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="group/input">
                                                    <label className="block text-stone-700 font-bold text-sm mb-2 ml-1">BANK NAME</label>
                                                    <div className="relative transition-all duration-300 transform group-hover/input:-translate-y-1">
                                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                            <span className="material-symbols-outlined text-primary text-2xl">account_balance</span>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            name="bankName"
                                                            value={bankInfo.bankName}
                                                            onChange={handleBankInfoChange}
                                                            className="w-full h-16 pl-14 pr-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-stone-200/50 text-stone-900 font-bold text-lg placeholder:text-stone-400 focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                                            placeholder="State Bank of India"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Benefits Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl px-2">
                        <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl flex items-center gap-4 transition-transform hover:-translate-y-1 hover:shadow-lg group cursor-default border border-white/60">
                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-3xl">payments</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-stone-800 text-base">Direct Payments</h4>
                                <p className="text-xs text-stone-500 font-medium">To your bank account</p>
                            </div>
                        </div>
                        <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl flex items-center gap-4 transition-transform hover:-translate-y-1 hover:shadow-lg group cursor-default border border-white/60">
                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-3xl">bolt</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-stone-800 text-base">Instant Approval</h4>
                                <p className="text-xs text-stone-500 font-medium">Start selling fast</p>
                            </div>
                        </div>
                        <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl flex items-center gap-4 transition-transform hover:-translate-y-1 hover:shadow-lg group cursor-default border border-white/60">
                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-3xl">verified_user</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-stone-800 text-base">Data Privacy</h4>
                                <p className="text-xs text-stone-500 font-medium">100% Secure & Private</p>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Sticky Bottom CTA */}
                <div className="sticky bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-stone-200/50 p-4 z-50 flex justify-center shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                    <button
                        onClick={step === 3 ? handleSubmit : handleNext}
                        disabled={isSubmitting}
                        className="w-full md:w-auto md:min-w-[400px] h-16 bg-gradient-to-r from-primary to-green-600 hover:to-green-500 active:scale-[0.98] rounded-full flex items-center justify-center gap-3 text-white font-black text-xl shadow-lg transition-all duration-300 transform group disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <LoaderIcon className="h-6 w-6 animate-spin" />
                                <span>Submitting...</span>
                            </>
                        ) : (
                            <>
                                <span>
                                    {step === 1 && 'Continue to ID Upload'}
                                    {step === 2 && 'Continue to Bank Details'}
                                    {step === 3 && 'Submit & Verify'}
                                </span>
                                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-3xl">arrow_forward</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slide-in-right {
                    from {
                        opacity: 0;
                        transform: translateX(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes slide-in-left {
                    from {
                        opacity: 0;
                        transform: translateX(-30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.4s ease-out forwards;
                }
                .animate-slide-in-left {
                    animation: slide-in-left 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

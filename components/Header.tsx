
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { ShoppingCartIcon, UserIcon, SwitchHorizontalIcon, HamburgerMenuIcon, XIcon, PackageIcon, ClipboardListIcon, ChatBubbleIcon, LogoutIcon } from './icons';

interface HeaderProps {
    user: User;
    onSwitchRole: () => void;
    cartItemCount: number;
    onCartClick: () => void;
}

const UserMenu = ({ user, onSwitchRole }: { user: User, onSwitchRole: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const themeColor = user.role === UserRole.Farmer ? 'farmer-primary' : 'primary';

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-${themeColor} font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${themeColor}`}
            >
                {user.avatarUrl ? <img src={user.avatarUrl} alt="User" className="w-full h-full rounded-full object-cover" /> : <span>{initials}</span>}
            </button>
            {isOpen && (
                <div 
                    className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none animate-fade-in" 
                    role="menu" 
                    aria-orientation="vertical" 
                    aria-labelledby="user-menu-button"
                    style={{animationDuration: '150ms'}}
                >
                    <div className="px-4 py-3 border-b border-stone-200">
                        <p className="text-sm text-stone-700" role="none">Signed in as</p>
                        <p className="text-sm font-semibold text-stone-900 truncate" role="none">{user.name} ({user.role})</p>
                    </div>
                    <div className="py-1">
                        <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100" role="menuitem">
                           <UserIcon className="w-4 h-4 text-stone-500" /> My Profile
                        </a>
                         <button
                            onClick={onSwitchRole}
                            className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
                            role="menuitem"
                        >
                           <SwitchHorizontalIcon className="w-4 h-4 text-stone-500" /> Switch Role
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const MobileMenu = ({ user, onSwitchRole, cartItemCount, onCartClick, onClose }: HeaderProps & { onClose: () => void }) => {
    const isFarmer = user.role === UserRole.Farmer;
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();

    const menuItems = [
        { label: 'My Profile', icon: <UserIcon className="w-5 h-5" />, action: () => console.log('Profile clicked'), role: 'all' },
        { label: 'My Cart', icon: <ShoppingCartIcon className="w-5 h-5" />, action: onCartClick, role: UserRole.Buyer, badge: cartItemCount },
        { label: 'My Orders', icon: <PackageIcon className="w-5 h-5" />, action: () => console.log('Orders clicked'), role: UserRole.Buyer },
        { label: 'My Inventory', icon: <ClipboardListIcon className="w-5 h-5" />, action: () => console.log('Inventory clicked'), role: UserRole.Farmer },
        { label: 'My Negotiations', icon: <ChatBubbleIcon className="w-5 h-5" />, action: () => console.log('Negotiations clicked'), role: 'all' },
    ];

    const visibleItems = menuItems.filter(item => item.role === 'all' || item.role === user.role);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in" style={{ animationDuration: '150ms' }} onClick={onClose}>
            <div
                className="absolute inset-y-0 left-0 w-4/5 max-w-xs bg-stone-50 shadow-xl z-50 flex flex-col animate-slide-in-left"
                onClick={e => e.stopPropagation()}
            >
                {/* Menu Header */}
                <div className={`p-4 ${isFarmer ? 'bg-gradient-to-br from-farmer-primary to-farmer-primary-light' : 'bg-gradient-to-br from-primary to-primary-light'} text-white flex items-center justify-between`}>
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center font-bold text-xl">
                            {user.avatarUrl ? <img src={user.avatarUrl} alt="User" className="w-full h-full rounded-full object-cover" /> : <span>{initials}</span>}
                        </div>
                        <div>
                            <p className="font-bold">{user.name}</p>
                            <p className="text-sm opacity-90">{user.role}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2" aria-label="Close menu">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Menu Items */}
                <nav className="flex-1 py-4 space-y-2">
                    {visibleItems.map(item => (
                        <button key={item.label} onClick={item.action} className="w-full text-left flex items-center justify-between px-4 py-3 text-stone-700 hover:bg-stone-200/60 transition-colors">
                            <div className="flex items-center space-x-4">
                                {item.icon}
                                <span className="font-semibold">{item.label}</span>
                            </div>
                            {item.badge && item.badge > 0 && (
                                <span className={`${isFarmer ? 'bg-farmer-primary' : 'bg-primary'} text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center`}>{item.badge}</span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Menu Footer */}
                <div className="p-4 border-t border-stone-200 space-y-2">
                    <button
                        onClick={onSwitchRole}
                        className="w-full text-left flex items-center gap-4 px-4 py-3 text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors"
                    >
                       <SwitchHorizontalIcon className="w-5 h-5 text-stone-500" />
                       <span className="font-semibold">Switch Role</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const Header = ({ user, onSwitchRole, cartItemCount, onCartClick }: HeaderProps) => {
    const isFarmer = user.role === UserRole.Farmer;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isMenuOpen]);
    
    return (
        <>
            <header className={`bg-background/80 backdrop-blur-lg shadow-sm sticky top-0 z-20 transition-colors duration-300 border-b border-stone-200/80`}>
                <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14 sm:h-16 md:h-20">
                        <div className="flex-shrink-0">
                            <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold font-heading ${isFarmer ? 'text-farmer-primary' : 'text-primary'}`}>
                                Anna Bazaar
                            </h1>
                        </div>
                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-6">
                            {user.role === UserRole.Buyer && (
                                <button onClick={onCartClick} className="relative group" aria-label={`View cart with ${cartItemCount} items`}>
                                    <ShoppingCartIcon className="h-7 w-7 text-stone-600 group-hover:text-primary transition-colors"/>
                                    {cartItemCount > 0 && <span className="absolute -top-2 -right-2 bg-primary text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse-strong">{cartItemCount}</span>}
                                </button>
                            )}
                            <UserMenu user={user} onSwitchRole={onSwitchRole} />
                        </div>
                        {/* Mobile Menu Button */}
                        <div className="md:hidden">
                            <button onClick={() => setIsMenuOpen(true)} className="p-2 -mr-2" aria-label="Open menu">
                                <HamburgerMenuIcon className="h-7 w-7 text-stone-600" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            {isMenuOpen && (
                <MobileMenu
                    user={user}
                    onSwitchRole={() => {
                        onSwitchRole();
                        setIsMenuOpen(false);
                    }}
                    cartItemCount={cartItemCount}
                    onCartClick={() => {
                        onCartClick();
                        setIsMenuOpen(false);
                    }}
                    onClose={() => setIsMenuOpen(false)}
                />
            )}
        </>
    );
}
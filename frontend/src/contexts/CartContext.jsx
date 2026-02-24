import React, { createContext, useContext, useState, useCallback } from 'react';
import { useProductStore } from './ProductStoreContext';

const CartContext = createContext();

function load(key, fb) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fb; } catch { return fb; }
}
function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export const CartProvider = ({ children }) => {
    const { products } = useProductStore();
    const [items, setItems] = useState(() => load('stakd-cart', []));
    // items: [{ productId: string, quantity: number }]

    const persist = useCallback((next) => {
        setItems(next);
        save('stakd-cart', next);
    }, []);

    const addToCart = useCallback((productId, quantity = 1) => {
        setItems(prev => {
            const existing = prev.find(i => i.productId === productId);
            const next = existing
                ? prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i)
                : [...prev, { productId, quantity }];
            save('stakd-cart', next);
            return next;
        });
    }, []);

    const removeFromCart = useCallback((productId) => {
        setItems(prev => {
            const next = prev.filter(i => i.productId !== productId);
            save('stakd-cart', next);
            return next;
        });
    }, []);

    const updateQuantity = useCallback((productId, quantity) => {
        if (quantity < 1) return;
        setItems(prev => {
            const next = prev.map(i => i.productId === productId ? { ...i, quantity } : i);
            save('stakd-cart', next);
            return next;
        });
    }, []);

    const clearCart = useCallback(() => persist([]), [persist]);

    const isInCart = (productId) => items.some(i => i.productId === productId);
    const getQuantity = (productId) => items.find(i => i.productId === productId)?.quantity ?? 0;

    const cartItems = items
        .map(i => {
            const product = products.find(p => p.id === i.productId);
            return product ? { product, quantity: i.quantity } : null;
        })
        .filter(Boolean);

    const cartCount = items.reduce((s, i) => s + i.quantity, 0);
    const cartSubtotal = cartItems.reduce((s, { product, quantity }) => s + product.price * quantity, 0);

    return (
        <CartContext.Provider value={{
            cartItems, cartCount, cartSubtotal,
            addToCart, removeFromCart, updateQuantity, clearCart,
            isInCart, getQuantity,
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error('useCart must be used inside CartProvider');
    return ctx;
};

export default CartContext;

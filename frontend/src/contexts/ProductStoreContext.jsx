import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { PRODUCTS as BASE_PRODUCTS, CATEGORIES } from '../data/products';

const STORAGE_KEY = 'stakd-product-overrides';

function loadOverrides() {
    try {
        const s = localStorage.getItem(STORAGE_KEY);
        return s ? JSON.parse(s) : {};
    } catch {
        return {};
    }
}

function saveOverrides(obj) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {}
}

function mergeProduct(base, overrides) {
    if (!overrides || Object.keys(overrides).length === 0) return base;
    return { ...base, ...overrides };
}

const ProductStoreContext = createContext();

export const ProductStoreProvider = ({ children }) => {
    const [overrides, setOverrides] = useState(loadOverrides);

    const products = useMemo(() => {
        return BASE_PRODUCTS.map(p => mergeProduct(p, overrides[p.id]));
    }, [overrides]);

    const setProductOverride = useCallback((id, patch) => {
        setOverrides(prev => {
            const next = { ...prev, [id]: { ...(prev[id] || {}), ...patch } };
            saveOverrides(next);
            return next;
        });
    }, []);

    const getProduct = useCallback((id) => {
        const base = BASE_PRODUCTS.find(p => p.id === id);
        if (!base) return null;
        return mergeProduct(base, overrides[id]);
    }, [overrides]);

    const getProductsByCategory = useCallback((categoryId) => {
        if (categoryId === 'all') return products;
        return products.filter(p => p.category === categoryId);
    }, [products]);

    const featured = useMemo(() => products.filter(p => p.featured), [products]);

    const value = useMemo(() => ({
        products,
        featured,
        getProduct,
        getProductsByCategory,
        setProductOverride,
        categories: CATEGORIES,
    }), [products, featured, getProduct, getProductsByCategory, setProductOverride]);

    return (
        <ProductStoreContext.Provider value={value}>
            {children}
        </ProductStoreContext.Provider>
    );
};

export const useProductStore = () => {
    const ctx = useContext(ProductStoreContext);
    if (!ctx) throw new Error('useProductStore must be used inside ProductStoreProvider');
    return ctx;
};

export default ProductStoreContext;

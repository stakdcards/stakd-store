import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { fetchProducts, updateProduct } from '../services/products';
import { CATEGORIES } from '../constants/categories';

const ProductStoreContext = createContext();

export const ProductStoreProvider = ({ children }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await fetchProducts();
            setProducts(list);
        } catch (e) {
            setError(e?.message || 'Failed to load products');
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refetch();
    }, [refetch]);

    const setProductOverride = useCallback(async (id, patch) => {
        const numericPatch = {
            price: patch.price != null ? Number(patch.price) : undefined,
            in_stock: patch.inStock,
            featured: patch.featured,
            limited: patch.limited,
            images: patch.images,
        };
        const filtered = Object.fromEntries(Object.entries(numericPatch).filter(([, v]) => v !== undefined));
        if (patch.inStock !== undefined) filtered.in_stock = patch.inStock;
        if (patch.featured !== undefined) filtered.featured = patch.featured;
        if (patch.limited !== undefined) filtered.limited = patch.limited;
        if (patch.images !== undefined) filtered.images = patch.images;
        await updateProduct(id, filtered);
        await refetch();
    }, [refetch]);

    const getProduct = useCallback((id) => {
        return products.find(p => p.id === id) || null;
    }, [products]);

    const getProductsByCategory = useCallback((categoryId) => {
        if (categoryId === 'all') return products;
        return products.filter(p => p.category === categoryId);
    }, [products]);

    const featured = useMemo(() => products.filter(p => p.featured), [products]);

    const value = useMemo(() => ({
        products,
        featured,
        loading,
        error,
        getProduct,
        getProductsByCategory,
        setProductOverride,
        refetch,
        categories: CATEGORIES,
    }), [products, featured, loading, error, getProduct, getProductsByCategory, setProductOverride, refetch]);

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

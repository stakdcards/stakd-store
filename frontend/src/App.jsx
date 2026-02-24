import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { ProductStoreProvider } from './contexts/ProductStoreContext';
import { CartProvider } from './contexts/CartContext';
import Landing from './pages/Landing';
import Products from './pages/Products';
import Gallery from './pages/Gallery';
import Cart from './pages/Cart';
import About from './pages/About';
import Admin from './pages/Admin';

function App() {
    return (
        <DarkModeProvider>
            <ProductStoreProvider>
                <CartProvider>
                    <BrowserRouter>
                    <Routes>
                        <Route path="/"         element={<Landing />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/gallery"  element={<Gallery />} />
                        <Route path="/cart"     element={<Cart />} />
                        <Route path="/about"    element={<About />} />
                        <Route path="/admin"    element={<Admin />} />
                        {/* Legacy redirects */}
                        <Route path="/builder"    element={<Navigate to="/products" replace />} />
                        <Route path="/collection" element={<Navigate to="/products" replace />} />
                        <Route path="/checkout"   element={<Navigate to="/cart" replace />} />
                        <Route path="*"           element={<Navigate to="/" replace />} />
                    </Routes>
                    </BrowserRouter>
                </CartProvider>
            </ProductStoreProvider>
        </DarkModeProvider>
    );
}

export default App;

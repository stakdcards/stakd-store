import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProductStoreProvider } from './contexts/ProductStoreContext';
import { CartProvider } from './contexts/CartContext';
import AdminRoute from './components/AdminRoute';
import AccountRoute from './components/AccountRoute';
import Landing from './pages/Landing';
import Products from './pages/Products';
import Gallery from './pages/Gallery';
import Cart from './pages/Cart';
import CheckoutSuccess from './pages/CheckoutSuccess';
import About from './pages/About';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Account from './pages/Account';

function App() {
    return (
        <DarkModeProvider>
            <AuthProvider>
                <ProductStoreProvider>
                    <CartProvider>
                        <BrowserRouter>
                        <Routes>
                            <Route path="/"         element={<Landing />} />
                            <Route path="/products" element={<Products />} />
                            <Route path="/gallery"  element={<Gallery />} />
                            <Route path="/cart"     element={<Cart />} />
                            <Route path="/checkout/success" element={<CheckoutSuccess />} />
                            <Route path="/about"    element={<About />} />
                            <Route path="/login"    element={<Login />} />
                            <Route path="/account"  element={<AccountRoute><Account /></AccountRoute>} />
                            <Route path="/admin"    element={<AdminRoute><Admin /></AdminRoute>} />
                        {/* Legacy redirects */}
                        <Route path="/builder"    element={<Navigate to="/products" replace />} />
                        <Route path="/collection" element={<Navigate to="/products" replace />} />
                        <Route path="/checkout"   element={<Navigate to="/cart" replace />} />
                        <Route path="*"           element={<Navigate to="/" replace />} />
                    </Routes>
                        </BrowserRouter>
                    </CartProvider>
                </ProductStoreProvider>
            </AuthProvider>
        </DarkModeProvider>
    );
}

export default App;

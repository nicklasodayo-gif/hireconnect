import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Router } from "./Router";

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Navbar />
        <main><Router /></main>
        <Footer />
      </ToastProvider>
    </AuthProvider>
  );
}

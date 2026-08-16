import { QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import BankingLayout from "@/components/BankingLayout";
import AdminLayout from "@/components/AdminLayout";
import AuthLayout from "@/components/AuthLayout";
const Landing=lazy(()=>import("@/pages/Landing"));
const Login=lazy(()=>import("@/pages/auth/Login"));
const SignUp=lazy(()=>import("@/pages/auth/SignUp"));
const AdminLogin=lazy(()=>import("@/pages/auth/AdminLogin"));
const Dashboard=lazy(()=>import("@/pages/Dashboard"));
const Accounts=lazy(()=>import("@/pages/Accounts"));
const Transfer=lazy(()=>import("@/pages/Transfer"));
const Cards=lazy(()=>import("@/pages/Cards"));
const Activity=lazy(()=>import("@/pages/Activity"));
const TransactionDetails=lazy(()=>import("@/pages/TransactionDetails"));
const Account=lazy(()=>import("@/pages/Account"));
const NotFound=lazy(()=>import("@/pages/not-found"));
const AdminDashboard=lazy(()=>import("@/pages/admin/AdminDashboard"));
const UserManagement=lazy(()=>import("@/pages/admin/UserManagement"));
const TransactionMonitor=lazy(()=>import("@/pages/admin/TransactionMonitor"));
const AdminTransactionDetails=lazy(()=>import("@/pages/admin/AdminTransactionDetails"));
const CustomerDetails=lazy(()=>import("@/pages/admin/CustomerDetails"));
const CreateCustomer=lazy(()=>import("@/pages/admin/CreateCustomer"));
const MotionExperience=lazy(()=>import("@/components/MotionExperience"));

function ProtectedBankingRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background p-6 lg:p-10" aria-label="Loading account">
        <div className="mx-auto max-w-7xl animate-pulse space-y-8">
          <div className="h-10 w-56 rounded-lg bg-muted" />
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="h-72 rounded-2xl bg-muted" />
            <div className="h-72 rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <BankingLayout>{children}</BankingLayout>;
}

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [hasLocalAccess,setHasLocalAccess]=useState<boolean|null>(null);

  useEffect(()=>{
    let active=true;
    if(!user?.isAdmin){setHasLocalAccess(null);return()=>{active=false;};}
    setHasLocalAccess(null);
    fetch("/api/admin/access",{credentials:"include"}).then((response)=>{if(active)setHasLocalAccess(response.ok);}).catch(()=>{if(active)setHasLocalAccess(false);});
    return()=>{active=false;};
  },[user]);

  if (isLoading) return <div className="min-h-[100dvh] animate-pulse bg-muted" aria-label="Loading administrator session" />;
  if (!user||!user.isAdmin) return <Navigate to="/admin/login" replace />;
  if (hasLocalAccess===null) return <div className="min-h-[100dvh] animate-pulse bg-muted" aria-label="Verifying local administrator access" />;
  if (!hasLocalAccess) return <Navigate to="/admin/login" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

function BankingRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthLayout><Login /></AuthLayout>} />
      <Route path="/signup" element={<AuthLayout><SignUp /></AuthLayout>} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/dashboard" element={<ProtectedBankingRoute><Dashboard /></ProtectedBankingRoute>} />
      <Route path="/accounts" element={<ProtectedBankingRoute><Accounts /></ProtectedBankingRoute>} />
      <Route path="/transfer" element={<ProtectedBankingRoute><Transfer /></ProtectedBankingRoute>} />
      <Route path="/cards" element={<ProtectedBankingRoute><Cards /></ProtectedBankingRoute>} />
      <Route path="/activity" element={<ProtectedBankingRoute><Activity /></ProtectedBankingRoute>} />
      <Route path="/activity/:transactionId" element={<ProtectedBankingRoute><TransactionDetails /></ProtectedBankingRoute>} />
      <Route path="/account" element={<ProtectedBankingRoute><Account /></ProtectedBankingRoute>} />
      <Route path="/settings" element={<Navigate to="/account" replace />} />
      <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
      <Route path="/admin/users" element={<ProtectedAdminRoute><UserManagement /></ProtectedAdminRoute>} />
      <Route path="/admin/users/new" element={<ProtectedAdminRoute><CreateCustomer /></ProtectedAdminRoute>} />
      <Route path="/admin/users/:userId" element={<ProtectedAdminRoute><CustomerDetails /></ProtectedAdminRoute>} />
      <Route path="/admin/transactions" element={<ProtectedAdminRoute><TransactionMonitor /></ProtectedAdminRoute>} />
      <Route path="/admin/transactions/:transactionId" element={<ProtectedAdminRoute><AdminTransactionDetails /></ProtectedAdminRoute>} />
      <Route path="/auth/login" element={<Navigate to="/login" replace />} />
      <Route path="/auth/signup" element={<Navigate to="/signup" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Suspense fallback={null}><MotionExperience /></Suspense>
      <div className="relative z-10 min-h-[100dvh]">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <a href="#main-content" className="skip-link">Skip to content</a>
              <Suspense fallback={<div className="min-h-[100dvh] animate-pulse bg-muted/80" aria-label="Loading page" />}><BankingRoutes /></Suspense>
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </div>
    </ThemeProvider>
  );
}

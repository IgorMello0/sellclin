import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from '@/components/AppSidebar';
import { BillingBanner } from '@/components/BillingBanner';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

const AppLayout = () => {
  const { professional, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!professional) {
    return <Navigate to="/login" replace />;
  }

  const isFullScreen = location.pathname === '/conversations';
  const showOnboarding = professional.onboardingCompleted !== true;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row w-full bg-background font-body overflow-hidden">
      {showOnboarding && <OnboardingWizard />}
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <BillingBanner />
        {isFullScreen ? (
          <div className="flex-1 overflow-hidden">
            <RouteErrorBoundary key={location.pathname}>
              <Outlet />
            </RouteErrorBoundary>
          </div>
        ) : (
          <main className="w-full flex-1 px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 overflow-y-auto">
            <div className="max-w-[1400px] mx-auto animate-fade-in-up">
              <RouteErrorBoundary key={location.pathname}>
                <Outlet />
              </RouteErrorBoundary>
            </div>
          </main>
        )}
      </div>
    </div>
  );
};

export default AppLayout;

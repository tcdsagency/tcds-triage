import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { CallProvider } from '@/components/providers/CallProvider';
import { NotificationProvider } from '@/components/providers/NotificationProvider';
import { TwoFAProvider } from '@/components/TwoFAProvider';
import { TwoFASetup } from '@/components/providers/TwoFASetup';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { KeyboardShortcutsProvider } from '@/components/providers/KeyboardShortcutsProvider';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <NotificationProvider>
          <TwoFAProvider>
            <TwoFASetup />
            <CallProvider>
              <KeyboardShortcutsProvider>
                <Sidebar />
                <div className="lg:pl-64">
                  <Header user={user} />
                  <main className="py-6 px-4 sm:px-6 lg:px-8">
                    {children}
                  </main>
                </div>
              </KeyboardShortcutsProvider>
            </CallProvider>
          </TwoFAProvider>
        </NotificationProvider>
      </div>
    </ThemeProvider>
  );
}

import { useState } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, ClipboardList,
  AlertTriangle, BarChart3, Warehouse, Menu, X,
} from 'lucide-react';
import { Dashboard } from '@/pages/Dashboard';
import { Inventory } from '@/pages/Inventory';
import { Orders } from '@/pages/Orders';
import { Fulfillment } from '@/pages/Fulfillment';
import { Exceptions } from '@/pages/Exceptions';
import { Analytics } from '@/pages/Analytics';

type Page = 'dashboard' | 'inventory' | 'orders' | 'fulfillment' | 'exceptions' | 'analytics';

const navItems: { key: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'orders', label: 'Orders', icon: ShoppingCart },
  { key: 'fulfillment', label: 'Fulfillment', icon: ClipboardList },
  { key: 'exceptions', label: 'Exceptions', icon: AlertTriangle },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navigate = (p: string) => {
    setPage(p as Page);
    setMobileNavOpen(false);
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'inventory': return <Inventory />;
      case 'orders': return <Orders />;
      case 'fulfillment': return <Fulfillment />;
      case 'exceptions': return <Exceptions />;
      case 'analytics': return <Analytics />;
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar - Desktop */}
      <aside
        className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent)', color: '#001a14' }}>
            <Warehouse size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-[#e8ecf4] leading-tight">WarehouseOps</div>
            <div className="text-xs text-[#5a6478] leading-tight">Smart Operations</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`nav-item w-full ${page === item.key ? 'active' : ''}`}
              >
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <div className="text-xs text-[#5a6478]">System Status</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse-glow" />
            <span className="text-xs text-[#8892a8]">All systems operational</span>
          </div>
        </div>
      </aside>

      {/* Mobile Nav */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setMobileNavOpen(false)} />
          <aside
            className="relative flex flex-col w-64 animate-slide-up"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="flex items-center justify-between px-5 py-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent)', color: '#001a14' }}>
                  <Warehouse size={20} />
                </div>
                <div className="text-sm font-bold text-[#e8ecf4]">WarehouseOps</div>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="btn btn-ghost !p-1.5">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key)}
                    className={`nav-item w-full ${page === item.key ? 'active' : ''}`}
                  >
                    <Icon size={18} /> {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header
          className="lg:hidden flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent)', color: '#001a14' }}>
              <Warehouse size={16} />
            </div>
            <span className="text-sm font-bold text-[#e8ecf4]">WarehouseOps</span>
          </div>
          <button onClick={() => setMobileNavOpen(true)} className="btn btn-ghost !p-2">
            <Menu size={20} />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 lg:p-8">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;

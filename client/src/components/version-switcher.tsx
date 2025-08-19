import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Sparkles, Layout, Check, Newspaper } from 'lucide-react';

export function VersionSwitcher() {
  const [currentVersion, setCurrentVersion] = useState<'new' | 'old' | 'latent'>('new');

  useEffect(() => {
    // 从localStorage读取版本偏好
    const savedVersion = localStorage.getItem('preferredVersion') as 'new' | 'old' | 'latent';
    if (savedVersion) {
      setCurrentVersion(savedVersion);
      if (savedVersion === 'old' && window.location.pathname === '/platform') {
        window.location.href = '/platform/home-classic';
      } else if (savedVersion === 'latent' && window.location.pathname === '/platform') {
        window.location.href = '/platform/home-latent';
      }
    }
  }, []);

  const switchVersion = (version: 'new' | 'old' | 'latent') => {
    localStorage.setItem('preferredVersion', version);
    setCurrentVersion(version);
    
    if (version === 'old') {
      window.location.href = '/platform/home-classic';
    } else if (version === 'latent') {
      window.location.href = '/platform/home-latent';
    } else {
      window.location.href = '/platform';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="bg-white shadow-lg hover:shadow-xl transition-shadow"
          >
            {currentVersion === 'new' ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 text-primary-blue" />
                新版界面
              </>
            ) : currentVersion === 'latent' ? (
              <>
                <Newspaper className="w-4 h-4 mr-2 text-purple-600" />
                Latent风格
              </>
            ) : (
              <>
                <Layout className="w-4 h-4 mr-2" />
                经典界面
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>选择界面版本</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => switchVersion('new')}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-primary-blue" />
                <div>
                  <div className="font-medium">新版界面</div>
                  <div className="text-xs text-gray-500">杂志风格，优化体验</div>
                </div>
              </div>
              {currentVersion === 'new' && <Check className="w-4 h-4 text-green-600" />}
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => switchVersion('old')}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <Layout className="w-4 h-4 mr-2" />
                <div>
                  <div className="font-medium">经典界面</div>
                  <div className="text-xs text-gray-500">传统布局，功能完整</div>
                </div>
              </div>
              {currentVersion === 'old' && <Check className="w-4 h-4 text-green-600" />}
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => switchVersion('latent')}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <Newspaper className="w-4 h-4 mr-2 text-purple-600" />
                <div>
                  <div className="font-medium">Latent风格</div>
                  <div className="text-xs text-gray-500">极简内容，专注阅读</div>
                </div>
              </div>
              {currentVersion === 'latent' && <Check className="w-4 h-4 text-green-600" />}
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
import React, { useState } from 'react';
import { 
  Key, 
  Globe, 
  MessageSquare, 
  Send, 
  Cpu, 
  Zap, 
  Code, 
  ShoppingBag, 
  Copy, 
  Check, 
  ExternalLink,
  Info,
  Shield,
  Wifi
} from 'lucide-react';

interface IntegrationTab {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
}

export const MayarIntegrationScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('api-keys');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // API State
  const apiKey = 'mayar_live_550e8400-e29b-41d4-a716-446655440000';
  const clientToken = 'tok_usr_a1b2c3d4e5f6';
  const [showApiKey, setShowApiKey] = useState(false);

  // Webhook State
  const [webhookUrl, setWebhookUrl] = useState('https://api.arlabs-system.com/webhooks/mayar');
  const webhookSecret = 'whsec_MayarEndpointSecret2026!';
  const [selectedEvents, setSelectedEvents] = useState<string[]>( [
    'payment.success', 'payment.failed', 'subscription.cancelled'
  ]);

  // Whatsapp State
  const [waConnected, setWaConnected] = useState(false);
  const [waNumber, setWaNumber] = useState('');
  const [waTemplate, setWaTemplate] = useState('Halo {{name}}, tagihan Anda sebesar {{amount}} telah terbit. Silakan bayar melalui link berikut: {{link}}');

  // Telegram State
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [tgStatus, setTgStatus] = useState<'idle' | 'sending' | 'success' | 'failed'>('idle');

  // No-Code widget generator state
  const [buttonText, setButtonText] = useState('Bayar Sekarang');
  const [paymentAmount, setPaymentAmount] = useState('150000');
  const [buttonColor, setButtonColor] = useState('#2563EB');

  // Plugins State
  const [enabledPlugins, setEnabledPlugins] = useState<string[]>(['lms', 'shipping']);

  const handleCopy = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(identifier);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const toggleEvent = (event: string) => {
    if (selectedEvents.includes(event)) {
      setSelectedEvents(selectedEvents.filter(e => e !== event));
    } else {
      setSelectedEvents([...selectedEvents, event]);
    }
  };

  const handleTestTelegram = () => {
    if (!tgBotToken || !tgChatId) {
      alert('Silakan isi Bot Token dan Chat ID terlebih dahulu.');
      return;
    }
    setTgStatus('sending');
    setTimeout(() => {
      setTgStatus('success');
      setTimeout(() => setTgStatus('idle'), 3000);
    }, 1500);
  };

  const tabs: IntegrationTab[] = [
    { id: 'api-keys', label: 'API Keys & Token', icon: Key, description: 'Kelola kunci otentikasi API untuk koneksi sistem.' },
    { id: 'webhook', label: 'Webhook', icon: Globe, description: 'Konfigurasi push notifikasi event transaksi real-time.' },
    { id: 'whatsapp', label: 'Whatsapp Unofficial', icon: MessageSquare, description: 'Kirim notifikasi tagihan otomatis via nomor WhatsApp Anda.' },
    { id: 'telegram', label: 'Telegram Notification', icon: Send, description: 'Kirim log transaksi instan ke chat bot Telegram.' },
    { id: 'mcp-server', label: 'MCP Server', icon: Cpu, description: 'Hubunakan AI Agent Anda secara aman ke dashboard Mayar.' },
    { id: 'zapier', label: 'Zapier', icon: Zap, description: 'Otomasi tanpa kode dengan ribuan aplikasi eksternal.' },
    { id: 'no-code', label: 'No-Code Widget', icon: Code, description: 'Tempelkan tombol bayar instan ke website Anda.' },
    { id: 'plugins', label: 'Plugins Store', icon: ShoppingBag, description: 'Aktifkan add-on penunjang bisnis tambahan.' }
  ];

  const htmlCode = `<button 
  onclick="window.location.href='https://mayar.id/checkout/arlabs?amount=${paymentAmount}'"
  style="background-color: ${buttonColor}; color: white; padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: opacity 0.2s;"
  onmouseover="this.style.opacity=0.9"
  onmouseout="this.style.opacity=1"
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
  ${buttonText}
</button>`;

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[65vh] w-full text-gray-700 animate-[fadeInSoft_0.2s_ease-out]">
      
      {/* Internal Tabs Navigation (Left Sidebar) */}
      <div className="w-full lg:w-[280px] flex-shrink-0 flex flex-col space-y-1.5 bg-gray-50/50 p-3 rounded-2xl border border-gray-150">
        <div className="px-3 py-2">
          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Metode Integrasi</span>
        </div>
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all duration-150 border-none cursor-pointer text-left
                ${isActive 
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/10' 
                  : 'bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-800'}`}
            >
              <TabIcon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs truncate font-bold leading-tight">{tab.label}</p>
                <p className={`text-[9px] truncate mt-0.5 ${isActive ? 'text-blue-105' : 'text-gray-400 font-medium'}`}>
                  {tab.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Internal Tabs Content (Right Panel) */}
      <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl p-6 min-h-[500px] flex flex-col justify-between">
        
        <div className="space-y-6">
          {/* Header Info */}
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
              {tabs.find(t => t.id === activeTab)?.label}
              <span className="bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-blue-100">
                Mayar SDK
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-1 font-bold">
              {tabs.find(t => t.id === activeTab)?.description}
            </p>
          </div>

          {/* TAB CONTENT: API KEYS & TOKEN */}
          {activeTab === 'api-keys' && (
            <div className="space-y-5 animate-[zoomInSoft_0.15s_ease-out]">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start space-x-3">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed font-semibold">
                  API Key digunakan untuk mengautentikasi request backend sistem ArLABS ke gateway Mayar. Jagalah kerahasiaan API Key Anda dan jangan dibagikan secara bebas.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Mayar API Key (Live)</label>
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <input 
                        type={showApiKey ? 'text' : 'password'} 
                        value={apiKey} 
                        readOnly 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono pr-12 focus:outline-none"
                      />
                      <button 
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 font-bold hover:underline cursor-pointer border-none bg-transparent"
                      >
                        {showApiKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <button 
                      onClick={() => handleCopy(apiKey, 'apiKey')}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-3 rounded-xl border border-gray-200 cursor-pointer flex items-center justify-center transition-all"
                    >
                      {copiedText === 'apiKey' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Client Token</label>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      value={clientToken} 
                      readOnly 
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none"
                    />
                    <button 
                      onClick={() => handleCopy(clientToken, 'clientToken')}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-3 rounded-xl border border-gray-200 cursor-pointer flex items-center justify-center transition-all"
                    >
                      {copiedText === 'clientToken' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: WEBHOOK */}
          {activeTab === 'webhook' && (
            <div className="space-y-5 animate-[zoomInSoft_0.15s_ease-out]">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Endpoint URL</label>
                  <input 
                    type="text" 
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                    placeholder="https://yourdomain.com/webhook"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Webhook Signing Secret</label>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      value={webhookSecret} 
                      readOnly 
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none"
                    />
                    <button 
                      onClick={() => handleCopy(webhookSecret, 'webhookSecret')}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-3 rounded-xl border border-gray-200 cursor-pointer flex items-center justify-center transition-all"
                    >
                      {copiedText === 'webhookSecret' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-3">Event Triggers</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: 'payment.success', label: 'Pembayaran Sukses' },
                      { id: 'payment.failed', label: 'Pembayaran Gagal' },
                      { id: 'subscription.created', label: 'Langganan Baru' },
                      { id: 'subscription.cancelled', label: 'Langganan Dibatalkan' },
                      { id: 'customer.created', label: 'Pelanggan Terdaftar' }
                    ].map((item) => {
                      const isChecked = selectedEvents.includes(item.id);
                      return (
                        <label 
                          key={item.id} 
                          onClick={() => toggleEvent(item.id)}
                          className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer select-none transition-all
                            ${isChecked 
                              ? 'bg-blue-50/50 border-blue-200 text-blue-700' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            readOnly
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span className="text-xs font-bold">{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: WHATSAPP UNOFFICIAL */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-5 animate-[zoomInSoft_0.15s_ease-out]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 border border-gray-150 rounded-xl gap-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${waConnected ? 'bg-emerald-500 animate-[pulse_2s_infinite]' : 'bg-gray-400'}`}></div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider">Status WhatsApp</h4>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                      {waConnected ? `Terhubung (${waNumber})` : 'Belum terhubung'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    if (waConnected) {
                      setWaConnected(false);
                      setWaNumber('');
                    } else {
                      const num = prompt('Masukkan nomor WhatsApp Anda (Format: 628xxx):');
                      if (num) {
                        setWaNumber(num);
                        setWaConnected(true);
                      }
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer shadow-sm
                    ${waConnected 
                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                >
                  {waConnected ? 'Disconnect' : 'Connect Device'}
                </button>
              </div>

              {!waConnected && (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl space-y-4 text-center">
                  <div className="p-4 bg-white rounded-2xl shadow-sm">
                    {/* Simulated QR Code */}
                    <div className="w-36 h-36 bg-gray-800 flex items-center justify-center text-white text-xs font-black rounded-lg">
                      [ QR CODE SIMULATION ]
                    </div>
                  </div>
                  <div className="max-w-xs space-y-1">
                    <p className="text-xs font-bold text-gray-700">Scan QR Code dengan WhatsApp Anda</p>
                    <p className="text-[10px] text-gray-400 leading-normal">
                      Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat. Scan kode di atas untuk menghubungkan bot pengirim pesan.
                    </p>
                  </div>
                </div>
              )}

              {waConnected && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Template Notifikasi Billing</label>
                    <textarea 
                      rows={4}
                      value={waTemplate}
                      onChange={(e) => setWaTemplate(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none font-semibold leading-relaxed"
                    />
                    <p className="text-[9px] text-gray-400 mt-1 font-medium">
                      Gunakan variabel tag <code className="bg-gray-100 px-1 py-0.5 rounded text-[8px] font-mono text-gray-600">{"{{name}}"}</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-[8px] font-mono text-gray-600">{"{{amount}}"}</code>, dan <code className="bg-gray-100 px-1 py-0.5 rounded text-[8px] font-mono text-gray-600">{"{{link}}"}</code> untuk menyisipkan data pelanggan dinamis secara otomatis.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: TELEGRAM */}
          {activeTab === 'telegram' && (
            <div className="space-y-5 animate-[zoomInSoft_0.15s_ease-out]">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Telegram Bot Token</label>
                  <input 
                    type="text" 
                    value={tgBotToken}
                    onChange={(e) => setTgBotToken(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none font-mono"
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Chat ID / Group ID</label>
                  <input 
                    type="text" 
                    value={tgChatId}
                    onChange={(e) => setTgChatId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                    placeholder="Contoh: 987654321 atau -100123456789"
                  />
                </div>

                <div className="flex justify-start">
                  <button
                    onClick={handleTestTelegram}
                    disabled={tgStatus === 'sending'}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer border-none flex items-center space-x-2"
                  >
                    <span>{tgStatus === 'sending' ? 'Mengirim...' : 'Kirim Test Notifikasi'}</span>
                  </button>
                </div>

                {tgStatus === 'success' && (
                  <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-100">
                    ✓ Notifikasi uji coba berhasil dikirim! Silakan periksa channel/bot Telegram Anda.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: MCP SERVER */}
          {activeTab === 'mcp-server' && (
            <div className="space-y-5 animate-[zoomInSoft_0.15s_ease-out]">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start space-x-3">
                <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-indigo-800 uppercase tracking-wider">Apa itu Model Context Protocol (MCP)?</h4>
                  <p className="text-xs text-indigo-700 leading-relaxed font-semibold">
                    Standardisasi baru dari Anthropic yang memungkinkan LLM (seperti Cursor IDE atau Claude Desktop) membaca dan memproses data Mayar secara langsung, aman, dan instan.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Langkah Konfigurasi Claude Desktop</h4>
                <div className="bg-gray-900 text-gray-200 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-3">
                  <p className="text-gray-450">// Edit file config di: %APPDATA%\\Claude\\claude_desktop_config.json</p>
                  <pre className="text-emerald-400 font-medium">
{`{
  "mcpServers": {
    "mayar": {
      "command": "npx",
      "args": ["-y", "@mayar/mcp-server"],
      "env": {
        "MAYAR_API_KEY": "${apiKey}"
      }
    }
  }
}`}
                  </pre>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={() => handleCopy(`{\n  "mcpServers": {\n    "mayar": {\n      "command": "npx",\n      "args": ["-y", "@mayar/mcp-server"],\n      "env": {\n        "MAYAR_API_KEY": "${apiKey}"\n      }\n    }\n  }\n}`, 'mcp')}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black px-4 py-2.5 rounded-xl border border-gray-200 cursor-pointer flex items-center space-x-2"
                  >
                    {copiedText === 'mcp' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>Copy Config Block</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: ZAPIER */}
          {activeTab === 'zapier' && (
            <div className="space-y-5 animate-[zoomInSoft_0.15s_ease-out]">
              <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-200 rounded-2xl text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                  <Zap className="w-8 h-8" />
                </div>
                <div className="max-w-md space-y-2">
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Otomatiskan Alur Kerja dengan Zapier</h4>
                  <p className="text-xs text-gray-550 leading-relaxed font-semibold">
                    Hubungkan akun pembayaran Mayar.id Anda ke lebih dari 5.000+ aplikasi populer termasuk Slack, Google Sheets, ActiveCampaign, Mailchimp, Discord, dll.
                  </p>
                </div>

                <div className="pt-2">
                  <a 
                    href="https://zapier.com/apps/mayar/integrations" 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center space-x-2 bg-[#FF4F00] hover:bg-[#E04500] text-white text-xs font-black uppercase tracking-wider px-5 py-3 rounded-xl shadow-md transition-all border-none"
                  >
                    <span>Hubungkan ke Zapier</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: NO-CODE WIDGET */}
          {activeTab === 'no-code' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-[zoomInSoft_0.15s_ease-out]">
              {/* Form Customizer */}
              <div className="md:col-span-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Teks Tombol</label>
                  <input 
                    type="text" 
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Nominal Pembayaran (Rp)</label>
                  <input 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Warna Tombol (HEX)</label>
                  <div className="flex space-x-2">
                    <input 
                      type="color" 
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      className="w-12 h-10 border border-gray-200 rounded-xl p-1 bg-white cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Code Output & Preview */}
              <div className="md:col-span-7 space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2">Preview Tombol</label>
                  <div className="border border-gray-150 p-6 rounded-xl flex items-center justify-center bg-gray-50/50">
                    <button 
                      style={{ backgroundColor: buttonColor }}
                      className="text-white px-5 py-3 rounded-lg font-bold flex items-center gap-2 cursor-pointer shadow-sm hover:opacity-90 border-none transition-all active:scale-[0.98]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                      {buttonText}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider">Embed Code (HTML)</label>
                    <button 
                      onClick={() => handleCopy(htmlCode, 'embedCode')}
                      className="text-blue-600 hover:text-blue-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer border-none bg-transparent"
                    >
                      {copiedText === 'embedCode' ? 'Copied!' : 'Copy Code'}
                    </button>
                  </div>
                  <textarea 
                    rows={4}
                    value={htmlCode}
                    readOnly
                    className="w-full bg-gray-900 text-gray-300 border border-gray-800 rounded-xl px-4 py-3 text-[10px] font-mono focus:outline-none select-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: PLUGINS STORE */}
          {activeTab === 'plugins' && (
            <div className="space-y-5 animate-[zoomInSoft_0.15s_ease-out]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { 
                    id: 'lms', 
                    title: 'LMS & Course Portal', 
                    desc: 'Kelola e-learning, kursus online, dan ujian langsung terintegrasi checkout otomatis.',
                    price: 'Free'
                  },
                  { 
                    id: 'shipping', 
                    title: 'Multiple Shipping & Courier', 
                    desc: 'Integrasikan cek resi otomatis dan hitung ongkos kirim JNE, J&T, SiCepat saat checkout.',
                    price: 'Premium'
                  },
                  { 
                    id: 'invoicing', 
                    title: 'Automatic PDF Invoice', 
                    desc: 'Kirim invoice resmi dalam format PDF secara otomatis ke email klien setelah transaksi sukses.',
                    price: 'Free'
                  },
                  { 
                    id: 'custom-domain', 
                    title: 'Custom Brand Domain', 
                    desc: 'Gunakan nama domain/subdomain toko Anda sendiri untuk link checkout pembayaran Mayar.',
                    price: 'Premium'
                  }
                ].map((plugin) => {
                  const isEnabled = enabledPlugins.includes(plugin.id);
                  return (
                    <div 
                      key={plugin.id}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4
                        ${isEnabled 
                          ? 'border-blue-150 bg-blue-50/10 shadow-sm' 
                          : 'border-gray-200 bg-white'}`}
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider">{plugin.title}</h4>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full 
                            ${plugin.price === 'Free' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {plugin.price}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-450 leading-relaxed font-semibold">
                          {plugin.desc}
                        </p>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => {
                            if (isEnabled) {
                              setEnabledPlugins(enabledPlugins.filter(p => p !== plugin.id));
                            } else {
                              setEnabledPlugins([...enabledPlugins, plugin.id]);
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer
                            ${isEnabled 
                              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/10'}`}
                        >
                          {isEnabled ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Action Bar Footer */}
        <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-xs font-bold text-gray-400 mt-8">
          <span className="flex items-center gap-1.5 uppercase text-[9px] tracking-wider font-black">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            End-To-End Security SSL Enabled
          </span>
          <span className="flex items-center gap-1 uppercase text-[9px] tracking-wider font-black text-emerald-500">
            <Wifi className="w-3.5 h-3.5" />
            Online Gateway Active
          </span>
        </div>

      </div>

    </div>
  );
};

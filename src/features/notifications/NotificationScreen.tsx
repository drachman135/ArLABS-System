import React, { useEffect, useState } from 'react';
import { supabase } from '../../core/supabase';
import { RefreshCw, Loader2, Send, Bell, Shield, Smartphone, HelpCircle } from 'lucide-react';

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  target_type: 'ALL' | 'CUSTOMER' | 'APP';
  target_id: string | null;
  scheduled_at: string | null;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  created_at: string;
}

interface ApplicationOption {
  package_name: string;
  app_name: string;
}

interface CustomerOption {
  id: string;
  name: string;
  email: string;
}

export const NotificationScreen: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [apps, setApps] = useState<ApplicationOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);

  // Form states
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [targetType, setTargetType] = useState<NotificationLog['target_type']>('ALL');
  const [targetId, setTargetId] = useState<string>('');
  const [scheduleMode, setScheduleMode] = useState<'IMMEDIATE' | 'SCHEDULE'>('IMMEDIATE');
  const [scheduledTime, setScheduledTime] = useState<string>('');

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Fetch dropdown collections
  const fetchDropdownData = async () => {
    // Applications list
    const { data: appData } = await supabase
      .from('applications')
      .select('package_name, app_name')
      .order('app_name', { ascending: true });
    if (appData) setApps(appData);

    // Customers list
    const { data: custData } = await supabase
      .from('customers')
      .select('id, name, email')
      .order('name', { ascending: true });
    if (custData) setCustomers(custData);
  };

  // Fetch outbound logs
  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    fetchDropdownData();

    // Setup real-time listeners for updates (Sprint A8 real-time sync requirement)
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setLogs(prev => [payload.new as NotificationLog, ...prev]);
      })
      .subscribe();

    return () => {
      // Unsubscribe cleanly from Supabase real-time channels on component unmount
      supabase.removeChannel(channel);
    };
  }, []);

  // Update targetId state when targeting mode is altered
  useEffect(() => {
    if (targetType === 'CUSTOMER' && customers.length > 0) {
      setTargetId(customers[0].id);
    } else if (targetType === 'APP' && apps.length > 0) {
      setTargetId(apps[0].package_name);
    } else {
      setTargetId('');
    }
  }, [targetType, apps, customers]);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const sendFcmNotification = async (notifTitle: string, notifBody: string, targetTokenOrTopic: string) => {
    const serverKey = (import.meta as any).env?.VITE_FIREBASE_FCM_SERVER_KEY || 'AIzaSyBWIW92WeoXWK5Q0wmyv7KCstzXrPAzOmc';
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${serverKey}`
      },
      body: JSON.stringify({
        to: targetTokenOrTopic,
        notification: {
          title: notifTitle,
          body: notifBody,
          sound: 'default'
        },
        data: {
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          status: 'done'
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Firebase Cloud Messaging request failed with status ${response.status}`);
    }
    return true;
  };

  // Broadcast Notification after confirmation modal approve
  const executeBroadcast = async () => {
    setShowConfirmModal(false);
    setSubmitLoading(true);

    let notifId = '';
    try {
      const { data: insertedNotifs, error } = await supabase
        .from('notifications')
        .insert([
          {
            title: title,
            body: body,
            message: body,
            target_type: targetType,
            target_id: targetType === 'ALL' ? null : targetId || null,
            status: 'QUEUED',
            scheduled_at: scheduleMode === 'SCHEDULE' ? new Date(scheduledTime).toISOString() : new Date().toISOString()
          }
        ])
        .select();

      if (error || !insertedNotifs || insertedNotifs.length === 0) {
        console.error("FCM Queue Error:", error);
        alert(`Failed to queue notification: ${error?.message || 'Unknown error'}`);
        return;
      }

      notifId = insertedNotifs[0].id;

      // Dynamic token or topic lookup
      let targetTokenOrTopic = '';
      if (targetType === 'ALL') {
        targetTokenOrTopic = '/topics/all_users';
      } else if (targetType === 'CUSTOMER') {
        const { data: cust } = await supabase
          .from('customers')
          .select('fcm_token')
          .eq('id', targetId)
          .maybeSingle();
        targetTokenOrTopic = (cust as any)?.fcm_token || '';

        if (!targetTokenOrTopic) {
          alert("Token perangkat belum terdaftar, namun data antrean tetap diproses.");
        }
      } else if (targetType === 'APP') {
        targetTokenOrTopic = `/topics/${targetId.replace(/\./g, '_')}`;
      }

      // If token/topic is valid, execute send
      if (targetTokenOrTopic) {
        await sendFcmNotification(title, body, targetTokenOrTopic);
        // If successful: update status to SENT
        const { error: updateErr } = await supabase
          .from('notifications')
          .update({ status: 'SENT' })
          .eq('id', notifId);
        if (!updateErr) {
          console.log("FCM delivered successfully. Status set to SENT.");
          alert("Success! Notification payload successfully sent.");
        }
      } else {
        console.warn("No valid FCM token or topic found for target. Payload remains QUEUED.");
      }

      // Reset form fields
      setTitle('');
      setBody('');
      setScheduledTime('');
      setScheduleMode('IMMEDIATE');

    } catch (err) {
      console.error('Failed to insert metadata or broadcast notifications: ', err);
      if (notifId) {
        // Update the status of that specific notification row to 'FAILED'
        await supabase
          .from('notifications')
          .update({ status: 'FAILED' })
          .eq('id', notifId);
      }
      alert("Error: Gagal melakukan pengiriman notifikasi FCM.");
    } finally {
      // Refresh the delivery history log table state at the bottom of the screen
      if (typeof (window as any).fetchNotificationLogs === 'function') {
        (window as any).fetchNotificationLogs();
      } else {
        await fetchLogs();
      }
      setSubmitLoading(false);
    }
  };

  // Helper text to summarize targeting in confirmation modal
  const getTargetTextSummary = () => {
    if (targetType === 'ALL') return 'All Devices';
    if (targetType === 'CUSTOMER') {
      const selectedCust = customers.find(c => c.id === targetId);
      return `Client: ${selectedCust ? selectedCust.name : targetId}`;
    }
    return `App Package: ${targetId}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-['Outfit'] select-none">

      {/* 1. Frosted Glass Action Header Panel */}
      <section className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] hover:shadow-[10px_10px_20px_#d1d5db,-10px_-10px_20px_#ffffff] transition-all duration-300 p-6 rounded-[24px] flex justify-between items-center">
        <div>
          <span className="tracking-widest text-[9px] font-bold text-[#64748B] uppercase">FCM Broadcast Engine</span>
          <h3 className="text-base font-black text-[#1E293B] tracking-tight mt-1">SYS // PUSH_NOTIFICATION_BROADCAST</h3>
        </div>

        <button
          onClick={() => { fetchLogs(); fetchDropdownData(); }}
          className="border border-white bg-white hover:border-[#0EA5E9]/50 hover:bg-[#0EA5E9]/10 text-[#1E293B] hover:text-[#0EA5E9] p-2.5 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </section>

      {/* 2. Decoupled Form and Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Side: Broadcast Composer (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center space-x-2 text-[#64748B]">
            <Bell className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Broadcast Composer</span>
          </div>

          <form onSubmit={handleOpenConfirm} className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] p-6 rounded-[24px] space-y-6">

            {/* Title */}
            <div className="space-y-2">
              <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                Notification Title
              </label>
              <input
                type="text"
                required
                maxLength={64}
                placeholder="Enter alert title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm font-semibold"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                Message Content Body
              </label>
              <textarea
                required
                rows={3}
                maxLength={240}
                placeholder="Enter description message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] shadow-sm resize-none"
              />
            </div>

            {/* Targeting Scope */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                  Target Scope
                </label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as any)}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] cursor-pointer shadow-sm font-bold"
                >
                  <option value="ALL">ALL DEVICES</option>
                  <option value="CUSTOMER">SPECIFIC CLIENT</option>
                  <option value="APP">SPECIFIC PACKAGE</option>
                </select>
              </div>

              {/* Dynamic dropdown mapping instead of text input */}
              {targetType === 'CUSTOMER' && (
                <div className="space-y-2 animate-fade-in">
                  <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                    Select Client ID
                  </label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] cursor-pointer shadow-sm font-bold font-mono"
                  >
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name} [{cust.email}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === 'APP' && (
                <div className="space-y-2 animate-fade-in">
                  <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                    Select Application Package
                  </label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] cursor-pointer shadow-sm font-bold font-mono"
                  >
                    {apps.map((app) => (
                      <option key={app.package_name} value={app.package_name}>
                        {app.app_name} [{app.package_name}]
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Schedule Toggle */}
            <div className="space-y-3">
              <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-widest">
                Delivery Schedule Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleMode('IMMEDIATE')}
                  className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition-all duration-300 uppercase ${scheduleMode === 'IMMEDIATE'
                      ? 'bg-[#0EA5E9] text-white border-transparent shadow-sm'
                      : 'bg-white border-gray-200 text-[#64748B] hover:text-[#1E293B]'
                    }`}
                >
                  Immediate
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('SCHEDULE')}
                  className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition-all duration-300 uppercase ${scheduleMode === 'SCHEDULE'
                      ? 'bg-[#0EA5E9] text-white border-transparent shadow-sm'
                      : 'bg-white border-gray-200 text-[#64748B] hover:text-[#1E293B]'
                    }`}
                >
                  Schedule
                </button>
              </div>
              {scheduleMode === 'SCHEDULE' && (
                <div className="space-y-2 animate-fade-in">
                  <label className="block text-[9px] text-[#64748B] uppercase font-bold tracking-wider">
                    Execution Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg text-xs text-[#1E293B] p-2.5 focus:outline-none focus:border-[#0EA5E9] font-mono shadow-sm"
                  />
                </div>
              )}
            </div>

            {/* Broadcast submit */}
            <button
              type="submit"
              disabled={submitLoading}
              className="w-full bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-[2px_2px_5px_rgba(14,165,233,0.3)] flex items-center justify-center space-x-2 active:scale-98"
            >
              {submitLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>[ Broadcast Notification ]</span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* Right Side: Android Lockscreen Live Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-6">
          <div className="flex items-center space-x-2 text-[#64748B] self-start">
            <Smartphone className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Live Smartphone Lockscreen Preview</span>
          </div>

          {/* Android Mockup */}
          <div className="w-72 h-[480px] bg-slate-950 rounded-[40px] border-[6px] border-slate-800 shadow-[10px_10px_30px_#d1d5db,-10px_-10px_30px_#ffffff] flex flex-col justify-start items-center p-4 relative overflow-hidden">
            {/* Camera notch */}
            <div className="w-16 h-4 bg-slate-800 rounded-b-xl absolute top-0 left-1/2 -translate-x-1/2 z-10" />

            {/* Screen Wallpaper */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] opacity-90 z-0" />

            {/* Screen Header */}
            <div className="w-full flex justify-between items-center text-[10px] text-white/50 font-bold z-10 mt-1.5 px-3">
              <span>10:42</span>
              <div className="flex items-center space-x-1">
                <span className="w-2.5 h-1.5 bg-white/40 rounded-xs" />
                <span className="w-3.5 h-2 bg-white/60 rounded-xs" />
              </div>
            </div>

            {/* Lockscreen Time display */}
            <div className="text-white font-light text-5xl tracking-tight z-10 mt-8 mb-2">
              10:42
            </div>
            <div className="text-white/60 text-[10px] font-bold uppercase tracking-widest z-10 mb-8">
              Monday, June 29
            </div>

            {/* Live Notification Card Overlay */}
            <div className="w-full bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl space-y-2 z-10 shadow-lg text-left max-h-[140px] overflow-hidden">
              <div className="flex justify-between items-center text-[9px] text-white/60 font-bold uppercase">
                <span className="flex items-center">
                  <Shield className="w-3 h-3 text-[#0EA5E9] mr-1" />
                  ArLABS System
                </span>
                <span>now</span>
              </div>
              <h5 className="text-xs font-black text-white truncate">
                {title || 'Broadcast Title Preview'}
              </h5>
              <p className="text-[10px] text-white/70 leading-normal line-clamp-3 whitespace-pre-wrap">
                {body || 'Notification message description will update dynamically in real-time as you compose on the broadcast form...'}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Delivery Log history logger table */}
      <section className="space-y-6">
        <div className="flex items-center space-x-2 text-[#64748B]">
          <Bell className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Outbound Broadcast Delivery Logs</span>
        </div>

        <div className="bg-white/80 backdrop-blur-md border border-white/60 shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff] rounded-[24px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-gray-100/50 border-b border-gray-200/50 text-[#64748B] uppercase text-[9px] font-bold tracking-widest">
                <tr>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6">Notification Title</th>
                  <th className="py-4 px-6">Target Scope</th>
                  <th className="py-4 px-6">Scheduled Execution</th>
                  <th className="py-4 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[#1E293B]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#64748B]">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#0EA5E9]" />
                        <span>Querying push logs registry...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#64748B] font-bold tracking-wide uppercase">
                      NO_OUTBOUND_BROADCASTS_RECORDED_
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    let badgeStyle = 'bg-yellow-50 text-yellow-600 border border-yellow-100';
                    if (log.status === 'SENT') {
                      badgeStyle = 'bg-green-50 text-green-600 border border-green-100';
                    } else if (log.status === 'FAILED') {
                      badgeStyle = 'bg-red-50 text-red-600 border border-red-100';
                    }

                    return (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-all duration-200">
                        {/* Timestamp */}
                        <td className="py-4 px-6 font-mono text-[10px] text-gray-400">
                          {new Date(log.created_at).toLocaleString()}
                        </td>

                        {/* Title & Body */}
                        <td className="py-4 px-6">
                          <div className="font-bold text-[#1E293B]">{log.title}</div>
                          <div className="text-[10px] text-[#64748B] mt-0.5 truncate max-w-sm">{log.body}</div>
                        </td>

                        {/* Scope */}
                        <td className="py-4 px-6 font-mono text-[10px] text-[#64748B] font-bold">
                          {log.target_type} {log.target_id && `(${log.target_id})`}
                        </td>

                        {/* Scheduled time */}
                        <td className="py-4 px-6 font-mono text-[10px] text-[#64748B]">
                          {log.scheduled_at ? new Date(log.scheduled_at).toLocaleString() : 'IMMEDIATE'}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6 text-right">
                          <span className={`px-2.5 py-1 rounded-full text-[8px] font-bold tracking-wide uppercase ${badgeStyle}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4. Neumorphic Glass & Frost Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white/95 border border-white/60 shadow-[10px_10px_30px_rgba(0,0,0,0.15)] p-6 max-w-sm w-full rounded-[24px] text-center space-y-6 animate-scale-up">
            <div className="flex flex-col items-center space-y-2">
              <HelpCircle className="w-12 h-12 text-[#0EA5E9] animate-pulse" />
              <h4 className="text-sm font-black text-[#1E293B] uppercase tracking-wider pt-2">Confirm Notification Broadcast</h4>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Are you sure you want to broadcast this message to <span className="font-bold text-[#1E293B]">{getTargetTextSummary()}</span>? <span className="text-[11px] text-gray-400 block mt-1">(This will queue the message to be delivered when the device goes online).</span>
            </p>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-sm uppercase"
              >
                [ Cancel_Abort ]
              </button>
              <button
                onClick={executeBroadcast}
                className="flex-1 bg-[#0EA5E9] hover:bg-[#0ea5e9]/95 text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 shadow-md uppercase"
              >
                [ Confirm_Execute ]
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

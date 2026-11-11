import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { BellRing, FileText, MessageCircle, AlertCircle, FileEdit, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import IncomingCallModal from './IncomingCallModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface IncomingCallData {
  roomId: string;
  callerName: string;
  callerRole: string;
  callerAvatar?: string;
}

export default function NotificationListener() {
  const { userRole, userName, isAdmin } = useAuth();
  usePushNotifications(userRole);
  const location = useLocation();
  const navigate = useNavigate();

  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  
  // Edit Requests State
  const [pendingEditRequests, setPendingEditRequests] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // If no user is logged in, do not subscribe
    if (!userRole) return;

    // Define the specific channel for file tracking updates
    const fileChannel = supabase
      .channel('public:file_tracking_records_notifications')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT and UPDATE
          schema: 'public',
          table: 'file_tracking_records',
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          const eventType = payload.eventType;

          // We only care if the record is currently marked to the logged-in user
          // AND it wasn't the logged-in user themselves who just made the change
          if (newRecord && newRecord.mark_to === userRole) {
            
            // For an UPDATE, check if it was just forwarded to us
            if (eventType === 'UPDATE') {
              // If it was already marked to us, don't notify again unless something major changed.
              // We'll primarily notify if `mark_to` changed to our role, OR it's a new forward.
              if (oldRecord && oldRecord.mark_to !== userRole) {
                showNotification(newRecord, 'forwarded');
              }
            } 
            // For an INSERT, check if it's newly registered directly to us
            else if (eventType === 'INSERT') {
              showNotification(newRecord, 'registered');
            }
          } else if (newRecord && eventType === 'INSERT' && isAdmin) {
            // For admins, notify of ANY new file entered by any user
            showNotification(newRecord, 'admin_new_entry');
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to file notifications for role:', userRole);
        }
      });

    // Define the channel for chat messages and calls
    const messageChannel = supabase
      .channel('public:messages_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as any;
          // Only notify if message is for us (or if it's for admin and we are admin), and we are not the sender
          const isForUs = newMsg && (newMsg.receiver_role === userRole || (newMsg.receiver_role === 'admin' && isAdmin));
          
          if (isForUs && newMsg.sender_role !== userRole) {
            
            // Call logic
            if (newMsg.message.startsWith('[CALL_RING]::')) {
              const parts = newMsg.message.split('::');
              const roomId = parts[1];
              const callerAvatar = parts[2];
              
              setIncomingCall({
                roomId,
                callerName: newMsg.sender_name,
                callerRole: newMsg.sender_role,
                callerAvatar: callerAvatar || undefined
              });
              return;
            } else if (newMsg.message.startsWith('[CALL_CANCELED]::')) {
              const roomId = newMsg.message.split('::')[1];
              setIncomingCall(prev => prev?.roomId === roomId ? null : prev);
              return;
            } else if (newMsg.message.startsWith('[CALL_ACCEPTED]::') || newMsg.message.startsWith('[CALL_DECLINED]::')) {
              // handled in caller's side
              return;
            } else if ((newMsg.message.startsWith('[TRANSFER_ADVICE_EDIT_REQ]::') || newMsg.message.startsWith('[FILE_TRACKING_EDIT_REQ]::')) && isAdmin) {
              const isFileTracking = newMsg.message.startsWith('[FILE_TRACKING_EDIT_REQ]::');
              const parts = newMsg.message.split('::');
              const recordId = parts[1];
              const requesterName = newMsg.sender_name;
              
              try {
                // Base64 Beep sound
                const beep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'); // A placeholder base64 for real beep
                // A better approach is using the Web Audio API for a simple beep
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = 800;
                gain.gain.setValueAtTime(1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.5);
              } catch (e) {
                console.log('Audio play blocked:', e);
              }
              
              setPendingEditRequests(prev => {
                if (prev.find(r => r.recordId === recordId)) return prev;
                return [...prev, { recordId, requesterName, requesterRole: newMsg.sender_role, msgId: newMsg.id, type: isFileTracking ? 'file_tracking' : 'transfer_advice' }];
              });
              setIsEditModalOpen(true);
              
              return;
            }

            // Normal chat notification
            if (location.pathname !== '/messages') {
              showMessageNotification(newMsg);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to message notifications for role:', userRole);
        }
      });

    return () => {
      supabase.removeChannel(fileChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [userRole, isAdmin, location.pathname]);

  const handleAcceptCall = async () => {
    if (!incomingCall || !userRole || !userName) return;

    // Send accepted signal
    await supabase.from('messages').insert([{
      sender_role: userRole,
      sender_name: userName,
      receiver_role: incomingCall.callerRole,
      receiver_name: incomingCall.callerName,
      message: `[CALL_ACCEPTED]::${incomingCall.roomId}`
    }]);

    navigate(`/video-call/${incomingCall.roomId}`);
    setIncomingCall(null);
  };

  const handleDeclineCall = async () => {
    if (!incomingCall || !userRole || !userName) return;

    // Send declined signal
    await supabase.from('messages').insert([{
      sender_role: userRole,
      sender_name: userName,
      receiver_role: incomingCall.callerRole,
      receiver_name: incomingCall.callerName,
      message: `[CALL_DECLINED]::${incomingCall.roomId}`
    }]);

    setIncomingCall(null);
  };

  const showNotification = (record: any, action: 'registered' | 'forwarded' | 'admin_new_entry') => {
    toast.custom((t) => (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-lg flex items-start gap-3.5 animate-in slide-in-from-right w-[360px]">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center shrink-0">
          <BellRing className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 space-y-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            {action === 'admin_new_entry' ? 'New File Entered by User!' : `New File ${action === 'forwarded' ? 'Forwarded' : 'Received'}!`}
          </p>
          <div className="flex items-center gap-2 text-xs">
            <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{record.receiving_number || 'N/A'}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {record.subject || 'No subject provided'}
          </p>
          {record.received_from && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-0.5">
              From: {record.received_from}
            </p>
          )}
        </div>
      </div>
    ), {
      duration: 6000,
      position: 'top-right',
    });

    // Also trigger browser push notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(action === 'admin_new_entry' ? 'New File Entered!' : `New File ${action === 'forwarded' ? 'Forwarded' : 'Received'}!`, {
        body: `${record.receiving_number || 'N/A'}\n${record.subject || 'No subject'}`,
        icon: '/favicon.ico',
      });
    }
  };

  const showMessageNotification = (msg: any) => {
    toast.custom((t) => (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-lg flex items-start gap-3.5 animate-in slide-in-from-right w-[360px]">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center shrink-0">
          <MessageCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 space-y-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            New Message
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
            From: <span className="text-amber-600 dark:text-amber-400">{msg.sender_name || msg.sender_role}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed italic border-l-2 border-slate-200 dark:border-slate-600 pl-2 mt-1">
            "{msg.message}"
          </p>
        </div>
      </div>
    ), {
      duration: 6000,
      position: 'top-right',
    });

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`New Message from ${msg.sender_name || msg.sender_role}`, {
        body: msg.message,
        icon: '/favicon.ico',
      });
    }
  };

  return (
    <>
      {incomingCall && (
        <IncomingCallModal 
          callerName={incomingCall.callerName}
          callerRole={incomingCall.callerRole}
          callerAvatar={incomingCall.callerAvatar}
          roomId={incomingCall.roomId}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* Floating Notification Icon if there are pending edit requests and the modal is closed */}
      {pendingEditRequests.length > 0 && !isEditModalOpen && (
        <button 
          onClick={() => setIsEditModalOpen(true)}
          className="fixed bottom-24 right-8 z-[60] bg-amber-500 hover:bg-amber-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center animate-bounce"
          title="Pending Approvals"
        >
          <AlertCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#0f1115]">
            {pendingEditRequests.length}
          </span>
        </button>
      )}

      {/* Center Modal for Pending Edit Requests */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-[#0B101E] border-amber-500/30 text-white sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl text-amber-500 font-bold flex items-center gap-2">
              <FileEdit className="w-5 h-5" /> Pending Edit Approvals
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {pendingEditRequests.length === 0 ? (
              <p className="text-center text-white/50 py-8">No pending requests.</p>
            ) : (
              pendingEditRequests.map((req) => (
                <div key={req.recordId} className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-lg">{req.requesterName}</p>
                      <p className="text-sm text-white/50 capitalize">{req.requesterRole}</p>
                    </div>
                    <div className="bg-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded font-mono">
                      {req.type === 'file_tracking' ? 'File Tracking' : 'Transfer Advice'}
                    </div>
                  </div>
                  <p className="text-sm text-white/80">Requests permission to edit a {req.type === 'file_tracking' ? 'File Tracking' : 'Transfer Advice'} record.</p>
                  <div className="flex gap-2 pt-2 border-t border-white/10 mt-2">
                    <Button 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={async () => {
                        const approvalMsg = req.type === 'file_tracking' ? '[FILE_TRACKING_EDIT_APPROVED]' : '[TRANSFER_ADVICE_EDIT_APPROVED]';
                        await supabase.from('messages').insert([{
                          sender_role: userRole,
                          sender_name: userName || 'Admin',
                          receiver_role: req.requesterRole,
                          receiver_name: req.requesterName,
                          message: `${approvalMsg}::${req.recordId}`
                        }]);
                        toast.success("Edit request approved.");
                        setPendingEditRequests(prev => prev.filter(p => p.recordId !== req.recordId));
                        if (pendingEditRequests.length <= 1) setIsEditModalOpen(false);
                      }}
                    >
                      Approve
                    </Button>
                    <Button 
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      onClick={async () => {
                        const rejectMsg = req.type === 'file_tracking' ? '[FILE_TRACKING_EDIT_REJECTED]' : '[TRANSFER_ADVICE_EDIT_REJECTED]';
                        await supabase.from('messages').insert([{
                          sender_role: userRole,
                          sender_name: userName || 'Admin',
                          receiver_role: req.requesterRole,
                          receiver_name: req.requesterName,
                          message: `${rejectMsg}::${req.recordId}`
                        }]);
                        toast.error("Edit request rejected.");
                        setPendingEditRequests(prev => prev.filter(p => p.recordId !== req.recordId));
                        if (pendingEditRequests.length <= 1) setIsEditModalOpen(false);
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="ghost" className="text-white/50 hover:text-white" onClick={() => setIsEditModalOpen(false)}>
              Decide Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

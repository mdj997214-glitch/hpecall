import React, { useEffect, useRef, useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import { decode } from 'base64-arraybuffer';
import { Audio } from 'expo-av';
import InCallManager from 'react-native-incall-manager';
import Svg, { Path, Circle, Line, G, Rect } from 'react-native-svg';

import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';

WebBrowser.maybeCompleteAuthSession();

/* =========================================================
   HPE CALL LOGO
========================================================= */

const APP_LOGO = require('./assets/logo.png');

/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
  'https://wmljlqrawcwvbmcubfkc.supabase.co';

const SUPABASE_ANON_KEY =
  'sb_publishable_XHhjcZ6t2-P24epK3oX_Q_A1XmlaUJ';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: AsyncStorage,
      flowType: 'pkce',
    },
  }
);

const REDIRECT_URL = 'hpecall://login-callback';

/* Works with both the older ImagePicker.MediaTypeOptions enum and the
   newer string-array 'mediaTypes' API, whichever is present in your SDK. */
const IMAGE_PICKER_MEDIA_TYPES = ImagePicker.MediaTypeOptions?.Images ?? ['images'];

/* =========================================================
   WEBRTC
========================================================= */

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/* =========================================================
   SOUNDS
========================================================= */

const RINGTONE_URI =
  'https://actions.google.com/sounds/v1/ambiences/office_phone_ring.ogg';

const DIALING_TONE_URI =
  'https://actions.google.com/sounds/v1/emergency/beeps_high_pitch.ogg';

/* =========================================================
   CIRCUIT-STYLE BACKGROUND (real SVG art, no external image)
========================================================= */

function CircuitBackground({ style }) {
  const lines = [
    'M 40 0 L 40 120 L 100 180 L 100 320',
    'M 120 0 L 120 90 L 70 140 L 70 260 L 130 320 L 130 420',
    'M 220 0 L 220 60 L 180 100 L 180 240',
    'M 300 0 L 300 140 L 250 190 L 250 340 L 310 400',
    'M 0 200 L 60 200 L 100 240',
    'M 0 340 L 90 340 L 140 390',
    'M 340 40 L 280 40 L 240 80',
    'M 340 260 L 260 260 L 210 310',
  ];

  const dots = [
    [40, 120], [100, 180], [120, 90], [70, 140], [70, 260], [130, 320],
    [220, 60], [180, 100], [300, 140], [250, 190], [250, 340],
    [60, 200], [100, 240], [90, 340], [140, 390], [280, 40], [240, 80],
    [260, 260], [210, 310],
  ];

  return (
    <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 340 420" preserveAspectRatio="xMidYMid slice">
        <Rect x="0" y="0" width="340" height="420" fill="#0B141A" />
        <G stroke="#1B2A32" strokeWidth="2" fill="none">
          {lines.map((d, index) => (
            <Path key={`line-${index}`} d={d} />
          ))}
        </G>
        <G fill="#1B2A32">
          {dots.map(([cx, cy], index) => (
            <Circle key={`dot-${index}`} cx={cx} cy={cy} r={3.5} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

/* =========================================================
   DEFAULT ILLUSTRATED AVATAR (real SVG art, no external image)
========================================================= */

function DefaultAvatarIllustration({ size = 120 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="60" fill="#BEE3F8" />
      <Circle cx="60" cy="48" r="22" fill="#F4C7A0" />
      <Path d="M60 24 C46 24 38 34 38 46 C38 50 46 40 60 40 C74 40 82 50 82 46 C82 34 74 24 60 24 Z" fill="#2B2B2B" />
      <Path d="M18 118 C18 92 36 78 60 78 C84 78 102 92 102 118 Z" fill="#F26D3D" />
    </Svg>
  );
}

/* =========================================================
   APP
========================================================= */

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  const [profileName, setProfileName] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [avatarBase64, setAvatarBase64] = useState(null);
  const [isProfileCompleted, setIsProfileCompleted] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [activeTab, setActiveTab] = useState('calls');

  const [calls, setCalls] = useState([]);
  const [contacts, setContacts] = useState([]);

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');

  /* ===== BLOCK / REPORT ===== */
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedIds, setBlockedIds] = useState([]);
  const [blockedByIds, setBlockedByIds] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [contactMenuTarget, setContactMenuTarget] = useState(null);

  /* ===== PRIVACY / NOTIFICATIONS / SECURITY ===== */
  const [callPrivacy, setCallPrivacy] = useState('everyone');
  const [messagePrivacy, setMessagePrivacy] = useState('everyone');
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState('everyone');
  const [readReceipts, setReadReceipts] = useState(true);
  const [ringtoneEnabled, setRingtoneEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  /* ===== STORIES / STATUS ===== */
  const [stories, setStories] = useState([]);
  const [myStories, setMyStories] = useState([]);
  const [viewingStory, setViewingStory] = useState(null);
  const [storyViewers, setStoryViewers] = useState([]);
  const [showStoryViewers, setShowStoryViewers] = useState(false);
  const [uploadingStory, setUploadingStory] = useState(false);

  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);

  const [callVisible, setCallVisible] = useState(false);
  const [callType, setCallType] = useState('voice');
  const [callStatus, setCallStatus] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);
  const [activeCallId, setActiveCallId] = useState(null);
  const [activeCallPeerId, setActiveCallPeerId] = useState(null);
  const [activeCallPeerName, setActiveCallPeerName] = useState('');
  const [activeCallPeerAvatar, setActiveCallPeerAvatar] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const messageChannelRef = useRef(null);
  const callChannelRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimerRef = useRef(null);
  const pendingIceRef = useRef([]);
  const pendingOfferRef = useRef(null);
  const mountedRef = useRef(true);
  const activeCallIdRef = useRef(null);
  const activeCallPeerIdRef = useRef(null);
  const incomingCallRef = useRef(null);
  const soundObjectRef = useRef(null);
  const selectedContactRef = useRef(null);

  useEffect(() => { activeCallIdRef.current = activeCallId; }, [activeCallId]);
  useEffect(() => { activeCallPeerIdRef.current = activeCallPeerId; }, [activeCallPeerId]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);

  const stopSound = async () => {
    try {
      if (soundObjectRef.current) {
        await soundObjectRef.current.stopAsync();
        await soundObjectRef.current.unloadAsync();
        soundObjectRef.current = null;
      }
    } catch (error) {
      soundObjectRef.current = null;
    }
  };

  const playSound = async (uri, isLooping = true) => {
    try {
      await stopSound();
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, isLooping, volume: 1.0 }
      );
      soundObjectRef.current = sound;
    } catch (error) {
      console.log('Sound playback error:', error);
    }
  };

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1000);
    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  const checkUserProfile = async (currentSession) => {
    if (!currentSession?.user) {
      setSession(null);
      setIsProfileCompleted(false);
      return;
    }
    setSession(currentSession);
    const user = currentSession.user;
    const metadata = user.user_metadata || {};
    const googleName = metadata.full_name || metadata.name || '';
    const googleAvatar = metadata.avatar_url || metadata.picture || null;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone')
        .eq('id', user.id)
        .maybeSingle();

      if (error) console.log('Profile read error:', error.message);

      if (profile?.full_name?.trim()) {
        setProfileName(profile.full_name);
        setAvatarUri(profile.avatar_url || googleAvatar || null);
        setAvatarBase64(null);
        setIsProfileCompleted(true);
      } else {
        setProfileName(googleName);
        setAvatarUri(profile?.avatar_url || googleAvatar || null);
        setAvatarBase64(null);
        setIsProfileCompleted(false);
      }
    } catch (error) {
      setProfileName(googleName);
      setAvatarUri(googleAvatar);
      setAvatarBase64(null);
      setIsProfileCompleted(false);
    }
  };

  const handleAuthCallback = async (url) => {
    if (!url) return;
    try {
      setLoading(true);
      const parsed = Linking.parse(url);
      const code = parsed?.queryParams?.code;

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(String(code));
        if (error) throw error;
        if (data?.session) await checkUserProfile(data.session);
        return;
      }

      if (url.includes('#')) {
        const hash = url.split('#')[1];
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (data?.session) await checkUserProfile(data.session);
        }
      }
    } catch (error) {
      Alert.alert('Login Error', error?.message || 'Google Login failed.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const initialize = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        if (data?.session?.user) {
          await checkUserProfile(data.session);
        } else {
          setSession(null);
          setIsProfileCompleted(false);
        }

        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.startsWith('hpecall://')) {
          await handleAuthCallback(initialUrl);
        }
      } catch (error) {
        console.log('Initialization error:', error);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mountedRef.current) return;
      if (currentSession?.user) {
        await checkUserProfile(currentSession);
      } else {
        setSession(null);
        setIsProfileCompleted(false);
      }
    });

    const linkingSubscription = Linking.addEventListener('url', async ({ url }) => {
      if (url && url.startsWith('hpecall://')) await handleAuthCallback(url);
    });

    return () => {
      mountedRef.current = false;
      authListener?.subscription?.unsubscribe();
      linkingSubscription?.remove();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!isOnline) {
      Alert.alert('অফলাইন', 'Google Login করতে ইন্টারনেট প্রয়োজন।');
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URL,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Google Login URL পাওয়া যায়নি।');

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
      if (result?.type === 'success' && result?.url) {
        await handleAuthCallback(result.url);
      }
    } catch (error) {
      Alert.alert('Google Login Error', error?.message || 'Google login failed.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const sendPhoneOtp = async () => {
    if (!isOnline) {
      Alert.alert('অফলাইন', 'ইন্টারনেট সংযোগ প্রয়োজন।');
      return;
    }
    const phone = phoneNumber.trim();
    if (!phone) {
      Alert.alert('Error', 'মোবাইল নম্বর লিখুন।');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setOtpSent(true);
      Alert.alert('OTP পাঠানো হয়েছে', 'আপনার ফোনে OTP পাঠানো হয়েছে।');
    } catch (error) {
      Alert.alert('OTP Error', error?.message || 'OTP পাঠানো যায়নি।');
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOtp = async () => {
    if (!otpCode.trim()) {
      Alert.alert('Error', 'OTP লিখুন।');
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneNumber.trim(),
        token: otpCode.trim(),
        type: 'sms',
      });
      if (error) throw error;
      if (data?.session) await checkUserProfile(data.session);
    } catch (error) {
      Alert.alert('OTP Error', error?.message || 'OTP সঠিক নয়।');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('অনুমতি প্রয়োজন', 'প্রোফাইল ছবি নির্বাচন করতে গ্যালারির অনুমতি দিন।');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: IMAGE_PICKER_MEDIA_TYPES,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const image = result.assets[0];
      setAvatarUri(image.uri);
      setAvatarBase64(image.base64 || null);
    }
  };

  const saveProfile = async () => {
    if (!profileName.trim()) {
      Alert.alert('Error', 'আপনার নাম লিখুন।');
      return;
    }
    if (!session?.user) return;
    if (!isOnline) {
      Alert.alert('Offline', 'ইন্টারনেট কানেকশন চেক করুন।');
      return;
    }
    try {
      setLoading(true);
      let publicAvatarUrl = avatarUri;

      if (avatarBase64) {
        const filePath = `${session.user.id}/${Date.now()}.jpg`;
        const arrayBuffer = decode(avatarBase64);
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw new Error(`Avatar upload failed: ${uploadError.message}`);

        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        if (!publicData?.publicUrl) throw new Error('Avatar public URL তৈরি করা যায়নি।');
        publicAvatarUrl = publicData.publicUrl;
      }

      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        full_name: profileName.trim(),
        avatar_url: publicAvatarUrl,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      setAvatarUri(publicAvatarUrl);
      setAvatarBase64(null);
      setIsProfileCompleted(true);
    } catch (error) {
      Alert.alert('Save Error', error?.message || 'প্রোফাইল সেভ করা যায়নি।');
    } finally {
      setLoading(false);
    }
  };

  const loadCalls = async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .or(`caller_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
        .order('started_at', { ascending: false });
      if (error) { console.log('Calls error:', error.message); return; }
      setCalls(data || []);
    } catch (error) {
      console.log('Load calls error:', error);
    }
  };

  const loadContacts = async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', session.user.id);
      if (error) { console.log('Contacts error:', error.message); return; }

      const contactRows = data || [];
      const otherIds = contactRows.map((row) => row.contact_user_id).filter(Boolean);

      if (otherIds.length === 0) { setContacts([]); return; }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', otherIds);

      if (profileError) { console.log('Contacts profile error:', profileError.message); return; }

      const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

      const list = contactRows
        .map((contact) => {
          const profile = profileById.get(contact.contact_user_id);
          if (!profile) return null;
          if (blockedIds.includes(profile.id) || blockedByIds.includes(profile.id)) return null;
          return { ...contact, profile };
        })
        .filter(Boolean);

      setContacts(list);
    } catch (error) {
      console.log('Load contacts error:', error);
    }
  };

  const loadAllData = async () => {
    if (!session?.user?.id) return;
    setLoadingData(true);
    try {
      await Promise.all([loadCalls(), loadContacts()]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (session && isProfileCompleted && isOnline) loadAllData();
  }, [session, isProfileCompleted, isOnline]);

  /* =====================================================
     BLOCK / UNBLOCK / REPORT
  ===================================================== */

  const loadBlockedUsers = async () => {
    if (!session?.user?.id) return;
    const myId = session.user.id;

    const { data: iBlocked, error: err1 } = await supabase
      .from('blocks')
      .select('id, blocked_id')
      .eq('blocker_id', myId);

    if (err1) { console.log('Load blocked error:', err1.message); return; }

    const { data: blockedMe, error: err2 } = await supabase
      .from('blocks')
      .select('blocker_id')
      .eq('blocked_id', myId);

    if (err2) console.log('Load blocked-me error:', err2.message);

    const ids = (iBlocked || []).map((row) => row.blocked_id);
    setBlockedIds(ids);
    setBlockedByIds((blockedMe || []).map((row) => row.blocker_id));

    if (ids.length === 0) { setBlockedUsers([]); return; }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', ids);

    if (profileError) { console.log('Blocked profiles error:', profileError.message); return; }
    setBlockedUsers(profiles || []);
  };

  const isBlockedByEitherSide = async (otherUserId) => {
    if (!session?.user?.id || !otherUserId) return false;
    const myId = session.user.id;
    const { data, error } = await supabase
      .from('blocks')
      .select('id')
      .or(`and(blocker_id.eq.${myId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${myId})`)
      .limit(1);
    if (error) { console.log('Block check error:', error.message); return false; }
    return (data || []).length > 0;
  };

  const blockUser = async (targetUser) => {
    if (!session?.user?.id || !targetUser?.id) return;
    try {
      const { error } = await supabase.from('blocks').insert({
        blocker_id: session.user.id,
        blocked_id: targetUser.id,
      });
      if (error && error.code !== '23505') throw error;

      setShowContactMenu(false);
      setContactMenuTarget(null);

      if (selectedContact && (selectedContact.profile?.id === targetUser.id || selectedContact.id === targetUser.id)) {
        await closeChat();
      }

      await loadBlockedUsers();
      await loadContacts();
      Alert.alert('Blocked', `${targetUser.full_name || 'ব্যবহারকারী'} কে Block করা হয়েছে।`);
    } catch (error) {
      Alert.alert('Error', error?.message || 'Block করা যায়নি।');
    }
  };

  const unblockUser = async (targetUserId) => {
    if (!session?.user?.id || !targetUserId) return;
    try {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', session.user.id)
        .eq('blocked_id', targetUserId);
      if (error) throw error;
      await loadBlockedUsers();
    } catch (error) {
      Alert.alert('Error', error?.message || 'Unblock করা যায়নি।');
    }
  };

  const openReportModal = (targetUser) => {
    setReportTarget(targetUser);
    setReportReason('');
    setShowContactMenu(false);
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!session?.user?.id || !reportTarget?.id) return;
    if (!reportReason.trim()) {
      Alert.alert('Error', 'Report করার কারণ লিখুন।');
      return;
    }
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: session.user.id,
        reported_id: reportTarget.id,
        reason: reportReason.trim(),
      });
      if (error) throw error;

      setShowReportModal(false);
      setReportTarget(null);
      setReportReason('');
      Alert.alert('Report জমা হয়েছে', 'আপনার Report আমরা পর্যালোচনা করব। ধন্যবাদ।');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Report জমা করা যায়নি।');
    }
  };

  /* =====================================================
     PRIVACY / NOTIFICATION / SECURITY SETTINGS
  ===================================================== */

  const getUserSettings = async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) { console.log('Get settings error:', error.message); return null; }
    return data;
  };

  const loadMySettings = async () => {
    if (!session?.user?.id) return;
    const data = await getUserSettings(session.user.id);
    if (data) {
      setCallPrivacy(data.call_privacy || 'everyone');
      setMessagePrivacy(data.message_privacy || 'everyone');
      setLastSeenPrivacy(data.last_seen_privacy || 'everyone');
      setReadReceipts(data.read_receipts !== false);
      setRingtoneEnabled(data.ringtone_enabled !== false);
      setVibrationEnabled(data.vibration_enabled !== false);
      setNotificationsEnabled(data.notifications_enabled !== false);
    }
  };

  const saveMySettings = async (overrides = {}) => {
    if (!session?.user?.id) return;
    setSavingSettings(true);
    try {
      const payload = {
        user_id: session.user.id,
        call_privacy: callPrivacy,
        message_privacy: messagePrivacy,
        last_seen_privacy: lastSeenPrivacy,
        read_receipts: readReceipts,
        ringtone_enabled: ringtoneEnabled,
        vibration_enabled: vibrationEnabled,
        notifications_enabled: notificationsEnabled,
        updated_at: new Date().toISOString(),
        ...overrides,
      };
      const { error } = await supabase.from('user_settings').upsert(payload);
      if (error) throw error;
    } catch (error) {
      Alert.alert('Error', error?.message || 'Settings সেভ করা যায়নি।');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleSetting = async (key, currentValue, setter) => {
    const nextValue = !currentValue;
    setter(nextValue);
    await saveMySettings({ [key]: nextValue });
  };

  const updateCallPrivacy = async (value) => {
    setCallPrivacy(value);
    await saveMySettings({ call_privacy: value });
  };

  const updateMessagePrivacy = async (value) => {
    setMessagePrivacy(value);
    await saveMySettings({ message_privacy: value });
  };

  const updateLastSeenPrivacy = async (value) => {
    setLastSeenPrivacy(value);
    await saveMySettings({ last_seen_privacy: value });
  };

  const signOutOtherDevices = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      Alert.alert('Security', 'অন্য সব ডিভাইস থেকে Log out করা হয়েছে।');
    } catch (error) {
      Alert.alert('Error', error?.message || 'অন্য ডিভাইস থেকে Log out করা যায়নি।');
    }
  };

  /* =====================================================
     STORIES / STATUS
  ===================================================== */

  const loadStories = async () => {
    if (!session?.user?.id) return;
    const nowIso = new Date().toISOString();
    const contactIds = contacts.map((c) => c.profile?.id || c.id).filter(Boolean);
    const visibleIds = [session.user.id, ...contactIds].filter((id) => !blockedIds.includes(id) && !blockedByIds.includes(id));

    if (visibleIds.length === 0) { setStories([]); setMyStories([]); return; }

    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .in('user_id', visibleIds)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false });

    if (error) { console.log('Load stories error:', error.message); return; }

    const storyRows = data || [];
    const authorIds = [...new Set(storyRows.map((story) => story.user_id))];

    let profileById = new Map();
    if (authorIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', authorIds);
      if (profileError) console.log('Story profiles error:', profileError.message);
      profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    }

    const list = storyRows.map((story) => ({ ...story, profile: profileById.get(story.user_id) || null }));

    setMyStories(list.filter((item) => item.user_id === session.user.id));
    setStories(list.filter((item) => item.user_id !== session.user.id));
  };

  const uploadStory = async () => {
    if (!session?.user?.id) return;
    if (!isOnline) {
      Alert.alert('Offline', 'Status আপলোড করতে ইন্টারনেট প্রয়োজন।');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('অনুমতি প্রয়োজন', 'Status আপলোড করতে গ্যালারির অনুমতি দিন।');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: IMAGE_PICKER_MEDIA_TYPES,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    try {
      setUploadingStory(true);
      const image = result.assets[0];
      const filePath = `${session.user.id}/${Date.now()}.jpg`;
      const arrayBuffer = decode(image.base64);

      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw new Error(`Story upload failed: ${uploadError.message}`);

      const { data: publicData } = supabase.storage.from('stories').getPublicUrl(filePath);
      if (!publicData?.publicUrl) throw new Error('Story public URL তৈরি করা যায়নি।');

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase.from('stories').insert({
        user_id: session.user.id,
        media_url: publicData.publicUrl,
        media_type: 'image',
        expires_at: expiresAt,
      });
      if (error) throw error;

      await loadStories();
      Alert.alert('Success', 'Status আপলোড হয়েছে।');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Status আপলোড করা যায়নি।');
    } finally {
      setUploadingStory(false);
    }
  };

  const openStory = async (story) => {
    setViewingStory(story);
    if (!session?.user?.id || story.user_id === session.user.id) return;
    try {
      const { error } = await supabase.from('story_views').insert({
        story_id: story.id,
        viewer_id: session.user.id,
      });
      if (error && error.code !== '23505') console.log('Story view error:', error.message);
    } catch (error) {
      console.log('Story view error:', error);
    }
  };

  const closeStory = () => setViewingStory(null);

  const loadStoryViewers = async (storyId) => {
    const { data, error } = await supabase
      .from('story_views')
      .select('viewer_id, viewed_at')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false });

    if (error) { console.log('Load viewers error:', error.message); return; }

    const rows = data || [];
    const viewerIds = [...new Set(rows.map((row) => row.viewer_id))];

    if (viewerIds.length === 0) { setStoryViewers([]); return; }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', viewerIds);

    if (profileError) { console.log('Viewer profiles error:', profileError.message); return; }

    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

    const list = rows
      .map((row) => {
        const profile = profileById.get(row.viewer_id);
        if (!profile) return null;
        return { ...profile, viewed_at: row.viewed_at };
      })
      .filter(Boolean);

    setStoryViewers(list);
  };

  const openMyStoryViewers = async (story) => {
    setViewingStory(story);
    await loadStoryViewers(story.id);
    setShowStoryViewers(true);
  };

  useEffect(() => {
    if (session && isProfileCompleted && isOnline) {
      loadBlockedUsers();
      loadMySettings();
    }
  }, [session, isProfileCompleted, isOnline]);

  useEffect(() => {
    if (session && isProfileCompleted && isOnline) loadContacts();
  }, [blockedIds, blockedByIds]);

  useEffect(() => {
    if (session && isProfileCompleted && isOnline) loadStories();
  }, [session, isProfileCompleted, isOnline, contacts, blockedIds, blockedByIds]);

  const searchUsers = async (text) => {
    setSearchText(text);
    if (!text.trim()) { setSearchResults([]); return; }
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .ilike('full_name', `%${text.trim()}%`)
      .neq('id', session.user.id)
      .limit(20);

    if (error) { console.log('Search error:', error.message); return; }
    const filtered = (data || []).filter((user) => !blockedIds.includes(user.id) && !blockedByIds.includes(user.id));
    setSearchResults(filtered);
  };

  const addContact = async (user) => {
    if (!session?.user?.id) return;
    try {
      const { error } = await supabase.from('contacts').insert({
        user_id: session.user.id,
        contact_user_id: user.id,
      });
      if (error) {
        if (error.code === '23505') {
          Alert.alert('Contact', 'এই ব্যক্তি ইতিমধ্যে Contacts-এ আছে।');
        } else {
          throw error;
        }
        return;
      }
      Alert.alert('Success', 'Contact যোগ হয়েছে।');
      setSearchText('');
      setSearchResults([]);
      setShowSearch(false);
      await loadContacts();
    } catch (error) {
      Alert.alert('Error', error?.message || 'Contact যোগ করা যায়নি।');
    }
  };

  const cleanupMessageSubscription = async () => {
    try {
      if (messageChannelRef.current) {
        await supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
    } catch (error) {
      messageChannelRef.current = null;
    }
  };

  const loadMessages = async (otherUserId) => {
    if (!session?.user?.id) return;
    const myId = session.user.id;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });

    if (error) { console.log('Messages error:', error.message); return; }

    const ids = (data || []).map((item) => item.id);
    let deletedForMe = new Set();

    if (ids.length > 0) {
      const { data: deletions, error: deletionError } = await supabase
        .from('message_deletions')
        .select('message_id')
        .eq('user_id', myId)
        .in('message_id', ids);

      if (deletionError) {
        console.log('Message deletion read error:', deletionError.message);
      } else {
        deletedForMe = new Set((deletions || []).map((item) => String(item.message_id)));
      }
    }

    const visibleMessages = (data || []).filter((message) => !deletedForMe.has(String(message.id)));
    setMessages(visibleMessages);
  };

  const subscribeToMessages = async (otherUserId) => {
    if (!session?.user?.id || !otherUserId) return;
    await cleanupMessageSubscription();
    const myId = session.user.id;

    const channel = supabase
      .channel(`messages:${myId}:${otherUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${myId}` }, async (payload) => {
        const newMessage = payload.new;
        if (newMessage.sender_id !== otherUserId || newMessage.receiver_id !== myId) return;
        setMessages((previous) => {
          if (previous.some((item) => String(item.id) === String(newMessage.id))) return previous;
          return [...previous, newMessage];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, async (payload) => {
        const updated = payload.new;
        const currentContact = selectedContactRef.current;
        const otherId = currentContact?.profile?.id || currentContact?.id;
        if (!otherId) return;
        if (!((updated.sender_id === myId && updated.receiver_id === otherId) || (updated.sender_id === otherId && updated.receiver_id === myId))) return;
        setMessages((previous) => previous.map((item) => (String(item.id) === String(updated.id) ? { ...item, ...updated } : item)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        const deletedId = payload.old?.id;
        if (!deletedId) return;
        setMessages((previous) => previous.filter((item) => String(item.id) !== String(deletedId)));
      })
      .subscribe();

    messageChannelRef.current = channel;
  };

  const openChat = async (contact) => {
    const otherUserId = contact?.profile?.id || contact?.id;
    if (!otherUserId) return;
    setSelectedContact(contact);
    selectedContactRef.current = contact;
    await loadMessages(otherUserId);
    await subscribeToMessages(otherUserId);
  };

  const closeChat = async () => {
    await cleanupMessageSubscription();
    setSelectedContact(null);
    selectedContactRef.current = null;
    setMessages([]);
    setMessageText('');
    setSelectedMessage(null);
    setShowMessageMenu(false);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !session?.user?.id) return;
    if (!isOnline) {
      Alert.alert('Offline', 'Message পাঠাতে ইন্টারনেট প্রয়োজন।');
      return;
    }
    const receiverId = selectedContact?.profile?.id || selectedContact?.id;
    if (!receiverId) return;

    if (blockedIds.includes(receiverId) || blockedByIds.includes(receiverId)) {
      Alert.alert('Message', 'এই ব্যবহারকারীকে Message পাঠানো যাবে না।');
      return;
    }

    const receiverSettings = await getUserSettings(receiverId);
    if (receiverSettings?.message_privacy === 'nobody') {
      Alert.alert('Message', 'এই ব্যবহারকারী কারো কাছ থেকে Message গ্রহণ করছেন না।');
      return;
    }
    if (receiverSettings?.message_privacy === 'contacts') {
      const isContact = contacts.some((c) => (c.profile?.id || c.id) === receiverId);
      if (!isContact) {
        Alert.alert('Message', 'শুধু Contact-রা এই ব্যবহারকারীকে Message পাঠাতে পারবে।');
        return;
      }
    }

    const text = messageText.trim();
    setMessageText('');

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: session.user.id, receiver_id: receiverId, message: text })
      .select()
      .single();

    if (error) {
      setMessageText(text);
      Alert.alert('Message Error', error.message);
      return;
    }

    setMessages((previous) => {
      if (previous.some((item) => String(item.id) === String(data?.id))) return previous;
      return [...previous, data];
    });
  };

  const openMessageMenu = (message) => {
    setSelectedMessage(message);
    setShowMessageMenu(true);
  };

  const deleteMessageForMe = async () => {
    const message = selectedMessage;
    if (!message || !session?.user?.id) return;
    try {
      const { error } = await supabase.from('message_deletions').insert({ message_id: message.id, user_id: session.user.id });
      if (error) {
        if (error.code === '23505') {
          setMessages((previous) => previous.filter((item) => String(item.id) !== String(message.id)));
        } else {
          throw error;
        }
      } else {
        setMessages((previous) => previous.filter((item) => String(item.id) !== String(message.id)));
      }
    } catch (error) {
      Alert.alert('Delete Error', error?.message || 'Message delete করা যায়নি।');
    } finally {
      setSelectedMessage(null);
      setShowMessageMenu(false);
    }
  };

  const deleteMessageForEveryone = async () => {
    const message = selectedMessage;
    if (!message || !session?.user?.id) return;
    if (message.sender_id !== session.user.id) {
      Alert.alert('Not allowed', 'শুধু নিজের পাঠানো message সবার জন্য delete করা যাবে।');
      return;
    }
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_deleted_for_everyone: true })
        .eq('id', message.id)
        .eq('sender_id', session.user.id);
      if (error) throw error;
      setMessages((previous) => previous.map((item) => (String(item.id) === String(message.id) ? { ...item, is_deleted_for_everyone: true } : item)));
    } catch (error) {
      Alert.alert('Delete Error', error?.message || 'Message সবার জন্য delete করা যায়নি।');
    } finally {
      setSelectedMessage(null);
      setShowMessageMenu(false);
    }
  };

  const flushPendingIceCandidates = async (callId, pc) => {
    if (!pc) return;
    const pending = pendingIceRef.current.filter((item) => item.callId === callId);
    pendingIceRef.current = pendingIceRef.current.filter((item) => item.callId !== callId);
    for (const item of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(item.candidate));
      } catch (error) {
        console.log('Pending ICE error:', error);
      }
    }
  };

  const startCallTimer = () => {
    stopCallTimer();
    setCallSeconds(0);
    callTimerRef.current = setInterval(() => {
      setCallSeconds((previous) => previous + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallSeconds(0);
  };

  const formatCallDuration = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    const nextEnabled = !audioTracks[0].enabled;
    audioTracks.forEach((track) => { track.enabled = nextEnabled; });
    setIsMuted(!nextEnabled);
  };

  const toggleCameraOff = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;
    const nextEnabled = !videoTracks[0].enabled;
    videoTracks.forEach((track) => { track.enabled = nextEnabled; });
    setIsCameraOff(!nextEnabled);
  };

  const switchCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;
    try {
      videoTracks[0]._switchCamera();
      setIsFrontCamera((previous) => !previous);
    } catch (error) {
      console.log('Switch camera error:', error);
    }
  };

  const closePeerConnection = async () => {
    try { await stopSound(); } catch {}
    stopCallTimer();
    setIsMuted(false);
    setIsCameraOff(false);
    setIsFrontCamera(true);
    try { InCallManager.stop(); } catch (error) {}
    try {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.oniceconnectionstatechange = null;
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    } catch (error) {}
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => { try { track.stop(); } catch {} });
      }
    } catch (error) {}
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    pendingIceRef.current = [];
    pendingOfferRef.current = null;
  };

  const sendCallSignal = async (callId, receiverId, signalType, payload = null) => {
    if (!session?.user?.id || !callId || !receiverId) return;
    const { error } = await supabase.from('call_signals').insert({
      call_id: callId,
      sender_id: session.user.id,
      receiver_id: receiverId,
      signal_type: signalType,
      payload: payload,
    });
    if (error) throw error;
  };

  const getMediaStream = async (type) => {
    let stream;
    try {
      stream = await mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
    } catch (error) {
      const message = String(error?.message || error || '');
      if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('denied')) {
        throw new Error('Call করতে Microphone/Camera অনুমতি প্রয়োজন। ফোনের Settings থেকে HPE Call অ্যাপকে Microphone ও Camera অনুমতি দিন।');
      }
      throw error;
    }
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  const createPeerConnection = async ({ callId, receiverId, type }) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    try {
      InCallManager.start({ media: type === 'video' ? 'video' : 'audio', auto: true });
      InCallManager.setForceSpeakerphoneOn(type === 'video');
    } catch (error) {}

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          const candidate = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
          await sendCallSignal(callId, receiverId, 'ice', candidate);
        } catch (error) {}
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = async () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        await stopSound();
        setCallStatus('Connected');
        startCallTimer();
      }
      if (state === 'disconnected' || state === 'failed') {
        setCallStatus('Call ended');
        stopCallTimer();
      }
    };

    const stream = await getMediaStream(type);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    return pc;
  };

  const startCall = async (contact, type) => {
    if (!session?.user?.id) return;
    if (!isOnline) {
      Alert.alert('Offline', 'Call করতে ইন্টারনেট প্রয়োজন।');
      return;
    }
    if (peerConnectionRef.current || activeCallIdRef.current) {
      Alert.alert('Call', 'আপনার একটি call ইতিমধ্যে চলছে।');
      return;
    }
    const receiverId = contact?.profile?.id || contact?.id;
    if (!receiverId) {
      Alert.alert('Call Error', 'Receiver পাওয়া যায়নি।');
      return;
    }

    if (blockedIds.includes(receiverId) || blockedByIds.includes(receiverId)) {
      Alert.alert('Call', 'এই ব্যবহারকারীকে Call করা যাবে না।');
      return;
    }

    const receiverSettings = await getUserSettings(receiverId);
    if (receiverSettings?.call_privacy === 'nobody') {
      Alert.alert('Call', 'এই ব্যবহারকারী কারো কাছ থেকে Call গ্রহণ করছেন না।');
      return;
    }
    if (receiverSettings?.call_privacy === 'contacts') {
      const isContact = contacts.some((c) => (c.profile?.id || c.id) === receiverId);
      if (!isContact) {
        Alert.alert('Call', 'শুধু Contact-রা এই ব্যবহারকারীকে Call করতে পারবে।');
        return;
      }
    }

    let createdCallId = null;
    try {
      setCallType(type);
      setCallStatus('Calling...');
      setActiveCallPeerId(receiverId);
      activeCallPeerIdRef.current = receiverId;
      setActiveCallPeerName(contact?.profile?.full_name || 'HPE Call User');
      setActiveCallPeerAvatar(contact?.profile?.avatar_url || null);
      if (notificationsEnabled && ringtoneEnabled) {
        await playSound(DIALING_TONE_URI, true);
      }

      const { data: call, error } = await supabase
        .from('calls')
        .insert({ caller_id: session.user.id, receiver_id: receiverId, call_type: type, status: 'ringing', started_at: new Date().toISOString() })
        .select()
        .single();
      if (error) throw error;

      createdCallId = call.id;
      setActiveCallId(call.id);
      activeCallIdRef.current = call.id;
      setCallVisible(true);

      const pc = await createPeerConnection({ callId: call.id, receiverId, type });
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: type === 'video' });
      await pc.setLocalDescription(offer);
      await sendCallSignal(call.id, receiverId, 'offer', { type: offer.type, sdp: offer.sdp });
    } catch (error) {
      await closePeerConnection();
      setCallVisible(false);
      setActiveCallId(null);
      activeCallIdRef.current = null;
      setActiveCallPeerId(null);
      activeCallPeerIdRef.current = null;
      setActiveCallPeerName('');
      setActiveCallPeerAvatar(null);
      setCallStatus('');

      if (createdCallId) {
        await supabase.from('calls').update({ status: 'failed', ended_at: new Date().toISOString() }).eq('id', createdCallId);
      }
      Alert.alert('Call Error', error?.message || 'Call শুরু করা যায়নি।');
    }
  };

  const acceptIncomingCall = async () => {
    const incoming = incomingCallRef.current;
    if (!incoming) return;

    try {
      await stopSound();
      setIncomingCall(null);
      incomingCallRef.current = null;
      setCallType(incoming.callType);
      setActiveCallId(incoming.callId);
      activeCallIdRef.current = incoming.callId;
      setActiveCallPeerId(incoming.senderId);
      activeCallPeerIdRef.current = incoming.senderId;
      setActiveCallPeerName(incoming.callerName);
      setActiveCallPeerAvatar(incoming.callerAvatar || null);
      setCallVisible(true);
      setCallStatus('Connecting...');

      const pc = await createPeerConnection({ callId: incoming.callId, receiverId: incoming.senderId, type: incoming.callType });
      const offer = pendingOfferRef.current;
      if (!offer) throw new Error('Call offer পাওয়া যায়নি।');

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingIceCandidates(incoming.callId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendCallSignal(incoming.callId, incoming.senderId, 'answer', { type: answer.type, sdp: answer.sdp });

      const { error } = await supabase.from('calls').update({ status: 'accepted' }).eq('id', incoming.callId);
      if (error) console.log('Call accepted DB error:', error.message);

      pendingOfferRef.current = null;
    } catch (error) {
      Alert.alert('Call Error', error?.message || 'Call accept করা যায়নি।');
      try { await sendCallSignal(incoming.callId, incoming.senderId, 'reject', null); } catch {}
      await supabase.from('calls').update({ status: 'failed', ended_at: new Date().toISOString() }).eq('id', incoming.callId);
      await closePeerConnection();
      setCallVisible(false);
      setActiveCallId(null);
      activeCallIdRef.current = null;
      setActiveCallPeerId(null);
      activeCallPeerIdRef.current = null;
      setActiveCallPeerName('');
      setActiveCallPeerAvatar(null);
      setCallStatus('');
      pendingOfferRef.current = null;
    }
  };

  const rejectIncomingCall = async (callData = incomingCallRef.current) => {
    if (!callData) return;
    try {
      await stopSound();
      await sendCallSignal(callData.callId, callData.senderId, 'reject', null);
      await supabase.from('calls').update({ status: 'rejected', ended_at: new Date().toISOString() }).eq('id', callData.callId);
    } catch (error) {
      console.log('Reject call signal error:', error);
    }

    pendingOfferRef.current = null;
    pendingIceRef.current = pendingIceRef.current.filter((item) => item.callId !== callData.callId);
    setIncomingCall(null);
    incomingCallRef.current = null;
  };

  const endCall = async () => {
    const callId = activeCallIdRef.current;
    const peerId = activeCallPeerIdRef.current;

    try {
      if (callId && peerId) {
        try { await sendCallSignal(callId, peerId, 'end', null); } catch (signalError) {}
      }
      if (callId) {
        await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId);
      }
    } catch (error) {}

    await closePeerConnection();
    setCallVisible(false);
    setActiveCallId(null);
    activeCallIdRef.current = null;
    setActiveCallPeerId(null);
    activeCallPeerIdRef.current = null;
    setActiveCallPeerName('');
    setActiveCallPeerAvatar(null);
    setCallStatus('');
    await loadCalls();
  };

  useEffect(() => {
    if (!session?.user?.id || !isProfileCompleted) return;
    const userId = session.user.id;
    let disposed = false;

    const channel = supabase
      .channel(`call-signals:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `receiver_id=eq.${userId}` }, async (payload) => {
        if (disposed) return;
        const signal = payload.new;
        if (!signal || signal.receiver_id !== userId) return;

        try {
          if (signal.signal_type === 'offer') {
            if (activeCallIdRef.current || peerConnectionRef.current) {
              try { await sendCallSignal(signal.call_id, signal.sender_id, 'reject', null); } catch {}
              return;
            }

            if (await isBlockedByEitherSide(signal.sender_id)) {
              try { await sendCallSignal(signal.call_id, signal.sender_id, 'reject', null); } catch {}
              return;
            }

            const receiverPrivacy = await getUserSettings(userId);
            if (receiverPrivacy?.call_privacy === 'nobody') {
              try { await sendCallSignal(signal.call_id, signal.sender_id, 'reject', null); } catch {}
              return;
            }
            if (receiverPrivacy?.call_privacy === 'contacts') {
              const isContact = contacts.some((c) => (c.profile?.id || c.id) === signal.sender_id);
              if (!isContact) {
                try { await sendCallSignal(signal.call_id, signal.sender_id, 'reject', null); } catch {}
                return;
              }
            }

            const { data: callerProfile } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', signal.sender_id).maybeSingle();
            const { data: callRow } = await supabase.from('calls').select('id, caller_id, receiver_id, call_type, status').eq('id', signal.call_id).maybeSingle();

            if (callRow && (callRow.status === 'ended' || callRow.status === 'rejected' || callRow.status === 'failed')) return;

            const resolvedCallType = callRow?.call_type || 'voice';
            pendingOfferRef.current = signal.payload;

            const incoming = {
              callId: signal.call_id,
              senderId: signal.sender_id,
              callerName: callerProfile?.full_name || 'HPE Call User',
              callerAvatar: callerProfile?.avatar_url || null,
              callType: resolvedCallType,
            };

            setIncomingCall(incoming);
            incomingCallRef.current = incoming;
            if (notificationsEnabled && ringtoneEnabled) {
              await playSound(RINGTONE_URI, true);
            }
            return;
          }

          if (signal.signal_type === 'answer') {
            if (signal.call_id !== activeCallIdRef.current) return;
            const pc = peerConnectionRef.current;
            if (!pc) return;
            await stopSound();
            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
            await flushPendingIceCandidates(signal.call_id, pc);
            setCallStatus('Connected');
            await supabase.from('calls').update({ status: 'accepted' }).eq('id', signal.call_id);
            return;
          }

          if (signal.signal_type === 'ice') {
            const candidate = signal.payload;
            const callId = signal.call_id;
            const pc = peerConnectionRef.current;
            if (!pc || callId !== activeCallIdRef.current || !pc.remoteDescription) {
              pendingIceRef.current.push({ callId, candidate });
              return;
            }
            try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (error) {}
            return;
          }

          if (signal.signal_type === 'reject') {
            if (signal.call_id !== activeCallIdRef.current) return;
            await stopSound();
            Alert.alert('Call', 'Call rejected');
            await closePeerConnection();
            setCallVisible(false);
            setActiveCallId(null);
            activeCallIdRef.current = null;
            setActiveCallPeerId(null);
            activeCallPeerIdRef.current = null;
            setActiveCallPeerName('');
            setActiveCallPeerAvatar(null);
            setCallStatus('');
            await loadCalls();
            return;
          }

          if (signal.signal_type === 'end') {
            if (signal.call_id !== activeCallIdRef.current && signal.call_id !== incomingCallRef.current?.callId) return;
            await stopSound();
            await closePeerConnection();
            setIncomingCall(null);
            incomingCallRef.current = null;
            setCallVisible(false);
            setActiveCallId(null);
            activeCallIdRef.current = null;
            setActiveCallPeerId(null);
            activeCallPeerIdRef.current = null;
            setActiveCallPeerName('');
            setActiveCallPeerAvatar(null);
            setCallStatus('');
            await loadCalls();
            return;
          }
        } catch (error) {
          console.log('Call signal handling error:', error);
        }
      })
      .subscribe();

    callChannelRef.current = channel;

    return () => {
      disposed = true;
      if (callChannelRef.current === channel) {
        supabase.removeChannel(channel);
        callChannelRef.current = null;
      }
    };
  }, [session?.user?.id, isProfileCompleted, contacts, blockedIds, blockedByIds, notificationsEnabled, ringtoneEnabled]);

  const callSelectedContact = async (type) => {
    if (!selectedContact) return;
    await startCall(selectedContact, type);
  };

  const handleLogout = async () => {
    try {
      const currentCallId = activeCallIdRef.current;
      if (currentCallId) { await endCall(); } else { await closePeerConnection(); }
      await stopSound();
      await cleanupMessageSubscription();
      if (callChannelRef.current) {
        await supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      }
      setIncomingCall(null);
      incomingCallRef.current = null;
      await supabase.auth.signOut();
      setSession(null);
      setIsProfileCompleted(false);
      setProfileName('');
      setAvatarUri(null);
      setAvatarBase64(null);
      setCalls([]);
      setContacts([]);
      setMessages([]);
      setSelectedContact(null);
      selectedContactRef.current = null;
      setSelectedMessage(null);
      setShowMessageMenu(false);
      setPhoneNumber('');
      setOtpCode('');
      setOtpSent(false);
      setActiveTab('calls');
      setCallVisible(false);
      setActiveCallId(null);
      activeCallIdRef.current = null;
      setActiveCallPeerId(null);
      activeCallPeerIdRef.current = null;
      setActiveCallPeerName('');
      setActiveCallPeerAvatar(null);
      setCallStatus('');

      setBlockedUsers([]);
      setBlockedIds([]);
      setBlockedByIds([]);
      setShowReportModal(false);
      setReportTarget(null);
      setReportReason('');
      setShowContactMenu(false);
      setContactMenuTarget(null);
      setCallPrivacy('everyone');
      setMessagePrivacy('everyone');
      setLastSeenPrivacy('everyone');
      setReadReceipts(true);
      setRingtoneEnabled(true);
      setVibrationEnabled(true);
      setNotificationsEnabled(true);
      setStories([]);
      setMyStories([]);
      setViewingStory(null);
      setStoryViewers([]);
      setShowStoryViewers(false);
      setSettingsTab('profile');
    } catch (error) {
      console.log('Logout error:', error);
    }
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopSound();
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      try { InCallManager.stop(); } catch {}
      if (peerConnectionRef.current) { try { peerConnectionRef.current.close(); } catch {} }
      if (localStreamRef.current) { try { localStreamRef.current.getTracks().forEach((track) => track.stop()); } catch {} }
    };
  }, []);

  /* =====================================================
     SPLASH (fixed 1 second, logo only — shown the moment the app opens)
  ===================================================== */

  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <Image source={APP_LOGO} style={styles.splashLogo} resizeMode="contain" />
      </View>
    );
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={APP_LOGO} style={styles.loadingLogo} resizeMode="contain" />
        <ActivityIndicator size="large" color="#00A884" />
        <Text style={styles.loadingText}>HPE Call</Text>
      </View>
    );
  }

  /* =====================================================
     LOGIN
  ===================================================== */

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B141A" />
        <ScrollView contentContainerStyle={styles.loginContent}>
          <View style={styles.logoContainer}>
            <Image source={APP_LOGO} style={styles.logoIcon} resizeMode="contain" />
            <Text style={styles.appName}>HPE Call</Text>
          </View>

          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder="Mobile number ..."
              placeholderTextColor="#8696A0"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>

          <TouchableOpacity style={styles.googleBtn} onPress={signInWithGoogle} disabled={loading}>
            <Text style={styles.googleBtnText}>
              <Text style={{ color: '#EA4335', fontWeight: 'bold' }}>G</Text>
              {'  '}Log in with Google
            </Text>
          </TouchableOpacity>

          {!otpSent ? (
            <TouchableOpacity style={styles.loginBtn} onPress={sendPhoneOtp} disabled={loading}>
              <Text style={styles.loginBtnText}>Log in</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.inputCard}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter OTP"
                  placeholderTextColor="#8696A0"
                  keyboardType="number-pad"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  maxLength={6}
                />
              </View>
              <TouchableOpacity style={styles.loginBtn} onPress={verifyPhoneOtp} disabled={loading}>
                <Text style={styles.loginBtnText}>Verify OTP</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.welcomeBox}>
            <Text style={styles.networkIcon}>🌐</Text>
            <Text style={styles.welcomeTitle}>Welcome to HPE Call</Text>
            <Text style={styles.welcomeSub}>• Secure & Instant Calls</Text>
            <Text style={styles.welcomeSub}>• Global Coverage</Text>
            <Text style={styles.welcomeSub}>• HD Voice Quality</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* =====================================================
     NAME SETUP
  ===================================================== */

  if (!isProfileCompleted) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B141A" />
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>name setup</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.setupContent}>
          <TouchableOpacity onPress={pickImage}>
            <View style={styles.avatarBorder}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <DefaultAvatarIllustration size={116} />
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.changePhotoText}>Tap photo to choose from Gallery</Text>
          <Text style={styles.setupHeading}>Set Your Profile Name</Text>

          <View style={styles.nameInputContainer}>
            <TextInput
              style={styles.nameInput}
              placeholder="Name"
              placeholderTextColor="#8696A0"
              value={profileName}
              onChangeText={setProfileName}
              maxLength={50}
            />
            {profileName.trim().length > 0 && <Text style={styles.checkIcon}>✓</Text>}
          </View>

          <Text style={styles.charCount}>{profileName.length}/50</Text>

          <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={loading}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>

          <View style={styles.bottomFooter}>
            <Text style={styles.welcomeTitle}>Welcome to HPE Call</Text>
            <Image source={APP_LOGO} style={styles.smallFooterLogo} resizeMode="contain" />
            <Text style={styles.footerSub}>hpe call</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* =====================================================
     HOME
  ===================================================== */

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B141A" />

      <View style={styles.homeHeader}>
        <View style={styles.appTitleBox}>
          <Image source={APP_LOGO} style={styles.headerLogo} resizeMode="contain" />
          <Text style={styles.homeTitle}>HPE Call</Text>
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSearch(true)}>
            <Text style={styles.iconText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setSettingsTab('profile');
              setShowSettings(true);
            }}
          >
            <Text style={styles.iconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'calls' && styles.activeTab]} onPress={() => setActiveTab('calls')}>
          <Text style={[styles.tabText, activeTab === 'calls' && styles.activeTabText]}>📞 Calls</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tabItem, activeTab === 'status' && styles.activeTab]} onPress={() => setActiveTab('status')}>
          <Text style={[styles.tabText, activeTab === 'status' && styles.activeTabText]}>📖 Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tabItem, activeTab === 'live' && styles.activeTab]} onPress={() => setActiveTab('live')}>
          <Text style={[styles.tabText, activeTab === 'live' && styles.activeTabText]}>📡 Live</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tabItem, activeTab === 'contacts' && styles.activeTab]} onPress={() => setActiveTab('contacts')}>
          <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>👤 Contacts</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.mainBody}>
        {activeTab === 'calls' && (
          <View style={styles.tabContent}>
            {loadingData ? (
              <ActivityIndicator size="small" color="#00A884" />
            ) : calls.length === 0 ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>No calls yet</Text>
              </View>
            ) : (
              calls.map((call) => {
                const isCaller = call.caller_id === session.user.id;
                return (
                  <View key={call.id} style={styles.callRow}>
                    <View style={styles.userAvatarSmall}>
                      <Image source={APP_LOGO} style={styles.callAvatarImage} />
                    </View>
                    <View style={styles.callDetails}>
                      <Text style={styles.callerName}>{isCaller ? 'Outgoing Call' : 'Incoming Call'}</Text>
                      <Text style={styles.callTime}>{call.status || 'Call'}</Text>
                    </View>
                    <Text style={styles.callTime}>{call.call_type || 'voice'}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'status' && (
          <View style={styles.tabContent}>
            <TouchableOpacity
              style={styles.callRow}
              onPress={() => {
                if (myStories.length > 0) {
                  openMyStoryViewers(myStories[0]);
                } else {
                  uploadStory();
                }
              }}
              disabled={uploadingStory}
            >
              <View style={styles.statusRing}>
                <Image source={avatarUri ? { uri: avatarUri } : APP_LOGO} style={styles.userAvatarSmall} />
                {myStories.length === 0 && (
                  <View style={styles.addStatusBadge}>
                    <Text style={styles.addStatusBadgeText}>+</Text>
                  </View>
                )}
              </View>
              <View style={styles.callDetails}>
                <Text style={styles.callerName}>My Status</Text>
                <Text style={styles.callTime}>
                  {uploadingStory ? 'Uploading...' : myStories.length > 0 ? `${myStories.length} update(s) • Tap to view` : 'Tap to add status update'}
                </Text>
              </View>
              {myStories.length > 0 && (
                <TouchableOpacity style={styles.addBtn} onPress={uploadStory} disabled={uploadingStory}>
                  <Text style={styles.addBtnText}>+</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Recent updates</Text>

            {stories.length === 0 ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>No status updates</Text>
              </View>
            ) : (
              stories.map((story) => (
                <TouchableOpacity key={story.id} style={styles.callRow} onPress={() => openStory(story)}>
                  <View style={styles.statusRing}>
                    <Image
                      source={story.profile?.avatar_url ? { uri: story.profile.avatar_url } : APP_LOGO}
                      style={styles.userAvatarSmall}
                    />
                  </View>
                  <View style={styles.callDetails}>
                    <Text style={styles.callerName}>{story.profile?.full_name || 'Unknown User'}</Text>
                    <Text style={styles.callTime}>{new Date(story.created_at).toLocaleTimeString()}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'live' && (
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>No Active Live Streams</Text>
          </View>
        )}

        {activeTab === 'contacts' && (
          <View style={styles.tabContent}>
            {contacts.length === 0 ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>No Contacts</Text>
              </View>
            ) : (
              contacts.map((contact) => (
                <TouchableOpacity
                  key={contact.id}
                  style={styles.callRow}
                  onPress={() => openChat(contact)}
                  onLongPress={() => {
                    setContactMenuTarget(contact);
                    setShowContactMenu(true);
                  }}
                  delayLongPress={350}
                >
                  <Image
                    source={contact.profile?.avatar_url ? { uri: contact.profile.avatar_url } : APP_LOGO}
                    style={styles.userAvatarSmall}
                  />
                  <View style={styles.callDetails}>
                    <Text style={styles.callerName}>{contact.profile?.full_name || 'Unknown User'}</Text>
                    <Text style={styles.callTime}>Tap to chat • Hold for options</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* =================================================
          SEARCH
      ================================================= */}

      <Modal visible={showSearch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.searchModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Users</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSearch(false);
                  setSearchText('');
                  setSearchResults([]);
                }}
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search by name..."
              placeholderTextColor="#8696A0"
              value={searchText}
              onChangeText={searchUsers}
              autoFocus
            />

            <ScrollView>
              {searchResults.map((user) => (
                <View key={user.id} style={styles.searchRow}>
                  <Image source={user.avatar_url ? { uri: user.avatar_url } : APP_LOGO} style={styles.userAvatarSmall} />
                  <Text style={styles.searchName}>{user.full_name || 'Unnamed'}</Text>
                  <TouchableOpacity style={styles.addBtn} onPress={() => addContact(user)}>
                    <Text style={styles.addBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =================================================
          CONTACT MENU (Chat / Call / Block / Report)
      ================================================= */}

      <Modal
        visible={showContactMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactMenu(false)}
      >
        <View style={styles.messageMenuOverlay}>
          <View style={styles.messageMenuCard}>
            <Text style={styles.messageMenuTitle}>
              {contactMenuTarget?.profile?.full_name || contactMenuTarget?.full_name || 'Contact'}
            </Text>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => {
                setShowContactMenu(false);
                openChat(contactMenuTarget);
              }}
            >
              <Text style={styles.menuButtonText}>💬 Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => {
                setShowContactMenu(false);
                startCall(contactMenuTarget, 'voice');
              }}
            >
              <Text style={styles.menuButtonText}>📞 Voice Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => {
                setShowContactMenu(false);
                startCall(contactMenuTarget, 'video');
              }}
            >
              <Text style={styles.menuButtonText}>📹 Video Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButtonDanger}
              onPress={() =>
                Alert.alert(
                  'Block User',
                  `${contactMenuTarget?.profile?.full_name || 'এই ব্যবহারকারী'} কে সত্যিই Block করতে চান?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Block',
                      style: 'destructive',
                      onPress: () => blockUser(contactMenuTarget?.profile || contactMenuTarget),
                    },
                  ]
                )
              }
            >
              <Text style={styles.menuButtonDangerText}>🚫 Block</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuButtonDanger}
              onPress={() => openReportModal(contactMenuTarget?.profile || contactMenuTarget)}
            >
              <Text style={styles.menuButtonDangerText}>⚠️ Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuCancelButton}
              onPress={() => {
                setShowContactMenu(false);
                setContactMenuTarget(null);
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* =================================================
          REPORT USER
      ================================================= */}

      <Modal
        visible={showReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.messageMenuOverlay}>
          <View style={styles.messageMenuCard}>
            <Text style={styles.messageMenuTitle}>Report {reportTarget?.full_name || 'User'}</Text>

            <TextInput
              style={styles.reportInput}
              placeholder="Report করার কারণ লিখুন..."
              placeholderTextColor="#8696A0"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity style={styles.menuButtonDanger} onPress={submitReport}>
              <Text style={styles.menuButtonDangerText}>Submit Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuCancelButton}
              onPress={() => {
                setShowReportModal(false);
                setReportTarget(null);
                setReportReason('');
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* =================================================
          SETTINGS (Profile / Notifications / Privacy / Security / Blocked)
      ================================================= */}

      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.settingsFullModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.settingsTabBar}>
              {[
                { key: 'profile', label: '👤 Profile' },
                { key: 'notifications', label: '🔔 Notifications' },
                { key: 'privacy', label: '🔒 Privacy' },
                { key: 'security', label: '🛡️ Security' },
                { key: 'blocked', label: '🚫 Blocked' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.settingsTabItem, settingsTab === tab.key && styles.settingsTabItemActive]}
                  onPress={() => setSettingsTab(tab.key)}
                >
                  <Text style={[styles.settingsTabText, settingsTab === tab.key && styles.settingsTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={styles.settingsBody}>
              {settingsTab === 'profile' && (
                <View>
                  <View style={styles.settingsProfileRow}>
                    <TouchableOpacity onPress={pickImage}>
                      <Image
                        source={avatarUri ? { uri: avatarUri } : APP_LOGO}
                        style={styles.settingsAvatar}
                      />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <TextInput
                        style={styles.settingsNameInput}
                        value={profileName}
                        onChangeText={setProfileName}
                        placeholder="Name"
                        placeholderTextColor="#8696A0"
                      />
                      <Text style={styles.settingsEmail}>
                        {session.user.email || session.user.phone || ''}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={loading}>
                    <Text style={styles.saveBtnText}>Save Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={() => {
                      setShowSettings(false);
                      handleLogout();
                    }}
                  >
                    <Text style={styles.logoutText}>Log out</Text>
                  </TouchableOpacity>
                </View>
              )}

              {settingsTab === 'notifications' && (
                <View>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Notifications</Text>
                    <TouchableOpacity
                      style={[styles.toggleTrack, notificationsEnabled && styles.toggleTrackOn]}
                      onPress={() => toggleSetting('notifications_enabled', notificationsEnabled, setNotificationsEnabled)}
                    >
                      <View style={[styles.toggleThumb, notificationsEnabled && styles.toggleThumbOn]} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Ringtone</Text>
                    <TouchableOpacity
                      style={[styles.toggleTrack, ringtoneEnabled && styles.toggleTrackOn]}
                      onPress={() => toggleSetting('ringtone_enabled', ringtoneEnabled, setRingtoneEnabled)}
                    >
                      <View style={[styles.toggleThumb, ringtoneEnabled && styles.toggleThumbOn]} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Vibration</Text>
                    <TouchableOpacity
                      style={[styles.toggleTrack, vibrationEnabled && styles.toggleTrackOn]}
                      onPress={() => toggleSetting('vibration_enabled', vibrationEnabled, setVibrationEnabled)}
                    >
                      <View style={[styles.toggleThumb, vibrationEnabled && styles.toggleThumbOn]} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {settingsTab === 'privacy' && (
                <View>
                  <Text style={styles.settingsGroupTitle}>Who can call me</Text>
                  {['everyone', 'contacts', 'nobody'].map((opt) => (
                    <TouchableOpacity key={opt} style={styles.radioRow} onPress={() => updateCallPrivacy(opt)}>
                      <View style={[styles.radioOuter, callPrivacy === opt && styles.radioOuterActive]}>
                        {callPrivacy === opt && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.settingLabel}>
                        {opt === 'everyone' ? 'Everyone' : opt === 'contacts' ? 'My Contacts' : 'Nobody'}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  <Text style={styles.settingsGroupTitle}>Who can message me</Text>
                  {['everyone', 'contacts', 'nobody'].map((opt) => (
                    <TouchableOpacity key={opt} style={styles.radioRow} onPress={() => updateMessagePrivacy(opt)}>
                      <View style={[styles.radioOuter, messagePrivacy === opt && styles.radioOuterActive]}>
                        {messagePrivacy === opt && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.settingLabel}>
                        {opt === 'everyone' ? 'Everyone' : opt === 'contacts' ? 'My Contacts' : 'Nobody'}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  <Text style={styles.settingsGroupTitle}>Last seen</Text>
                  {['everyone', 'contacts', 'nobody'].map((opt) => (
                    <TouchableOpacity key={opt} style={styles.radioRow} onPress={() => updateLastSeenPrivacy(opt)}>
                      <View style={[styles.radioOuter, lastSeenPrivacy === opt && styles.radioOuterActive]}>
                        {lastSeenPrivacy === opt && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.settingLabel}>
                        {opt === 'everyone' ? 'Everyone' : opt === 'contacts' ? 'My Contacts' : 'Nobody'}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Read Receipts</Text>
                    <TouchableOpacity
                      style={[styles.toggleTrack, readReceipts && styles.toggleTrackOn]}
                      onPress={() => toggleSetting('read_receipts', readReceipts, setReadReceipts)}
                    >
                      <View style={[styles.toggleThumb, readReceipts && styles.toggleThumbOn]} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {settingsTab === 'security' && (
                <View>
                  <Text style={styles.settingsGroupTitle}>Account</Text>
                  <Text style={styles.settingsHint}>
                    আপনার account {session.user.email || session.user.phone} দিয়ে সুরক্ষিত।
                  </Text>

                  <TouchableOpacity
                    style={styles.menuButtonDanger}
                    onPress={() =>
                      Alert.alert(
                        'Log out other devices',
                        'অন্য সব ডিভাইস থেকে Log out করতে চান?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Log out', style: 'destructive', onPress: signOutOtherDevices },
                        ]
                      )
                    }
                  >
                    <Text style={styles.menuButtonDangerText}>Log out from other devices</Text>
                  </TouchableOpacity>
                </View>
              )}

              {settingsTab === 'blocked' && (
                <View>
                  <Text style={styles.settingsGroupTitle}>Blocked Users ({blockedUsers.length})</Text>
                  {blockedUsers.length === 0 ? (
                    <View style={styles.centerBox}>
                      <Text style={styles.emptyText}>No blocked users</Text>
                    </View>
                  ) : (
                    blockedUsers.map((user) => (
                      <View key={user.id} style={styles.searchRow}>
                        <Image source={user.avatar_url ? { uri: user.avatar_url } : APP_LOGO} style={styles.userAvatarSmall} />
                        <Text style={styles.searchName}>{user.full_name || 'Unnamed'}</Text>
                        <TouchableOpacity style={styles.unblockBtn} onPress={() => unblockUser(user.id)}>
                          <Text style={styles.unblockBtnText}>Unblock</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =================================================
          STORY VIEWER
      ================================================= */}

      <Modal visible={Boolean(viewingStory) && !showStoryViewers} animationType="fade" onRequestClose={closeStory}>
        <SafeAreaView style={styles.storyScreen}>
          {viewingStory && (
            <>
              <View style={styles.storyTopBar}>
                <Image
                  source={viewingStory.profile?.avatar_url ? { uri: viewingStory.profile.avatar_url } : APP_LOGO}
                  style={styles.storyAvatarSmall}
                />
                <Text style={styles.storyUserName}>{viewingStory.profile?.full_name || 'My Status'}</Text>
                <TouchableOpacity onPress={closeStory} style={{ marginLeft: 'auto' }}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Image source={{ uri: viewingStory.media_url }} style={styles.storyImage} resizeMode="contain" />

              {viewingStory.user_id === session.user.id && (
                <TouchableOpacity
                  style={styles.viewersBar}
                  onPress={() => {
                    loadStoryViewers(viewingStory.id);
                    setShowStoryViewers(true);
                  }}
                >
                  <Text style={styles.viewersBarText}>👁 Viewers</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* =================================================
          STORY VIEWERS LIST
      ================================================= */}

      <Modal
        visible={showStoryViewers}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStoryViewers(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.searchModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Viewers ({storyViewers.length})</Text>
              <TouchableOpacity onPress={() => setShowStoryViewers(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {storyViewers.length === 0 ? (
                <View style={styles.centerBox}>
                  <Text style={styles.emptyText}>এখনও কেউ দেখেননি</Text>
                </View>
              ) : (
                storyViewers.map((viewer) => (
                  <View key={viewer.id} style={styles.searchRow}>
                    <Image source={viewer.avatar_url ? { uri: viewer.avatar_url } : APP_LOGO} style={styles.userAvatarSmall} />
                    <Text style={styles.searchName}>{viewer.full_name || 'Unnamed'}</Text>
                    <Text style={styles.callTime}>{new Date(viewer.viewed_at).toLocaleTimeString()}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =================================================
          CHAT
      ================================================= */}

      <Modal visible={Boolean(selectedContact)} animationType="slide">
        <SafeAreaView style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={closeChat}>
              <Text style={styles.backBtn}>←</Text>
            </TouchableOpacity>

            <Image
              source={selectedContact?.profile?.avatar_url ? { uri: selectedContact.profile.avatar_url } : APP_LOGO}
              style={styles.chatAvatar}
            />

            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.chatTitle}>{selectedContact?.profile?.full_name || 'Chat'}</Text>
              <Text style={styles.callTime}>HPE Call</Text>
            </View>

            <TouchableOpacity style={styles.iconBtn} onPress={() => callSelectedContact('voice')}>
              <Text style={styles.iconText}>📞</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={() => callSelectedContact('video')}>
              <Text style={styles.iconText}>📹</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                setContactMenuTarget(selectedContact);
                setShowContactMenu(true);
              }}
            >
              <Text style={styles.iconText}>⋮</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.chatBody} contentContainerStyle={{ paddingBottom: 20 }}>
            {messages.map((message) => {
              const mine = message.sender_id === session.user.id;
              const deletedForEveryone = message.is_deleted_for_everyone === true;

              return (
                <TouchableOpacity
                  key={message.id}
                  activeOpacity={0.8}
                  onLongPress={() => openMessageMenu(message)}
                  delayLongPress={350}
                  style={[styles.messageBubble, mine ? styles.myMessage : styles.theirMessage]}
                >
                  {deletedForEveryone ? (
                    <Text style={[styles.messageText, { fontStyle: 'italic', color: '#8696A0' }]}>
                      This message was deleted
                    </Text>
                  ) : (
                    <Text style={styles.messageText}>{message.message}</Text>
                  )}
                  <Text style={styles.messageTime}>
                    {message.created_at ? new Date(message.created_at).toLocaleTimeString() : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.inputBar}
          >
            <TextInput
              style={styles.chatInput}
              placeholder="Message"
              placeholderTextColor="#8696A0"
              value={messageText}
              onChangeText={setMessageText}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
              <Text style={{ color: '#000', fontSize: 18 }}>➤</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* =================================================
          MESSAGE DELETE MENU
      ================================================= */}

      <Modal
        visible={showMessageMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageMenu(false)}
      >
        <View style={styles.messageMenuOverlay}>
          <View style={styles.messageMenuCard}>
            <Text style={styles.messageMenuTitle}>Delete message</Text>

            <TouchableOpacity style={styles.menuButton} onPress={deleteMessageForMe}>
              <Text style={styles.menuButtonText}>Delete for me</Text>
            </TouchableOpacity>

            {selectedMessage?.sender_id === session.user.id && (
              <TouchableOpacity style={styles.menuButton} onPress={deleteMessageForEveryone}>
                <Text style={styles.menuButtonText}>Delete for everyone</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.menuCancelButton}
              onPress={() => {
                setSelectedMessage(null);
                setShowMessageMenu(false);
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* =================================================
          INCOMING CALL
      ================================================= */}

      <Modal visible={Boolean(incomingCall)} transparent animationType="fade">
        <View style={styles.incomingOverlay}>
          <View style={styles.incomingCard}>
            <Image
              source={incomingCall?.callerAvatar ? { uri: incomingCall.callerAvatar } : APP_LOGO}
              style={styles.incomingAvatar}
            />
            <Text style={styles.incomingTitle}>{incomingCall?.callerName || 'Incoming Call'}</Text>
            <Text style={styles.incomingSub}>
              Incoming {incomingCall?.callType === 'video' ? 'Video' : 'Voice'} Call
            </Text>

            <View style={styles.incomingButtons}>
              <TouchableOpacity style={styles.rejectCallBtn} onPress={() => rejectIncomingCall()}>
                <Text style={styles.callButtonText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptCallBtn} onPress={acceptIncomingCall}>
                <Text style={styles.callButtonText}>✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================
          ACTIVE CALL
      ================================================= */}

      <Modal visible={callVisible} animationType="slide" onRequestClose={endCall}>
        <SafeAreaView style={styles.callScreen}>
          <View style={styles.callTopBar}>
            <Text style={styles.callPeerName}>{activeCallPeerName || 'HPE Call'}</Text>
            <Text style={styles.callStatus}>
              {callStatus === 'Connected' ? formatCallDuration(callSeconds) : callStatus || 'Calling...'}
            </Text>
          </View>

          {callType === 'video' ? (
            <View style={styles.videoArea}>
              {remoteStream ? (
                <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
              ) : (
                <View style={styles.waitingVideo}>
                  <Image
                    source={activeCallPeerAvatar ? { uri: activeCallPeerAvatar } : APP_LOGO}
                    style={styles.waitingAvatar}
                  />
                  <Text style={styles.waitingText}>{callStatus || 'Connecting...'}</Text>
                </View>
              )}

              {localStream && !isCameraOff && (
                <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" mirror={isFrontCamera} />
              )}

              {localStream && isCameraOff && (
                <View style={styles.localVideoOff}>
                  <Text style={styles.localVideoOffText}>Camera off</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.voiceArea}>
              <Image
                source={activeCallPeerAvatar ? { uri: activeCallPeerAvatar } : APP_LOGO}
                style={styles.voiceAvatar}
              />
              <Text style={styles.voiceName}>{activeCallPeerName || 'HPE Call'}</Text>
              <Text style={styles.voiceStatus}>
                {callStatus === 'Connected' ? formatCallDuration(callSeconds) : callStatus || 'Calling...'}
              </Text>
              {isMuted && <Text style={styles.mutedBadge}>🔇 Muted</Text>}
            </View>
          )}

          <View style={styles.callControlsRow}>
            <TouchableOpacity
              style={[styles.callControlBtn, isMuted && styles.callControlBtnActive]}
              onPress={toggleMute}
            >
              <Text style={styles.callControlIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
            </TouchableOpacity>

            {callType === 'video' && (
              <>
                <TouchableOpacity
                  style={[styles.callControlBtn, isCameraOff && styles.callControlBtnActive]}
                  onPress={toggleCameraOff}
                >
                  <Text style={styles.callControlIcon}>{isCameraOff ? '📷' : '📹'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.callControlBtn} onPress={switchCamera}>
                  <Text style={styles.callControlIcon}>🔄</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.callControls}>
            <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
              <Text style={styles.endCallText}>📵</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B141A' },
  splashContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B141A' },
  splashLogo: { width: 100, height: 100, borderRadius: 22 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B141A' },
  loadingLogo: { width: 90, height: 90, marginBottom: 20 },
  loadingText: { color: '#FFFFFF', fontSize: 18, marginTop: 15 },
  loginContent: { padding: 24, alignItems: 'center', flexGrow: 1 },
  logoContainer: { alignItems: 'center', marginVertical: 35 },
  logoIcon: { width: 100, height: 100, borderRadius: 22 },
  appName: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginTop: 12 },
  inputCard: { width: '100%', backgroundColor: '#1C272D', borderRadius: 30, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 16, borderWidth: 1, borderColor: '#2A3942' },
  input: { color: '#FFFFFF', fontSize: 16 },
  googleBtn: { width: '100%', backgroundColor: '#344147', borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  googleBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  loginBtn: { width: '100%', backgroundColor: '#18385C', borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  welcomeBox: { alignItems: 'center', marginTop: 20 },
  networkIcon: { fontSize: 22, marginBottom: 6 },
  welcomeTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 10 },
  welcomeSub: { color: '#8696A0', fontSize: 14, marginVertical: 2 },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  cancelText: { color: '#8696A0', fontSize: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 16 },
  setupContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 120 },
  avatarBorder: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: '#00A884', overflow: 'hidden', marginBottom: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#202C33' },
  avatarImage: { width: '100%', height: '100%' },
  changePhotoText: { color: '#8696A0', fontSize: 12, marginBottom: 30 },
  setupHeading: { color: '#FFFFFF', fontSize: 22, fontWeight: '500', marginBottom: 20 },
  nameInputContainer: { width: '100%', backgroundColor: '#1F2C34', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderColor: '#00A884', borderWidth: 1.5, flexDirection: 'row', alignItems: 'center' },
  nameInput: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  checkIcon: { color: '#00A884', fontSize: 18, fontWeight: 'bold' },
  charCount: { color: '#8696A0', fontSize: 12, alignSelf: 'flex-end', marginTop: 4, marginBottom: 30 },
  saveBtn: { width: '100%', backgroundColor: '#2E7D32', borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  bottomFooter: { position: 'absolute', bottom: 20, alignItems: 'center' },
  smallFooterLogo: { width: 40, height: 40, marginVertical: 4 },
  footerSub: { color: '#8696A0', fontSize: 12 },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  appTitleBox: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 30, height: 30, borderRadius: 7, marginRight: 8 },
  homeTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row' },
  iconBtn: { marginLeft: 14 },
  iconText: { fontSize: 18 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1F2C34' },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#00A884' },
  tabText: { color: '#8696A0', fontSize: 13 },
  activeTabText: { color: '#00A884', fontWeight: 'bold' },
  mainBody: { flex: 1, padding: 16 },
  tabContent: { flex: 1 },
  centerBox: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { color: '#8696A0', fontSize: 14 },
  sectionLabel: { color: '#8696A0', fontSize: 13, marginVertical: 12, textTransform: 'uppercase' },
  callRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  userAvatarSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#374248', marginRight: 12, overflow: 'hidden' },
  callAvatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  callDetails: { flex: 1 },
  callerName: { color: '#FFFFFF', fontSize: 16 },
  callTime: { color: '#8696A0', fontSize: 12 },
  statusRing: { borderWidth: 2, borderColor: '#00A884', borderRadius: 24, marginRight: 12, position: 'relative' },
  addStatusBadge: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#00A884', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0B141A' },
  addStatusBadgeText: { color: '#000', fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  searchModal: { height: '80%', backgroundColor: '#0B141A', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  settingsModal: { backgroundColor: '#1F2C34', borderRadius: 20, margin: 20, padding: 24 },
  settingsFullModal: { height: '88%', backgroundColor: '#0B141A', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  settingsTabBar: { flexGrow: 0, marginBottom: 12 },
  settingsTabItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1F2C34', marginRight: 8 },
  settingsTabItemActive: { backgroundColor: '#00A884' },
  settingsTabText: { color: '#8696A0', fontSize: 13 },
  settingsTabTextActive: { color: '#000000', fontWeight: 'bold' },
  settingsBody: { flex: 1 },
  settingsProfileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  settingsAvatar: { width: 70, height: 70, borderRadius: 35 },
  settingsNameInput: { color: '#FFFFFF', fontSize: 18, borderBottomWidth: 1, borderBottomColor: '#2A3942', paddingVertical: 6, marginBottom: 6 },
  settingsGroupTitle: { color: '#00A884', fontSize: 14, fontWeight: 'bold', marginTop: 18, marginBottom: 10, textTransform: 'uppercase' },
  settingsHint: { color: '#8696A0', fontSize: 13, marginBottom: 16 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1F2C34' },
  settingLabel: { color: '#FFFFFF', fontSize: 15 },
  toggleTrack: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#374248', padding: 3, justifyContent: 'center' },
  toggleTrackOn: { backgroundColor: '#00A884' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#8696A0', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  radioOuterActive: { borderColor: '#00A884' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00A884' },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#2A3942' },
  unblockBtnText: { color: '#FFFFFF', fontSize: 13 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  closeText: { color: '#FFFFFF', fontSize: 22 },
  searchInput: { backgroundColor: '#1F2C34', borderRadius: 12, color: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 15 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  searchName: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#00A884', justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#000000', fontSize: 24, fontWeight: 'bold' },
  settingsName: { color: '#FFFFFF', fontSize: 18, marginBottom: 5 },
  settingsEmail: { color: '#8696A0', marginBottom: 4 },
  logoutBtn: { backgroundColor: '#B42318', paddingVertical: 14, borderRadius: 30, alignItems: 'center', marginTop: 16, marginBottom: 12 },
  logoutText: { color: '#FFFFFF', fontWeight: 'bold' },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#8696A0' },
  chatContainer: { flex: 1, backgroundColor: '#0B141A' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#1F2C34' },
  backBtn: { color: '#FFFFFF', fontSize: 28, marginRight: 10 },
  chatAvatar: { width: 42, height: 42, borderRadius: 21 },
  chatTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  chatBody: { flex: 1, padding: 16 },
  messageBubble: { padding: 10, borderRadius: 10, maxWidth: '78%', marginBottom: 8 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#005C4B' },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#202C33' },
  messageText: { color: '#FFFFFF', fontSize: 16 },
  messageTime: { color: '#8696A0', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#1F2C34' },
  chatInput: { flex: 1, backgroundColor: '#2A3942', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, color: '#FFFFFF', marginRight: 8, maxHeight: 100 },
  sendBtn: { backgroundColor: '#00A884', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  messageMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  messageMenuCard: { width: '100%', backgroundColor: '#1F2C34', borderRadius: 20, padding: 22 },
  messageMenuTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  menuButton: { backgroundColor: '#2A3942', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 15, marginBottom: 10 },
  menuButtonText: { color: '#FFFFFF', fontSize: 16 },
  menuButtonDanger: { backgroundColor: '#3A1E1E', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 15, marginBottom: 10 },
  menuButtonDangerText: { color: '#FF6B6B', fontSize: 16, fontWeight: '600' },
  menuCancelButton: { paddingVertical: 15, alignItems: 'center' },
  reportInput: { backgroundColor: '#2A3942', borderRadius: 12, color: '#FFFFFF', padding: 14, marginBottom: 14, textAlignVertical: 'top', minHeight: 90 },
  incomingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  incomingCard: { width: '100%', backgroundColor: '#1F2C34', borderRadius: 24, padding: 28, alignItems: 'center' },
  incomingAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 18 },
  incomingTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  incomingSub: { color: '#8696A0', fontSize: 15, marginTop: 8, marginBottom: 30 },
  incomingButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '70%' },
  rejectCallBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#B42318', justifyContent: 'center', alignItems: 'center' },
  acceptCallBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#00A884', justifyContent: 'center', alignItems: 'center' },
  callButtonText: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold' },
  callScreen: { flex: 1, backgroundColor: '#050A0D' },
  callTopBar: { paddingHorizontal: 20, paddingVertical: 18, alignItems: 'center', backgroundColor: '#0B141A' },
  callPeerName: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  callStatus: { color: '#00A884', fontSize: 14, marginTop: 5 },
  videoArea: { flex: 1, position: 'relative', backgroundColor: '#000000' },
  remoteVideo: { flex: 1, backgroundColor: '#000000' },
  localVideo: { position: 'absolute', right: 15, top: 15, width: 110, height: 160, borderRadius: 12, backgroundColor: '#202C33' },
  waitingVideo: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  waitingAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 20 },
  waitingText: { color: '#FFFFFF', fontSize: 16 },
  voiceArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  voiceAvatar: { width: 130, height: 130, borderRadius: 65, marginBottom: 25 },
  voiceName: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
  voiceStatus: { color: '#00A884', fontSize: 16, marginTop: 10 },
  callControls: { paddingVertical: 30, alignItems: 'center', backgroundColor: '#0B141A' },
  callControlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingVertical: 10, backgroundColor: '#0B141A' },
  callControlBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#2A3942', justifyContent: 'center', alignItems: 'center' },
  callControlBtnActive: { backgroundColor: '#B42318' },
  callControlIcon: { fontSize: 22 },
  localVideoOff: { position: 'absolute', right: 15, top: 15, width: 110, height: 160, borderRadius: 12, backgroundColor: '#202C33', justifyContent: 'center', alignItems: 'center' },
  localVideoOffText: { color: '#8696A0', fontSize: 11 },
  mutedBadge: { color: '#FF6B6B', fontSize: 13, marginTop: 10 },
  endCallButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#B42318', justifyContent: 'center', alignItems: 'center' },
  endCallText: { fontSize: 28 },
  storyScreen: { flex: 1, backgroundColor: '#000000' },
  storyTopBar: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  storyAvatarSmall: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  storyUserName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  storyImage: { flex: 1, width: '100%' },
  viewersBar: { padding: 16, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  viewersBarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, SafeAreaView, StatusBar, Image, Alert } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const SUPABASE_URL = 'https://wmljlqrawcwvbmcubfkc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XHhjcZ6t2-P24epkL3oX_Q_A1XmlaUJ';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  const signInWithGoogle = async () => {
    const redirectUrl = AuthSession.makeRedirectUri();
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl } });
    if (error) Alert.alert('Error', error.message);
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const recentChats = [
    { id: '1', name: 'Piha 3', type: 'Video call', time: '9:27 am' },
    { id: '2', name: 'আব্বাজান', type: 'Missed video call', time: 'Yesterday' },
    { id: '3', name: 'ভোরের আলো', type: 'Missed video call', time: 'Yesterday' },
  ];

  if (!session) {
    return (
      <View style={styles.loginContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centerBox}>
          <Text style={styles.appTitle}>HPE Call</Text>
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>নাম্বার লগইন</Text>
            <TextInput style={styles.inputBox} placeholder="Enter Phone Number" />
            <TouchableOpacity style={styles.googleBtn} onPress={signInWithGoogle}>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.homeContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topTabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Image source={{ uri: session.user_metadata.avatar_url }} style={styles.tabAvatar} />
          <Text style={styles.tabText}>প্রোফাইল</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, styles.activeTab]}>
          <Text style={styles.tabText}>মেসেজ বা কল</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>8</Text></View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={recentChats}
        keyExtractor={(item) => item.id}
        style={styles.chatList}
        renderItem={({ item }) => (
          <View style={styles.chatRow}>
            <Image source={{ uri: `https://i.pravatar.cc/100?u=${item.id}` }} style={styles.userAvatar} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.chatName}>{item.name}</Text>
              <Text style={styles.chatType}>{item.type}</Text>
            </View>
            <Text style={styles.chatTime}>{item.time}</Text>
          </View>
        )}
      />
      <TouchableOpacity onPress={signOut}><Text style={styles.logoutText}>Logout</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginContainer: { flex: 1, backgroundColor: '#f5f5f5', justifyContent:'center' },
  centerBox: { padding: 20 },
  appTitle:
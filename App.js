import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, FlatList, Image } from 'react-native';

export default function App() {
  const [userInfo, setUserInfo] = useState(null);

  // ডামি রিসেন্ট কল ডাটা (imo-এর মতো)
  const recentCalls = [
    { id: '1', name: 'Piha 3', time: '9:27 am', type: 'Video call', count: 0 },
    { id: '2', name: 'Piha1', time: '9:22 am', type: 'Canceled', count: 0 },
    { id: '3', name: 'আব্বাজান', time: 'Yesterday', type: 'Tap to view', count: 1 },
    { id: '4', name: 'ভোরের আলো', time: 'Yesterday', type: 'Canceled', count: 0 },
    { id: '5', name: 'ভাবি রিচি', time: 'Yesterday', type: 'ok', count: 1 },
  ];

  const handleGoogleLogin = () => {
    setUserInfo({ name: 'Mohammad Husain', email: 'user@gmail.com' });
  };

  const handleMakeCall = (name) => {
    Alert.alert('কল হচ্ছে...', `${name}-কে কল করা হচ্ছে`);
  };

  return (
    <View style={styles.container}>
      {!userInfo ? (
        <View style={styles.loginContainer}>
          <Text style={styles.appTitle}>HPE Call App</Text>
          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
            <Text style={styles.btnText}>Google দিয়ে লগইন করুন</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* টপ হেডার বার */}
          <View style={styles.header}>
            <View style={styles.profileCircle}>
              <Text style={styles.profileText}>H</Text>
            </View>
            <View style={styles.topTabs}>
              <TouchableOpacity style={styles.activeTab}>
                <Text style={styles.tabIcon}>💬</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>9</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inactiveTab}>
                <Text style={styles.tabIcon}>👤</Text>
                <View style={[styles.badge, { backgroundColor: '#4caf50' }]}><Text style={styles.badgeText}>1</Text></View>
              </TouchableOpacity>
            </View>
          </View>

          {/* স্টোরি / অনলাইন অ্যাক্টিভ ইউজার সেকশন */}
          <View style={styles.storySection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.storyItem}>
                <View style={styles.addStoryBtn}>
                  <Text style={{ color: '#0088cc', fontSize: 20 }}>+</Text>
                </View>
                <Text style={styles.storyName}>Story</Text>
              </View>

              {['Bhabi', 'আপা', 'গ্রামে ছেলে', 'R,S'].map((item, idx) => (
                <View key={idx} style={styles.storyItem}>
                  <View style={styles.storyAvatar}>
                    <Text style={{ color: '#fff', fontSize: 16 }}>{item.charAt(0)}</Text>
                    <View style={styles.onlineBadge}>
                      <Text style={{ color: '#fff', fontSize: 9 }}>{idx + 1}</Text>
                    </View>
                  </View>
                  <Text style={styles.storyName}>{item}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* রিসেন্ট কল লিস্ট */}
          <FlatList
            data={recentCalls}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.callRow}>
                <View style={styles.userAvatar}>
                  <Text style={styles.avatarLetter}>{item.name.charAt(0)}</Text>
                </View>

                <View style={styles.callDetails}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.callType}>{item.type}</Text>
                </View>

                <View style={styles.rightInfo}>
                  <Text style={styles.callTime}>{item.time}</Text>
                  <TouchableOpacity onPress={() => handleMakeCall(item.name)}>
                    <Text style={styles.callIcon}>📞</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          {/* বটম মেনু বার */}
          <View style={styles.bottomBar}>
            <TouchableOpacity><Text style={styles.bottomIcon}>➕</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setUserInfo(null)}>
              <Text style={{ color: '#ff3b30', fontWeight: 'bold' }}>লগআউট</Text>
            </TouchableOpacity>
            <TouchableOpacity><Text style={styles.bottomIcon}>🔍</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', // Dark Mode background
    paddingTop: 40,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  appTitle: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 30,
  },
  googleBtn: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  profileCircle: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  topTabs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTab: {
    marginRight: 20,
  },
  inactiveTab: {
    opacity: 0.6,
  },
  tabIcon: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#0088cc',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  storySection: {
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
    paddingLeft: 15,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 18,
  },
  addStoryBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#4caf50',
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyName: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 5,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  userAvatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  callDetails: {
    flex: 1,
    marginLeft: 15,
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  callType: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  rightInfo: {
    alignItems: 'flex-end',
  },
  callTime: {
    color: '#777',
    fontSize: 12,
    marginBottom: 5,
  },
  callIcon: {
    fontSize: 20,
    color: '#0088cc',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 15,
    backgroundColor: '#1a1a1a',
  },
  bottomIcon: {
    fontSize: 20,
    color: '#0088cc',
  },
});

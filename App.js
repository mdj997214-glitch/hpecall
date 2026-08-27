import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, TextInput } from 'react-native';

export default function App() {
  const [userInfo, setUserInfo] = useState(null);
  const [callId, setCallId] = useState('');

  const handleGoogleLogin = () => {
    // ডেমো জিমেইল লগইন সেটআপ
    setUserInfo({ name: 'User', email: 'user@gmail.com' });
    Alert.alert('সফল!', 'গুগল দিয়ে সফলভাবে প্রবেশ করেছেন');
  };

  const handleStartCall = () => {
    if (!callId) {
      Alert.alert('ভুল তথ্য', 'দয়া করে একটি আইডি বা নম্বর লিখুন।');
      return;
    }
    Alert.alert('কল হচ্ছে...', `${callId} নম্বরে কল সংযুক্ত করা হচ্ছে।`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>HPE Call App</Text>

      {!userInfo ? (
        <View style={styles.card}>
          <Text style={styles.subTitle}>অ্যাপ ব্যবহার করতে প্রবেশ করুন</Text>
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
          >
            <Text style={styles.btnText}>Google দিয়ে লগইন করুন</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.welcomeText}>স্বাগতম! আপনি অনলাইনে আছেন</Text>

          <TextInput
            style={styles.input}
            placeholder="যাকে কল করবেন তার আইডি দিন"
            value={callId}
            onChangeText={setCallId}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.callBtn} onPress={handleStartCall}>
            <Text style={styles.btnText}>📞 কল শুরু করুন</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setUserInfo(null)}
          >
            <Text style={{ color: '#ff3b30', marginTop: 15, textAlign: 'center' }}>
              লগআউট করুন
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 30,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 25,
    borderRadius: 15,
    elevation: 5,
  },
  subTitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2e7d32',
    textAlign: 'center',
    marginBottom: 20,
  },
  googleBtn: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  callBtn: {
    backgroundColor: '#34c759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 10,
  },
  logoutBtn: {
    marginTop: 10,
  },
});

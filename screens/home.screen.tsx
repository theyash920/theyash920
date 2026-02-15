import { FontAwesome, FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { scale, verticalScale } from "react-native-size-matters";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://10.0.2.2:8000";

export default function HomeScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording>();
  const [AISpeaking, setAISpeaking] = useState(false);
  const [autoListenAfterSpeech, setAutoListenAfterSpeech] = useState(true);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const lottieRef = useRef<LottieView>(null);
  const chatScrollRef = useRef<ScrollView>(null);
  const [nutritionData, setNutritionData] = useState<any>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);

  useEffect(() => {
    if (AISpeaking) {
      lottieRef.current?.play();
    } else {
      lottieRef.current?.reset();
    }
  }, [AISpeaking]);

  // Scroll to bottom when chat updates
  useEffect(() => {
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 200);
  }, [chatHistory]);

  // ─── Voice Functions ──────────────────────────────────────────────────

  const getMicrophonePermission = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission", "Please grant permission to access microphone");
        return false;
      }
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  const recordingOptions: any = {
    android: {
      extension: ".wav",
      outPutFormat: Audio.AndroidOutputFormat.MPEG_4,
      androidEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
    },
    ios: {
      extension: ".wav",
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
  };

  const startRecording = async () => {
    if (isRecording) return; // Guard against double-start
    const hasPermission = await getMicrophonePermission();
    if (!hasPermission) return;
    try {
      // Unload any existing recording first
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (_) {
          // Already unloaded, ignore
        }
        setRecording(undefined);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      setIsRecording(true);
      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(newRecording);
    } catch (error) {
      console.log("Failed to start Recording", error);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      setLoading(true);
      await recording?.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording?.getURI();
      setRecording(undefined); // Clear so next recording can start fresh
      const transcript = await sendAudioToWhisper(uri!);

      if (transcript && transcript.trim()) {
        const userMsg = { role: "user", content: transcript };
        setChatHistory((prev) => [...prev, userMsg]);
        await sendToGroqChat([...chatHistory, userMsg]);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.log("Failed to stop Recording", error);
      Alert.alert("Error", "Failed to stop recording");
      setLoading(false);
    }
  };

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://10.0.2.2:8000";

  const sendAudioToWhisper = async (uri: string) => {
    try {
      const formData: any = new FormData();
      formData.append("file", {
        uri,
        type: "audio/wav",
        name: "recording.wav",
      });

      const response = await axios.post(
        `${BACKEND_URL}/transcribe`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data.text;
    } catch (error) {
      console.log("Transcription error:", error);
      return "";
    }
  };

  const sendToGroqChat = async (messages: { role: string; content: string }[]) => {
    try {
      const chefProfileJson = await AsyncStorage.getItem("chefProfile");
      const chefProfile = chefProfileJson ? JSON.parse(chefProfileJson) : {};

      // The latest message is the current question
      const currentQuestion = messages[messages.length - 1]?.content || "";
      // All previous messages are the conversation history
      const previousMessages = messages.slice(0, -1);

      const response = await axios.post(`${BACKEND_URL}/chat`, {
        user_context: {
          language: chefProfile.language || "English",
          dietary_restrictions: chefProfile.dietary || [],
          spice_tolerance: chefProfile.spice || "Medium",
        },
        question: currentQuestion,
        conversation_history: previousMessages,
        // No recipe_context — backend will use general chat mode
      });

      const aiText = response.data.answer;
      setChatHistory((prev) => [...prev, { role: "assistant", content: aiText }]);
      setLoading(false);
      await speakText(aiText);
    } catch (error) {
      console.log("Error calling backend /chat:", error);
      setLoading(false);
      Alert.alert("Error", "Could not reach the AI assistant. Please check your connection.");
    }
  };

  const speakText = async (textToSpeak: string) => {
    Speech.stop();
    setAISpeaking(true);
    const options = {
      language: "en-US",
      pitch: 1.0,
      rate: 1.0,
      onDone: () => {
        setAISpeaking(false);
        if (autoListenAfterSpeech) {
          setTimeout(() => startRecording(), 600);
        }
      },
      onStopped: () => {
        setAISpeaking(false);
      },
    };
    Speech.speak(textToSpeak, options);
  };

  const clearConversation = () => {
    Speech.stop();
    setIsRecording(false);
    setAISpeaking(false);
    setLoading(false);
    setChatHistory([]);
    setNutritionData(null);
  };

  const fetchNutrition = async (messageContent: string) => {
    // Try to extract recipe name from the AI's message
    // Look for text after "Recipe Name:" or "**" bold markers or first line
    let recipeName = "";
    const boldMatch = messageContent.match(/\*\*([^*]+)\*\*/);
    const recipeNameMatch = messageContent.match(/Recipe Name:\s*(.+)/i);
    if (recipeNameMatch) {
      recipeName = recipeNameMatch[1].trim();
    } else if (boldMatch) {
      recipeName = boldMatch[1].trim();
    } else {
      // Use first line
      recipeName = messageContent.split("\n")[0].substring(0, 60).trim();
    }

    if (!recipeName) return;

    setNutritionLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/nutrition`, {
        params: { query: recipeName },
      });
      setNutritionData(response.data);
    } catch (error) {
      console.log("Nutrition fetch error:", error);
      // Show a fallback message in chat
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Could not find nutrition data for "${recipeName}" in RecipeDB.` },
      ]);
    } finally {
      setNutritionLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <LinearGradient
      colors={["#250152", "#000"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      {/* Background blurs */}
      <Image
        source={require("@/assets/main/blur.png")}
        style={styles.blurRight}
      />
      <Image
        source={require("@/assets/main/purple-blur.png")}
        style={styles.blurLeft}
      />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI Recipe Assistant</Text>
          <Text style={styles.subtitle}>Your personal cooking companion</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setAutoListenAfterSpeech(!autoListenAfterSpeech)}
            style={styles.headerBtn}
          >
            <MaterialIcons
              name={autoListenAfterSpeech ? "hearing" : "hearing-disabled"}
              size={scale(20)}
              color={autoListenAfterSpeech ? "#6C63FF" : "#666"}
            />
          </TouchableOpacity>
          {chatHistory.length > 0 && (
            <TouchableOpacity onPress={clearConversation} style={styles.headerBtn}>
              <MaterialIcons name="delete-outline" size={scale(20)} color="#FF6B6B" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push("/(routes)/recipe-search")}
            style={styles.headerBtn}
          >
            <FontAwesome name="search" size={scale(18)} color="#6C63FF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Area */}
      <ScrollView
        ref={chatScrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {chatHistory.length === 0 && !loading && !isRecording && (
          <View style={styles.emptyChat}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome name="microphone" size={scale(50)} color="#6C63FF" />
            </View>
            <Text style={styles.emptyChatTitle}>Start a Conversation</Text>
            <Text style={styles.emptyChatSubtitle}>
              Tap the mic below to ask anything about{"\n"}cooking, recipes, or ingredients!
            </Text>
            <View style={styles.suggestionRow}>
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => {
                  const msg = { role: "user", content: "What can I cook with eggs and cheese?" };
                  setChatHistory([msg]);
                  setLoading(true);
                  sendToGroqChat([msg]);
                }}
              >
                <Text style={styles.suggestionText}>🥚 What can I cook with eggs?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => {
                  const msg = { role: "user", content: "Give me a quick dinner recipe" };
                  setChatHistory([msg]);
                  setLoading(true);
                  sendToGroqChat([msg]);
                }}
              >
                <Text style={styles.suggestionText}>🍽️ Quick dinner ideas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => {
                  const msg = { role: "user", content: "What is a good substitute for butter?" };
                  setChatHistory([msg]);
                  setLoading(true);
                  sendToGroqChat([msg]);
                }}
              >
                <Text style={styles.suggestionText}>🧈 Butter substitute?</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {chatHistory.map((msg, idx) => (
          <View key={idx}>
            <View
              style={[
                styles.chatBubble,
                msg.role === "user" ? styles.userBubble : styles.aiBubble,
              ]}
            >
              <View style={styles.bubbleHeader}>
                {msg.role === "user" ? (
                  <FontAwesome name="user" size={scale(11)} color="#6C63FF" />
                ) : (
                  <FontAwesome5 name="robot" size={scale(11)} color="#00b894" />
                )}
                <Text style={styles.bubbleRole}>
                  {msg.role === "user" ? "You" : "AI Chef"}
                </Text>
              </View>
              <Text style={styles.bubbleText}>{msg.content}</Text>
            </View>

            {/* Nutrition button — shown after AI messages */}
            {msg.role === "assistant" && !msg.content.startsWith("⚠️") && (
              <TouchableOpacity
                style={styles.nutritionBtn}
                onPress={() => fetchNutrition(msg.content)}
                disabled={nutritionLoading}
              >
                <Ionicons name="nutrition" size={scale(14)} color="#00b894" />
                <Text style={styles.nutritionBtnText}>
                  {nutritionLoading ? "Loading…" : "🥗 Nutrition Info"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Nutrition Card */}
        {nutritionData && (
          <View style={styles.nutritionCard}>
            <View style={styles.nutritionCardHeader}>
              <Ionicons name="nutrition" size={scale(18)} color="#00b894" />
              <Text style={styles.nutritionCardTitle}>
                {nutritionData.recipe_title}
              </Text>
              <TouchableOpacity onPress={() => setNutritionData(null)}>
                <MaterialIcons name="close" size={scale(18)} color="#aaa" />
              </TouchableOpacity>
            </View>
            <Text style={styles.nutritionCardSubtitle}>
              Per Serving • {nutritionData.source === "estimated" ? "⚡ AI Estimated" : "via RecipeDB"}
            </Text>
            <View style={styles.nutritionGrid}>
              {[
                { label: "Calories", value: nutritionData.nutrition.calories, unit: "kcal", color: "#FF6B6B" },
                { label: "Protein", value: nutritionData.nutrition.protein, unit: "g", color: "#6C63FF" },
                { label: "Fat", value: nutritionData.nutrition.total_fat, unit: "g", color: "#FDCB6E" },
                { label: "Carbs", value: nutritionData.nutrition.carbohydrates, unit: "g", color: "#00b894" },
                { label: "Fiber", value: nutritionData.nutrition.fiber, unit: "g", color: "#74b9ff" },
                { label: "Sugar", value: nutritionData.nutrition.sugar, unit: "g", color: "#fd79a8" },
                { label: "Sodium", value: nutritionData.nutrition.sodium, unit: "mg", color: "#a29bfe" },
                { label: "Cholesterol", value: nutritionData.nutrition.cholesterol, unit: "mg", color: "#ffeaa7" },
              ].map((item) => (
                <View key={item.label} style={styles.nutritionGridItem}>
                  <Text style={[styles.nutritionValue, { color: item.color }]}>
                    {item.value !== "N/A" ? `${parseFloat(String(item.value)).toFixed(1)}` : "—"}
                  </Text>
                  <Text style={styles.nutritionUnit}>{item.unit}</Text>
                  <Text style={styles.nutritionLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {loading && (
          <View style={[styles.chatBubble, styles.aiBubble]}>
            <LottieView
              source={require("@/assets/animations/loading.json")}
              autoPlay
              loop
              speed={1.3}
              style={{ width: scale(80), height: scale(50) }}
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Controls */}
      <View style={styles.bottomBar}>
        {AISpeaking && (
          <View style={styles.speakingRow}>
            <LottieView
              ref={lottieRef}
              source={require("@/assets/animations/ai-speaking.json")}
              autoPlay
              loop
              style={{ width: scale(45), height: scale(45) }}
            />
            <Text style={styles.speakingLabel}>AI is speaking…</Text>
            <TouchableOpacity
              onPress={() => { Speech.stop(); setAISpeaking(false); }}
              style={styles.stopBtn}
            >
              <MaterialIcons name="stop" size={scale(16)} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {isRecording ? (
          <TouchableOpacity onPress={stopRecording} style={styles.recordingRow}>
            <LottieView
              source={require("@/assets/animations/animation.json")}
              autoPlay
              loop
              speed={1.3}
              style={{ width: scale(55), height: scale(55) }}
            />
            <Text style={styles.recordingLabel}>Listening… Tap to send</Text>
          </TouchableOpacity>
        ) : (
          !AISpeaking && !loading && (
            <TouchableOpacity style={styles.micBtn} onPress={startRecording}>
              <LinearGradient
                colors={["#6C63FF", "#4834d4"]}
                style={styles.micBtnGradient}
              >
                <FontAwesome name="microphone" size={scale(28)} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  blurRight: {
    position: "absolute",
    right: scale(-15),
    top: 0,
    width: scale(240),
    opacity: 0.5,
  },
  blurLeft: {
    position: "absolute",
    left: scale(-15),
    bottom: verticalScale(100),
    width: scale(210),
    opacity: 0.5,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: verticalScale(55),
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(12),
  },
  title: {
    color: "#fff",
    fontSize: scale(20),
    fontFamily: "SegoeUI",
    fontWeight: "bold",
  },
  subtitle: {
    color: "#9A9999",
    fontSize: scale(12),
    fontFamily: "SegoeUI",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  headerBtn: {
    padding: scale(8),
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: scale(12),
  },

  // Chat
  chatArea: { flex: 1 },
  chatContent: {
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(10),
    paddingTop: verticalScale(10),
  },

  // Empty state
  emptyChat: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: verticalScale(80),
    gap: verticalScale(14),
  },
  emptyIconContainer: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    backgroundColor: "rgba(108,99,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(8),
  },
  emptyChatTitle: {
    color: "#fff",
    fontSize: scale(22),
    fontFamily: "SegoeUI",
    fontWeight: "bold",
  },
  emptyChatSubtitle: {
    color: "#999",
    fontSize: scale(13),
    fontFamily: "SegoeUI",
    textAlign: "center",
    lineHeight: scale(20),
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: scale(8),
    marginTop: verticalScale(10),
    paddingHorizontal: scale(10),
  },
  suggestionChip: {
    backgroundColor: "rgba(108,99,255,0.15)",
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(14),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.25)",
  },
  suggestionText: {
    color: "#ddd",
    fontSize: scale(12),
    fontFamily: "SegoeUI",
  },

  // Chat bubbles
  chatBubble: {
    maxWidth: "85%",
    padding: scale(14),
    borderRadius: scale(16),
    marginBottom: verticalScale(10),
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(108,99,255,0.25)",
    borderBottomRightRadius: scale(4),
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderBottomLeftRadius: scale(4),
  },
  bubbleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    marginBottom: verticalScale(4),
  },
  bubbleRole: {
    color: "#aaa",
    fontSize: scale(10),
    fontFamily: "SegoeUI",
    fontWeight: "600",
  },
  bubbleText: {
    color: "#fff",
    fontSize: scale(14),
    fontFamily: "SegoeUI",
    lineHeight: scale(20),
  },

  // Bottom bar
  bottomBar: {
    alignItems: "center",
    paddingVertical: verticalScale(12),
    paddingBottom: verticalScale(35),
  },
  micBtn: {},
  micBtnGradient: {
    width: scale(68),
    height: scale(68),
    borderRadius: scale(34),
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#6C63FF",
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
  },
  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  recordingLabel: {
    color: "#FF6B6B",
    fontSize: scale(14),
    fontFamily: "SegoeUI",
    fontWeight: "600",
  },
  speakingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginBottom: verticalScale(8),
  },
  speakingLabel: {
    color: "#6C63FF",
    fontSize: scale(13),
    fontFamily: "SegoeUI",
  },
  stopBtn: {
    backgroundColor: "rgba(255,107,107,0.3)",
    padding: scale(6),
    borderRadius: scale(12),
  },

  // Nutrition button
  nutritionBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: scale(5),
    backgroundColor: "rgba(0,184,148,0.12)",
    paddingVertical: verticalScale(5),
    paddingHorizontal: scale(12),
    borderRadius: scale(14),
    marginBottom: verticalScale(10),
    marginTop: verticalScale(-4),
    borderWidth: 1,
    borderColor: "rgba(0,184,148,0.25)",
  },
  nutritionBtnText: {
    color: "#00b894",
    fontSize: scale(11),
    fontFamily: "SegoeUI",
    fontWeight: "600",
  },

  // Nutrition card
  nutritionCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: "rgba(0,184,148,0.2)",
  },
  nutritionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginBottom: verticalScale(4),
  },
  nutritionCardTitle: {
    flex: 1,
    color: "#fff",
    fontSize: scale(15),
    fontFamily: "SegoeUI",
    fontWeight: "bold",
  },
  nutritionCardSubtitle: {
    color: "#888",
    fontSize: scale(10),
    fontFamily: "SegoeUI",
    marginBottom: verticalScale(12),
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: scale(6),
  },
  nutritionGridItem: {
    width: "23%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: scale(10),
    paddingVertical: verticalScale(10),
    alignItems: "center",
  },
  nutritionValue: {
    fontSize: scale(15),
    fontWeight: "bold",
    fontFamily: "SegoeUI",
  },
  nutritionUnit: {
    color: "#999",
    fontSize: scale(9),
    fontFamily: "SegoeUI",
  },
  nutritionLabel: {
    color: "#bbb",
    fontSize: scale(9),
    fontFamily: "SegoeUI",
    marginTop: verticalScale(2),
  },
});

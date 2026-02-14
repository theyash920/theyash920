import { AntDesign, FontAwesome, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { scale, verticalScale } from "react-native-size-matters";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://10.0.2.2:8000";

export default function CookingModeScreen() {
    const { recipeId } = useLocalSearchParams();
    const [recipe, setRecipe] = useState<any>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [stepImage, setStepImage] = useState<string | null>(null);

    // Voice State
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [aiThinking, setAiThinking] = useState(false);
    const [aiSpeaking, setAiSpeaking] = useState(false);

    // Nutrition Modal
    const [modalVisible, setModalVisible] = useState(false);

    // Lottie Ref
    const lottieRef = useRef<LottieView>(null);

    useEffect(() => {
        fetchRecipeAndProfile();
    }, [recipeId]);

    // Effect for visual checkpoints
    useEffect(() => {
        if (recipe && currentStepIndex % 3 === 0) {
            updateVisualCheckpoint();
        }
    }, [currentStepIndex, recipe]);

    // Effect for TTS animation
    useEffect(() => {
        if (aiSpeaking) {
            lottieRef.current?.play();
        } else {
            lottieRef.current?.reset();
        }
    }, [aiSpeaking]);

    const fetchRecipeAndProfile = async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/recipe/${recipeId}`);
            setRecipe(response.data);
            // Set initial image
            setStepImage(response.data.image);
        } catch (error) {
            console.log("Fetch error:", error);
            Alert.alert("Error", "Failed to load recipe");
        } finally {
            setLoading(false);
        }
    };

    const updateVisualCheckpoint = async () => {
        if (!recipe) return;
        try {
            const stepText = recipe.steps[currentStepIndex];
            const query = `${recipe.title} ${stepText}`.substring(0, 50); // Limit length
            // Don't block UI
            axios.get(`${BACKEND_URL}/visual-checkpoint`, { params: { query } })
                .then(res => {
                    if (res.data.image_url) {
                        setStepImage(res.data.image_url);
                    }
                })
                .catch(err => console.log("Visual checkpoint error:", err));

        } catch (error) {
            console.log("Visual checkpoint error:", error);
        }
    };

    // ─── Voice Interaction ────────────────────────────────────────────────────

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
        const hasPermission = await getMicrophonePermission();
        if (!hasPermission) return;
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });
            setIsRecording(true);
            const { recording } = await Audio.Recording.createAsync(recordingOptions);
            setRecording(recording);
        } catch (error) {
            console.log("Failed to start Recording", error);
        }
    };

    const stopRecording = async () => {
        try {
            setIsRecording(false);
            setAiThinking(true);
            await recording?.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

            const uri = recording?.getURI();
            if (uri) {
                const transcript = await sendAudioToWhisper(uri);
                if (transcript) {
                    await sendToBackendChat(transcript);
                } else {
                    setAiThinking(false);
                }
            } else {
                setAiThinking(false);
            }
        } catch (error) {
            console.log("Failed to stop Recording", error);
            setAiThinking(false);
        }
    };

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
            return null;
        }
    };

    const sendToBackendChat = async (userQuestion: string) => {
        try {
            const chefProfileJson = await AsyncStorage.getItem('chefProfile');
            const chefProfile = chefProfileJson ? JSON.parse(chefProfileJson) : {};


            const payload = {
                user_context: {
                    language: chefProfile.language || "English",
                    dietary_restrictions: (chefProfile.dietary || []).join(", "),
                    spice_tolerance: chefProfile.spice || "Medium",
                },
                recipe_context: {
                    recipe_title: recipe.title,
                    current_step: recipe.steps[currentStepIndex],
                    current_step_index: currentStepIndex,
                    ingredients: recipe.ingredients,
                    all_steps: recipe.steps,
                },
                question: userQuestion,
            };

            const response = await axios.post(`${BACKEND_URL}/chat`, payload);
            const answer = response.data.answer;

            setAiThinking(false);
            speakText(answer);

        } catch (error) {
            console.log("Backend chat error:", error);
            setAiThinking(false);
            Alert.alert("Error", "My brain is having a hiccup. Please try again.");
        }
    };

    const speakText = (textToSpeak: string) => {
        // Stop any currently playing / queued speech first
        Speech.stop();
        setAiSpeaking(true);
        const options = {
            pitch: 1.0,
            rate: 1.0,
            onDone: () => setAiSpeaking(false),
            onStopped: () => setAiSpeaking(false),
        };
        Speech.speak(textToSpeak, options);
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    if (loading || !recipe) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    const progress = (currentStepIndex + 1) / recipe.steps.length;

    return (
        <LinearGradient
            colors={["#250152", "#000"]}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <AntDesign name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.stepCounter}>Step {currentStepIndex + 1} of {recipe.steps.length}</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.iconBtn}>
                    <FontAwesome name="info-circle" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
            </View>

            {/* Main Content */}
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Dynamic Image Area */}
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: stepImage || "https://via.placeholder.com/300" }}
                        style={styles.stepImage}
                        resizeMode="cover"
                    />
                </View>

                {/* Step Text */}
                <View style={styles.stepTextContainer}>
                    <Text style={styles.stepText}>
                        {recipe.steps[currentStepIndex]}
                    </Text>
                </View>

                {/* AI Thinking/Speaking Visuals */}
                {(aiThinking || aiSpeaking) && (
                    <View style={styles.aiVisualContainer}>
                        {aiThinking && <Text style={{ color: '#ccc' }}>Thinking...</Text>}
                        <LottieView
                            ref={lottieRef}
                            source={require("@/assets/animations/ai-speaking.json")}
                            autoPlay={aiSpeaking}
                            loop={true}
                            style={{ width: scale(100), height: scale(100) }}
                        />
                    </View>
                )}

            </ScrollView>

            {/* Formatting & Controls */}
            <View style={styles.controlsContainer}>

                {/* Prev Button */}
                <TouchableOpacity
                    style={[styles.navBtn, currentStepIndex === 0 && styles.disabledBtn]}
                    disabled={currentStepIndex === 0}
                    onPress={() => setCurrentStepIndex(curr => Math.max(0, curr - 1))}
                >
                    <AntDesign name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>

                {/* Mic Button */}
                <TouchableOpacity
                    style={[styles.micBtn, isRecording && styles.micBtnActive]}
                    onPress={isRecording ? stopRecording : startRecording}
                >
                    {isRecording ? (
                        <MaterialIcons name="stop" size={32} color="#fff" />
                    ) : (
                        <FontAwesome name="microphone" size={32} color="#fff" />
                    )}
                </TouchableOpacity>

                {/* Next Button */}
                <TouchableOpacity
                    style={[styles.navBtn, currentStepIndex === recipe.steps.length - 1 && styles.disabledBtn]}
                    disabled={currentStepIndex === recipe.steps.length - 1}
                    onPress={() => setCurrentStepIndex(curr => Math.min(recipe.steps.length - 1, curr + 1))}
                >
                    <AntDesign name="arrow-right" size={24} color="#fff" />
                </TouchableOpacity>

            </View>

            {/* Nutrition Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nutritional Info</Text>

                        <View style={styles.nutritionGrid}>
                            <View style={styles.nutritionItem}>
                                <Text style={styles.nutritionValue}>{recipe.nutrition.calories}</Text>
                                <Text style={styles.nutritionLabel}>Calories</Text>
                            </View>
                            <View style={styles.nutritionItem}>
                                <Text style={styles.nutritionValue}>{recipe.nutrition.protein}g</Text>
                                <Text style={styles.nutritionLabel}>Protein</Text>
                            </View>
                            <View style={styles.nutritionItem}>
                                <Text style={styles.nutritionValue}>{recipe.nutrition.fat}g</Text>
                                <Text style={styles.nutritionLabel}>Fat</Text>
                            </View>
                            <View style={styles.nutritionItem}>
                                <Text style={styles.nutritionValue}>{recipe.nutrition.carbs}g</Text>
                                <Text style={styles.nutritionLabel}>Carbs</Text>
                            </View>
                            <View style={styles.nutritionItem}>
                                <Text style={styles.nutritionValue}>{recipe.nutrition.fiber}g</Text>
                                <Text style={styles.nutritionLabel}>Fiber</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: verticalScale(40), paddingHorizontal: scale(20), paddingBottom: verticalScale(10) },
    iconBtn: { padding: 10 },
    stepCounter: { color: "#fff", fontSize: scale(16), fontFamily: "SegoeUI", fontWeight: "600" },
    progressBarContainer: { height: 4, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: scale(20), borderRadius: 2, overflow: "hidden" },
    progressBar: { height: "100%", backgroundColor: "#6C63FF" },

    scrollContent: { paddingHorizontal: scale(20), paddingVertical: verticalScale(20), alignItems: "center" },
    imageContainer: { width: "100%", height: verticalScale(220), borderRadius: scale(20), overflow: "hidden", marginBottom: verticalScale(20), borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
    stepImage: { width: "100%", height: "100%" },

    stepTextContainer: { width: "100%", marginTop: verticalScale(10) },
    stepText: { color: "#fff", fontSize: scale(22), fontFamily: "SegoeUI", textAlign: "center", lineHeight: scale(32) },

    aiVisualContainer: { marginTop: verticalScale(20), alignItems: "center" },

    controlsContainer: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "center", paddingBottom: verticalScale(40), paddingTop: verticalScale(20) },
    navBtn: { width: scale(50), height: scale(50), borderRadius: scale(25), backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
    disabledBtn: { opacity: 0.3 },
    micBtn: { width: scale(70), height: scale(70), borderRadius: scale(35), backgroundColor: "#6C63FF", justifyContent: "center", alignItems: "center", elevation: 10, shadowColor: "#6C63FF", shadowOpacity: 0.5, shadowRadius: 10 },
    micBtnActive: { backgroundColor: "#FF4D4D" },

    // Modal (Simplified)
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
    modalContent: { width: "80%", backgroundColor: "#1e1e1e", borderRadius: 20, padding: 25, alignItems: "center" },
    modalTitle: { fontSize: scale(22), color: "#fff", fontWeight: "bold", marginBottom: 20 },
    nutritionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", width: "100%", marginBottom: 25 },
    nutritionItem: { width: "45%", backgroundColor: "#333", padding: 15, borderRadius: 10, marginBottom: 10, alignItems: "center" },
    nutritionValue: { fontSize: scale(20), color: "#6C63FF", fontWeight: "bold" },
    nutritionLabel: { fontSize: scale(12), color: "#ccc" },
    closeButton: { backgroundColor: "#6C63FF", paddingVertical: 10, paddingHorizontal: 30, borderRadius: 20 },
    closeButtonText: { color: "#fff", fontWeight: "bold" },
});

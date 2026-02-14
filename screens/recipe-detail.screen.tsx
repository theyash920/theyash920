import { AntDesign, FontAwesome5, Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { scale, verticalScale } from "react-native-size-matters";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://10.0.2.2:8000";

export default function RecipeDetailScreen() {
    const { recipeId } = useLocalSearchParams();
    const [recipe, setRecipe] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        fetchRecipeDetails();
    }, [recipeId]);

    const fetchRecipeDetails = async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/recipe/${recipeId}`);
            setRecipe(response.data);
        } catch (error) {
            console.log("Fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    if (!recipe) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{ color: "#fff" }}>Recipe not found.</Text>
            </View>
        );
    }

    return (
        <LinearGradient
            colors={["#250152", "#000"]}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

                {/* Header Image */}
                <View style={styles.imageContainer}>
                    <Image source={{ uri: recipe.image || "https://via.placeholder.com/300" }} style={styles.image} />
                    <LinearGradient
                        colors={["transparent", "#000"]}
                        style={styles.gradientOverlay}
                    />
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <AntDesign name="arrow-left" size={scale(24)} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.title}>{recipe.title}</Text>
                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={16} color="#bbb" />
                            <Text style={styles.metaText}>{recipe.cook_time || "45m"}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="people-outline" size={16} color="#bbb" />
                            <Text style={styles.metaText}>{recipe.servings} Servings</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="restaurant-outline" size={16} color="#bbb" />
                            <Text style={styles.metaText}>{recipe.cuisine}</Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.nutritionBtn}
                            onPress={() => setModalVisible(true)}
                        >
                            <FontAwesome5 name="heartbeat" size={18} color="#6C63FF" />
                            <Text style={styles.nutritionBtnText}>Nutrition</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Ingredients</Text>
                        {recipe.ingredients.map((ing: any, index: number) => (
                            <View key={index} style={styles.ingredientRow}>
                                <View style={styles.bullet} />
                                <Text style={styles.ingredientText}>
                                    {ing.quantity} {ing.unit} {ing.name}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Preparation</Text>
                        <Text style={styles.stepsText}>{recipe.steps.length} Steps involved</Text>
                    </View>

                </View>
            </ScrollView>

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push({
                    pathname: "/(routes)/cooking-mode",
                    params: { recipeId: recipeId }
                })}
            >
                <Text style={styles.fabText}>Start Cooking</Text>
                <AntDesign name="caret-right" size={18} color="#000" />
            </TouchableOpacity>

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
                        <Text style={styles.modalSubtitle}>Per Serving</Text>

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
    imageContainer: { height: verticalScale(250), width: "100%" },
    image: { width: "100%", height: "100%" },
    gradientOverlay: { position: "absolute", bottom: 0, width: "100%", height: "50%" },
    backButton: { position: "absolute", top: verticalScale(50), left: scale(20), backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 8 },
    content: { padding: scale(20), marginTop: verticalScale(-20) },
    title: { fontSize: scale(26), color: "#fff", fontWeight: "bold", fontFamily: "SegoeUI", marginBottom: verticalScale(10) },
    metaRow: { flexDirection: "row", gap: scale(15), marginBottom: verticalScale(20) },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    metaText: { color: "#bbb", fontSize: scale(14), fontFamily: "SegoeUI" },
    actionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: verticalScale(20) },
    nutritionBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(108, 99, 255, 0.2)", paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
    nutritionBtnText: { color: "#6C63FF", fontSize: scale(14), fontWeight: "600" },
    section: { marginBottom: verticalScale(25) },
    sectionTitle: { fontSize: scale(18), color: "#fff", fontWeight: "600", marginBottom: verticalScale(10) },
    ingredientRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: verticalScale(8) },
    bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#6C63FF", marginTop: 7, marginRight: 10 },
    ingredientText: { color: "#ddd", fontSize: scale(15), fontFamily: "SegoeUI", flex: 1 },
    stepsText: { color: "#aaa", fontSize: scale(14), fontStyle: "italic" },
    fab: { position: "absolute", bottom: verticalScale(30), alignSelf: "center", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: verticalScale(15), paddingHorizontal: scale(30), borderRadius: scale(30), elevation: 5 },
    fabText: { fontSize: scale(16), fontWeight: "bold", color: "#000" },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" },
    modalContent: { width: "80%", backgroundColor: "#1e1e1e", borderRadius: 20, padding: 25, alignItems: "center" },
    modalTitle: { fontSize: scale(22), color: "#fff", fontWeight: "bold", marginBottom: 5 },
    modalSubtitle: { fontSize: scale(14), color: "#aaa", marginBottom: 20 },
    nutritionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", width: "100%", marginBottom: 25 },
    nutritionItem: { width: "45%", backgroundColor: "#333", padding: 15, borderRadius: 10, marginBottom: 10, alignItems: "center" },
    nutritionValue: { fontSize: scale(18), color: "#6C63FF", fontWeight: "bold" },
    nutritionLabel: { fontSize: scale(12), color: "#ccc" },
    closeButton: { backgroundColor: "#6C63FF", paddingVertical: 10, paddingHorizontal: 30, borderRadius: 20 },
    closeButtonText: { color: "#fff", fontWeight: "bold" },
});

import { AntDesign, FontAwesome } from "@expo/vector-icons";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { scale, verticalScale } from "react-native-size-matters";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://10.0.2.2:8000";

export default function RecipeSearchScreen() {
    const { initialQuery } = useLocalSearchParams<{ initialQuery?: string }>();
    const [query, setQuery] = useState(initialQuery || "");
    const [recipes, setRecipes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialQuery) {
            searchRecipes(initialQuery);
        }
    }, [initialQuery]);

    const searchRecipes = async (searchQuery?: string) => {
        const q = searchQuery || query;
        if (!q.trim()) return;
        setLoading(true);
        try {
            const response = await axios.get(`${BACKEND_URL}/search`, {
                params: { query: q },
            });

            if (response.data && response.data.results) {
                setRecipes(response.data.results);
            }
        } catch (error) {
            console.log("Search error:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({
                pathname: "/(routes)/recipe-detail",
                params: { recipeId: item.id }
            })}
        >
            <Image
                source={{ uri: item.image || "https://via.placeholder.com/150" }}
                style={styles.cardImage}
            />
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardText}>{item.cuisine}</Text>
                    <View style={styles.dot} />
                    <Text style={styles.cardText}>{item.category}</Text>
                </View>
            </View>
            <AntDesign name="right" size={scale(16)} color="#CCC" style={{ marginRight: scale(10) }} />
        </TouchableOpacity>
    );

    return (
        <LinearGradient
            colors={["#250152", "#131313"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <AntDesign name="arrow-left" size={scale(24)} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Find a Recipe</Text>
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search for a dish (e.g. Butter Chicken)..."
                    placeholderTextColor="#999"
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={() => searchRecipes()}
                    returnKeyType="search"
                />
                <TouchableOpacity style={styles.searchButton} onPress={() => searchRecipes()}>
                    <FontAwesome name="search" size={scale(18)} color="#fff" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            ) : (
                <FlatList
                    data={recipes}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            {query ? "No recipes found." : "Search for something delicious!"}
                        </Text>
                    }
                />
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: verticalScale(50),
        paddingHorizontal: scale(20),
        marginBottom: verticalScale(20),
    },
    backButton: {
        marginRight: scale(15),
    },
    headerTitle: {
        fontSize: scale(22),
        color: '#fff',
        fontFamily: "SegoeUI",
        fontWeight: 'bold',
    },
    searchContainer: {
        flexDirection: "row",
        marginHorizontal: scale(20),
        marginBottom: verticalScale(20),
        alignItems: "center",
    },
    searchInput: {
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: scale(25),
        paddingVertical: verticalScale(10),
        paddingHorizontal: scale(20),
        fontSize: scale(16),
        fontFamily: "SegoeUI",
        marginRight: scale(10),
    },
    searchButton: {
        backgroundColor: "#6C63FF",
        width: scale(45),
        height: scale(45),
        borderRadius: scale(25),
        justifyContent: "center",
        alignItems: "center",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    listContent: {
        paddingHorizontal: scale(20),
        paddingBottom: verticalScale(50),
    },
    card: {
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: scale(15),
        flexDirection: "row",
        alignItems: "center",
        marginBottom: verticalScale(15),
        overflow: "hidden",
        padding: scale(10),
    },
    cardImage: {
        width: scale(70),
        height: scale(70),
        borderRadius: scale(10),
        marginRight: scale(15),
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        color: "#fff",
        fontSize: scale(16),
        fontFamily: "SegoeUI",
        fontWeight: "600",
        marginBottom: verticalScale(5),
    },
    cardInfo: {
        flexDirection: "row",
        alignItems: "center",
    },
    cardText: {
        color: "#CCC",
        fontSize: scale(12),
        fontFamily: "SegoeUI",
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#CCC",
        marginHorizontal: 6,
    },
    emptyText: {
        color: "#999",
        textAlign: "center",
        marginTop: verticalScale(50),
        fontSize: scale(16),
        fontFamily: "SegoeUI",
    },
});

import { onBoardingData } from "@/configs/constans";
import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { scale, verticalScale } from "react-native-size-matters";

export default function OnBoardingScreen() {
  let [fontsLoaded, fontError] = useFonts({
    SegoeUI: require("../assets/fonts/Segoe-UI.ttf"),
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Chef Profile State
  const [language, setLanguage] = useState("English");
  const [dietary, setDietary] = useState<string[]>([]);
  const [spice, setSpice] = useState("Medium");

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(
      contentOffsetX / event.nativeEvent.layoutMeasurement.width
    );
    setActiveIndex(currentIndex);
  };

  const toggleDietary = (item: string) => {
    if (dietary.includes(item)) {
      setDietary(dietary.filter((i) => i !== item));
    } else {
      setDietary([...dietary, item]);
    }
  };

  const handleNext = async () => {
    const nextIndex = activeIndex + 1;

    if (nextIndex < onBoardingData.length) {
      scrollViewRef.current?.scrollTo({
        x: Dimensions.get("window").width * nextIndex,
        animated: true,
      });
      setActiveIndex(nextIndex);
    } else {
      // Save Profile and Finish
      const profile = { language, dietary, spice };
      await AsyncStorage.setItem('chefProfile', JSON.stringify(profile));
      await AsyncStorage.setItem('onboarding', 'true');
      router.push("/(routes)/home");
    }
  }

  const dietaryOptions = ["Vegetarian", "Vegan", "Gluten-Free", "Nut-Free"];
  const spiceOptions = ["Mild", "Medium", "Hot"];

  return (
    <LinearGradient
      colors={["#250152", "#000000"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />

      {/* Skip Button (only on first 3 slides) */}
      {activeIndex < onBoardingData.length - 1 && (
        <Pressable
          style={styles.skipContainer}
          onPress={() => {
            // Jump to last slide (Chef Profile)
            const lastIndex = onBoardingData.length - 1;
            scrollViewRef.current?.scrollTo({
              x: Dimensions.get("window").width * lastIndex,
              animated: true,
            });
            setActiveIndex(lastIndex);
          }}
        >
          <Text style={styles.skipText}>Skip</Text>
          <AntDesign name="arrow-right" size={scale(18)} color="white" />
        </Pressable>
      )}

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        ref={scrollViewRef}
        scrollEnabled={true}
      >
        {onBoardingData.map((item, index) => (
          <View key={index} style={styles.slide}>
            {index === onBoardingData.length - 1 ? (
              <View style={styles.formContainer}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Language Preference</Text>
                  <View style={styles.row}>
                    {["English", "Hindi"].map((lang) => (
                      <TouchableOpacity
                        key={lang}
                        style={[
                          styles.optionBtn,
                          language === lang && styles.selectedOption,
                        ]}
                        onPress={() => setLanguage(lang)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            language === lang && styles.selectedOptionText,
                          ]}
                        >
                          {lang}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Dietary Restrictions</Text>
                  <View style={styles.rowWrap}>
                    {dietaryOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.optionBtn,
                          dietary.includes(opt) && styles.selectedOption,
                        ]}
                        onPress={() => toggleDietary(opt)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            dietary.includes(opt) && styles.selectedOptionText,
                          ]}
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Spice Tolerance</Text>
                  <View style={styles.row}>
                    {spiceOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.optionBtn,
                          spice === opt && styles.selectedOption,
                        ]}
                        onPress={() => setSpice(opt)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            spice === opt && styles.selectedOptionText,
                          ]}
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                  <Text style={styles.nextButtonText}>Start Cooking</Text>
                </TouchableOpacity>

              </View>
            ) : (
              <>
                {item.image}
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dot (hide on last slide optional, but keeping for consistency) */}
      <View style={styles.paginationContainer}>
        {onBoardingData.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                opacity: activeIndex === index ? 1 : 0.3,
              },
            ]}
          />
        ))}
      </View>

      {/* Floating Next Button for non-form slides */}
      {activeIndex < onBoardingData.length - 1 && (
        <TouchableOpacity
          style={styles.floatingNext}
          onPress={handleNext}
        >
          <AntDesign name="arrow-right" size={24} color="#FFF" />
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  slide: {
    width: Dimensions.get("window").width,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: scale(20),
  },
  formContainer: {
    width: "100%",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: scale(23),
    fontFamily: "SegoeUI",
    textAlign: "center",
    fontWeight: "500",
    marginBottom: verticalScale(10),
  },
  subtitle: {
    width: scale(290),
    color: "#9A9999",
    fontSize: scale(14),
    fontFamily: "SegoeUI",
    textAlign: "center",
    fontWeight: "400",
    marginBottom: verticalScale(30),
  },
  paginationContainer: {
    position: "absolute",
    bottom: verticalScale(40),
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: scale(8),
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: 100,
    backgroundColor: "#fff",
    marginHorizontal: scale(2),
  },
  skipContainer: {
    position: "absolute",
    top: verticalScale(45),
    right: scale(30),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    zIndex: 100,
  },
  skipText: {
    color: "#fff",
    fontSize: scale(16),
    fontFamily: "SegoeUI",
    fontWeight: "400",
  },

  // Form Styles
  inputGroup: {
    width: "100%",
    marginBottom: verticalScale(20),
  },
  label: {
    color: "#fff",
    fontSize: scale(16),
    marginBottom: verticalScale(10),
    fontFamily: "SegoeUI",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: scale(10),
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(10),
  },
  optionBtn: {
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(15),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "transparent",
    marginBottom: verticalScale(5),
  },
  selectedOption: {
    backgroundColor: "#fff",
  },
  optionText: {
    color: "#fff",
    fontSize: scale(14),
    fontFamily: "SegoeUI",
  },
  selectedOptionText: {
    color: "#000",
    fontWeight: "bold",
  },
  nextButton: {
    backgroundColor: "#fff",
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(40),
    borderRadius: scale(30),
    marginTop: verticalScale(20),
  },
  nextButtonText: {
    color: "#000",
    fontSize: scale(16),
    fontFamily: "SegoeUI",
    fontWeight: "bold",
  },
  floatingNext: {
    position: "absolute",
    bottom: verticalScale(40),
    right: scale(30),
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  }
});
